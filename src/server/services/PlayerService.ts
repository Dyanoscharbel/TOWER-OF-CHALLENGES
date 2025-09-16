import { redis, reddit } from '@devvit/web/server';
import { Player, CreatePlayerData, PlayerStats } from '../../shared/types/player.js';

export class PlayerService {
  // Utiliser directement les clients redis et reddit de Devvit
  private redis = redis;
  private reddit = reddit;

  // Clés Redis pour organiser les données
  private getPlayerKey(redditId: string): string {
    return `player:${redditId}`;
  }

  private getPlayerStatsKey(redditId: string): string {
    return `player_stats:${redditId}`;
  }

  private getGlobalLeaderboardKey(): string {
    return 'leaderboard:global';
  }

  // Créer ou mettre à jour un joueur
  async createOrUpdatePlayer(data: CreatePlayerData): Promise<Player> {
    const playerKey = this.getPlayerKey(data.reddit_id);
    
    // Vérifier si le joueur existe déjà
    const existingPlayer = await this.redis.get(playerKey);
    
    if (existingPlayer) {
      // Joueur existant - mettre à jour les infos de base
      const player: Player = JSON.parse(existingPlayer);
      player.username = data.username;
      if (data.avatar_url) {
        player.avatar_url = data.avatar_url;
      }
      
      await this.redis.set(playerKey, JSON.stringify(player));
      return player;
    } else {
      // Nouveau joueur - créer avec valeurs par défaut
      const newPlayer: Player = {
        reddit_id: data.reddit_id,
        username: data.username,
        avatar_url: data.avatar_url || '',
        score_global: 0,
        etage_actuel: 1,
        created_at: new Date().toISOString()
      };

      // Sauvegarder le joueur
      await this.redis.set(playerKey, JSON.stringify(newPlayer));
      
      // Initialiser les stats du joueur
      const initialStats: PlayerStats = {
        score_global: 0,
        etage_actuel: 1,
        levels_completed: [], // Pour compatibilité avec l'ancien système
        completed_stages: [], // Pour le nouveau système
        stars_per_level: {}, // Pour compatibilité avec l'ancien système
        scores_per_stage: {} // Pour le nouveau système
      };
      
      await this.redis.set(this.getPlayerStatsKey(data.reddit_id), JSON.stringify(initialStats));
      
      // Ajouter au leaderboard global
      await this.redis.zAdd(this.getGlobalLeaderboardKey(), {
        member: data.reddit_id,
        score: 0
      });

      return newPlayer;
    }
  }

  // Récupérer un joueur par son reddit_id
  async getPlayer(redditId: string): Promise<Player | null> {
    const playerData = await this.redis.get(this.getPlayerKey(redditId));
    return playerData ? JSON.parse(playerData) : null;
  }

  // Récupérer les stats d'un joueur
  async getPlayerStats(redditId: string): Promise<PlayerStats | null> {
    const statsData = await this.redis.get(this.getPlayerStatsKey(redditId));
    return statsData ? JSON.parse(statsData) : null;
  }

  // Mettre à jour l'étage actuel du joueur
  async updatePlayerStage(redditId: string, newStage: number): Promise<void> {
    const playerKey = this.getPlayerKey(redditId);
    const statsKey = this.getPlayerStatsKey(redditId);
    
    // Mettre à jour le joueur
    const playerData = await this.redis.get(playerKey);
    if (playerData) {
      const player: Player = JSON.parse(playerData);
      player.etage_actuel = Math.max(player.etage_actuel, newStage);
      await this.redis.set(playerKey, JSON.stringify(player));
    }

    // Mettre à jour les stats
    const statsData = await this.redis.get(statsKey);
    if (statsData) {
      const stats: PlayerStats = JSON.parse(statsData);
      stats.etage_actuel = Math.max(stats.etage_actuel, newStage);
      await this.redis.set(statsKey, JSON.stringify(stats));
    }
  }

  // Compléter un niveau avec des étoiles
  async completeLevel(redditId: string, level: number, stars: number): Promise<void> {
    const statsKey = this.getPlayerStatsKey(redditId);
    const playerKey = this.getPlayerKey(redditId);
    
    const statsData = await this.redis.get(statsKey);
    if (!statsData) return;

    const stats: PlayerStats = JSON.parse(statsData);
    
    // Ajouter le niveau aux niveaux complétés s'il n'y est pas déjà
    if (!stats.levels_completed.includes(level)) {
      stats.levels_completed.push(level);
    }

    // Mettre à jour les étoiles (garder le meilleur score)
    const currentStars = stats.stars_per_level[level] || 0;
    stats.stars_per_level[level] = Math.max(currentStars, stars);

    // Calculer le nouveau score global
    const newGlobalScore = Object.values(stats.stars_per_level).reduce((sum: number, s: number) => sum + s, 0);
    stats.score_global = newGlobalScore;

    // Sauvegarder les stats
    await this.redis.set(statsKey, JSON.stringify(stats));

    // Mettre à jour le score dans le joueur
    const playerData = await this.redis.get(playerKey);
    if (playerData) {
      const player: Player = JSON.parse(playerData);
      player.score_global = newGlobalScore;
      await this.redis.set(playerKey, JSON.stringify(player));
      
      // Mettre à jour le leaderboard
      await this.redis.zAdd(this.getGlobalLeaderboardKey(), {
        member: redditId,
        score: newGlobalScore
      });
    }
  }

  // Récupérer le leaderboard global
  async getGlobalLeaderboard(limit: number = 10): Promise<Array<{player: Player, score: number}>> {
    const leaderboardData = await this.redis.zRange(
      this.getGlobalLeaderboardKey(),
      0,
      limit - 1,
      { by: 'rank', reverse: true }
    );

    const results = [];
    for (const item of leaderboardData) {
      const player = await this.getPlayer(item.member);
      if (player) {
        results.push({
          player,
          score: item.score
        });
      }
    }

    return results;
  }

  // Récupérer les infos du joueur actuel depuis Reddit
  async getCurrentPlayerInfo(): Promise<CreatePlayerData | null> {
    try {
      const currentUser = await this.reddit.getCurrentUser();
      if (!currentUser) return null;

      // Obtenir l'avatar URL si disponible
      let avatarUrl = '';
      try {
        const avatarResult = await currentUser.getSnoovatarUrl();
        avatarUrl = avatarResult || '';
      } catch (error) {
        console.log('Could not get avatar URL:', error);
      }

      return {
        reddit_id: currentUser.id,
        username: currentUser.username,
        avatar_url: avatarUrl
      };
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  // Initialiser un joueur lors de sa première visite sur la page des niveaux
  async initializePlayerOnLevelsPage(): Promise<Player | null> {
    const currentPlayerInfo = await this.getCurrentPlayerInfo();
    if (!currentPlayerInfo) return null;

    return await this.createOrUpdatePlayer(currentPlayerInfo);
  }
}
