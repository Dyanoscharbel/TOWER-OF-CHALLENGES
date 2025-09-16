import { redis } from '@devvit/web/server';
import { Player } from '../../shared/types/player.js';
import { Stage, CreateStageData, UpdateStageData } from '../../shared/types/stage.js';
import { Progression, CreateProgressionData, UpdateProgressionData } from '../../shared/types/progression.js';

export class AdminService {
  private redis = redis;

  // === GESTION DES JOUEURS ===
  
  async getAllPlayers(): Promise<Player[]> {
    try {
      // Utiliser le leaderboard global qui contient déjà tous les reddit_ids
      const leaderboardData = await this.redis.zRange('leaderboard:global', 0, -1);
      
      const players: Player[] = [];
      
      for (const item of leaderboardData) {
        const playerData = await this.redis.get(`player:${item.member}`);
        if (playerData) {
          const player: Player = JSON.parse(playerData);
          players.push(player);
        }
      }
      
      return players.sort((a, b) => a.username.localeCompare(b.username));
    } catch (error) {
      console.error('Error getting all players:', error);
      return [];
    }
  }

  async updatePlayer(redditId: string, playerData: Partial<Player>): Promise<boolean> {
    try {
      const playerKey = `player:${redditId}`;
      const currentData = await this.redis.get(playerKey);
      
      if (!currentData) return false;

      const currentPlayer: Player = JSON.parse(currentData);
      const updatedPlayer: Player = {
        reddit_id: currentPlayer.reddit_id,
        username: playerData.username ?? currentPlayer.username,
        avatar_url: playerData.avatar_url ?? currentPlayer.avatar_url,
        score_global: playerData.score_global ?? currentPlayer.score_global,
        etage_actuel: playerData.etage_actuel ?? currentPlayer.etage_actuel,
        created_at: currentPlayer.created_at
      };

      await this.redis.set(playerKey, JSON.stringify(updatedPlayer));
      
      // Mettre à jour aussi les stats si nécessaire
      if (playerData.score_global !== undefined || playerData.etage_actuel !== undefined) {
        const statsKey = `player_stats:${redditId}`;
        const statsData = await this.redis.get(statsKey);
        
        if (statsData) {
          const stats = JSON.parse(statsData);
          if (playerData.score_global !== undefined) {
            stats.score_global = playerData.score_global;
          }
          if (playerData.etage_actuel !== undefined) {
            stats.etage_actuel = playerData.etage_actuel;
          }
          await this.redis.set(statsKey, JSON.stringify(stats));
        }
      }

      return true;
    } catch (error) {
      console.error('Error updating player:', error);
      return false;
    }
  }

  // === GESTION DES ÉTAGES ===

  async getAllStages(): Promise<Stage[]> {
    try {
      const stagesData = await this.redis.get('stages:all');
      return stagesData ? JSON.parse(stagesData) : [];
    } catch (error) {
      console.error('Error getting all stages:', error);
      return [];
    }
  }

  async createStage(stageData: CreateStageData): Promise<Stage | null> {
    try {
      const stages = await this.getAllStages();
      
      // Vérifier si un étage existe déjà à ce niveau
      const existingStageAtLevel = stages.find(s => s.niveau === stageData.niveau);
      if (existingStageAtLevel) {
        throw new Error(`Un étage existe déjà au niveau ${stageData.niveau}`);
      }
      
      const newId = Math.max(0, ...stages.map(s => s.id)) + 1;
      
      const newStage: Stage = {
        id: newId,
        ...stageData
      };

      const updatedStages = [...stages, newStage];
      await this.redis.set('stages:all', JSON.stringify(updatedStages));

      return newStage;
    } catch (error) {
      console.error('Error creating stage:', error);
      return null;
    }
  }

  async updateStage(stageId: number, stageData: UpdateStageData): Promise<boolean> {
    try {
      console.log('updateStage called with:', { stageId, stageData });
      
      const stages = await this.getAllStages();
      console.log('Current stages:', stages.map(s => ({ id: s.id, nom: s.nom })));
      
      const stageIndex = stages.findIndex(s => s.id === stageId);
      console.log('Stage index found:', stageIndex);
      
      if (stageIndex === -1) {
        console.log('Stage not found with ID:', stageId);
        return false;
      }

      const currentStage = stages[stageIndex];
      if (!currentStage) {
        console.log('Current stage is null/undefined');
        return false;
      }

      // Si le niveau change, vérifier qu'aucun autre étage n'occupe ce niveau
      if (stageData.niveau && stageData.niveau !== currentStage.niveau) {
        const existingStageAtLevel = stages.find(s => s.niveau === stageData.niveau && s.id !== stageId);
        if (existingStageAtLevel) {
          throw new Error(`Un étage existe déjà au niveau ${stageData.niveau}`);
        }
      }

      const updatedStage = { 
        id: currentStage.id,
        nom: stageData.nom ?? currentStage.nom,
        description: stageData.description ?? currentStage.description,
        regles: stageData.regles ?? currentStage.regles,
        niveau: stageData.niveau ?? currentStage.niveau,
        target_score: stageData.target_score ?? currentStage.target_score
      };
      
      console.log('Updated stage:', updatedStage);
      
      stages[stageIndex] = updatedStage;
      await this.redis.set('stages:all', JSON.stringify(stages));
      
      console.log('Stage updated successfully');
      return true;
    } catch (error) {
      console.error('Error updating stage:', error);
      return false;
    }
  }

  async deleteStage(stageId: number): Promise<boolean> {
    try {
      console.log('Deleting stage with ID:', stageId);
      const stages = await this.getAllStages();
      console.log('Current stages before deletion:', stages.map(s => ({ id: s.id, nom: s.nom })));
      
      const filteredStages = stages.filter(s => s.id !== stageId);
      console.log('Filtered stages after deletion:', filteredStages.map(s => ({ id: s.id, nom: s.nom })));
      
      if (filteredStages.length === stages.length) {
        console.log('No stage found with ID:', stageId);
        return false;
      }

      await this.redis.set('stages:all', JSON.stringify(filteredStages));
      console.log('Stage deleted successfully');

      // Supprimer aussi les progressions liées à cet étage
      await this.deleteProgressionsByStage(stageId);

      return true;
    } catch (error) {
      console.error('Error deleting stage:', error);
      return false;
    }
  }

  async clearAllStages(): Promise<boolean> {
    try {
      console.log('Clearing all stages...');
      
      // Vider la table des étages
      await this.redis.set('stages:all', JSON.stringify([]));
      
      // Vider aussi toutes les progressions liées aux étages
      await this.redis.set('progressions:all', JSON.stringify([]));
      
      console.log('All stages and progressions cleared successfully');
      return true;
    } catch (error) {
      console.error('Error clearing all stages:', error);
      return false;
    }
  }

  // === GESTION DES PROGRESSIONS ===

  async getAllProgressions(): Promise<Progression[]> {
    try {
      const progressionsData = await this.redis.get('progressions:all');
      return progressionsData ? JSON.parse(progressionsData) : [];
    } catch (error) {
      console.error('Error getting all progressions:', error);
      return [];
    }
  }

  async createProgression(progressionData: CreateProgressionData): Promise<Progression | null> {
    try {
      const progressions = await this.getAllProgressions();
      const newId = Math.max(0, ...progressions.map(p => p.id)) + 1;
      
      const newProgression: Progression = {
        id: newId,
        ...progressionData,
        completed: progressionData.completed ?? false,
        played_at: new Date().toISOString()
      };

      const updatedProgressions = [...progressions, newProgression];
      await this.redis.set('progressions:all', JSON.stringify(updatedProgressions));

      return newProgression;
    } catch (error) {
      console.error('Error creating progression:', error);
      return null;
    }
  }

  async updateProgression(progressionId: number, progressionData: UpdateProgressionData): Promise<boolean> {
    try {
      const progressions = await this.getAllProgressions();
      const progressionIndex = progressions.findIndex(p => p.id === progressionId);
      
      if (progressionIndex === -1) return false;

      const currentProgression = progressions[progressionIndex];
      if (!currentProgression) return false;

      progressions[progressionIndex] = { 
        id: currentProgression.id,
        joueur_id: currentProgression.joueur_id,
        etage_id: currentProgression.etage_id,
        score: progressionData.score ?? currentProgression.score,
        completed: progressionData.completed ?? currentProgression.completed,
        played_at: currentProgression.played_at
      };
      await this.redis.set('progressions:all', JSON.stringify(progressions));

      return true;
    } catch (error) {
      console.error('Error updating progression:', error);
      return false;
    }
  }

  async deleteProgressionsByStage(stageId: number): Promise<boolean> {
    try {
      const progressions = await this.getAllProgressions();
      const filteredProgressions = progressions.filter(p => p.etage_id !== stageId);
      
      await this.redis.set('progressions:all', JSON.stringify(filteredProgressions));
      return true;
    } catch (error) {
      console.error('Error deleting progressions by stage:', error);
      return false;
    }
  }

  async getProgressionsByPlayer(redditId: string): Promise<Progression[]> {
    try {
      const progressions = await this.getAllProgressions();
      // Assumons que joueur_id dans la progression correspond au reddit_id
      return progressions.filter(p => p.joueur_id.toString() === redditId);
    } catch (error) {
      console.error('Error getting progressions by player:', error);
      return [];
    }
  }

  // === MÉTHODES D'INITIALISATION ===

  async initializeDefaultStages(): Promise<void> {
    try {
      const existingStages = await this.getAllStages();
      
      if (existingStages.length === 0) {
        const defaultStages: CreateStageData[] = [
          {
            nom: "Premier Défi",
            description: "Votre premier pas dans la tour. Un niveau d'introduction pour vous familiariser avec les mécaniques.",
            regles: "Collectez tous les objets en moins de 60 secondes. Évitez les obstacles rouges.",
            niveau: 1,
            target_score: 1000
          },
          {
            nom: "Montée Rapide",
            description: "Le temps presse ! Montez rapidement en évitant les pièges qui ralentissent votre progression.",
            regles: "Atteignez le sommet en moins de 45 secondes. Chaque seconde restante donne des points bonus.",
            niveau: 2,
            target_score: 1500
          },
          {
            nom: "Labyrinthe Mystique",
            description: "Naviguez dans un labyrinthe complexe rempli de mystères et de trésors cachés.",
            regles: "Trouvez la sortie en collectant au moins 3 clés. Les murs bougent toutes les 10 secondes.",
            niveau: 3,
            target_score: 2000
          },
          {
            nom: "Combat de Boss",
            description: "Affrontez le gardien de l'étage dans un combat épique qui teste toutes vos compétences.",
            regles: "Battez le boss en moins de 90 secondes. Utilisez l'environnement à votre avantage.",
            niveau: 4,
            target_score: 2500
          },
          {
            nom: "Épreuve Ultime",
            description: "Le défi final de cette section de la tour. Seuls les plus déterminés y arriveront.",
            regles: "Survivez à 3 vagues d'ennemis. La difficulté augmente à chaque vague.",
            niveau: 5,
            target_score: 3000
          }
        ];

        for (const stageData of defaultStages) {
          await this.createStage(stageData);
        }

        console.log('Default stages initialized');
      }
    } catch (error) {
      console.error('Error initializing default stages:', error);
    }
  }

  async clearAllProgressions(): Promise<void> {
    try {
      // Vider toutes les progressions
      await this.redis.set('progressions:all', JSON.stringify([]));
      console.log('All progressions cleared successfully');
    } catch (error) {
      console.error('Error clearing all progressions:', error);
      throw error;
    }
  }

  // === STATISTIQUES ===

  async getAdminStats(): Promise<{
    totalPlayers: number;
    totalStages: number;
    totalProgressions: number;
    completedProgressions: number;
  }> {
    try {
      const [players, stages, progressions] = await Promise.all([
        this.getAllPlayers(),
        this.getAllStages(),
        this.getAllProgressions()
      ]);

      return {
        totalPlayers: players.length,
        totalStages: stages.length,
        totalProgressions: progressions.length,
        completedProgressions: progressions.filter(p => p.completed).length
      };
    } catch (error) {
      console.error('Error getting admin stats:', error);
      return {
        totalPlayers: 0,
        totalStages: 0,
        totalProgressions: 0,
        completedProgressions: 0
      };
    }
  }
}
