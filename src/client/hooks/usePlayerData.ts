import { useState } from 'react';
import { Player, PlayerStats } from '../../shared/types/player';

interface UsePlayerDataReturn {
  player: Player | null;
  stats: PlayerStats | null;
  loading: boolean;
  error: string | null;
  initializePlayer: () => Promise<void>;
  completeLevel: (level: number, stars: number) => Promise<void>;
  updateStage: (stage: number) => Promise<void>;
  refreshPlayerData: () => Promise<void>;
}

export const usePlayerData = (): UsePlayerDataReturn => {
  const [player, setPlayer] = useState<Player | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialiser le joueur
  const initializePlayer = async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/player/init');
      const result = await response.json();

      if (result.status === 'success') {
        setPlayer(result.data);
        // Récupérer aussi les stats
        await fetchPlayerStats(result.data.reddit_id);
      } else {
        setError(result.message || 'Failed to initialize player');
      }
    } catch (err) {
      setError('Network error during player initialization');
      console.error('Error initializing player:', err);
    } finally {
      setLoading(false);
    }
  };

  // Récupérer les stats d'un joueur
  const fetchPlayerStats = async (redditId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/player/${redditId}/stats`);
      const result = await response.json();

      if (result.status === 'success') {
        setStats(result.data);
      }
    } catch (err) {
      console.error('Error fetching player stats:', err);
    }
  };

  // Compléter un niveau
  const completeLevel = async (level: number, stars: number): Promise<void> => {
    if (!player) {
      setError('No player data available');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/player/${player.reddit_id}/complete-level`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ level, stars }),
      });

      const result = await response.json();

      if (result.status === 'success') {
        setPlayer(result.data);
        // Rafraîchir les stats
        await fetchPlayerStats(result.data.reddit_id);
      } else {
        setError(result.message || 'Failed to complete level');
      }
    } catch (err) {
      setError('Network error during level completion');
      console.error('Error completing level:', err);
    } finally {
      setLoading(false);
    }
  };

  // Mettre à jour l'étage actuel
  const updateStage = async (stage: number): Promise<void> => {
    if (!player) {
      setError('No player data available');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/player/${player.reddit_id}/update-stage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ stage }),
      });

      const result = await response.json();

      if (result.status === 'success') {
        setPlayer(result.data);
        // Rafraîchir les stats
        await fetchPlayerStats(result.data.reddit_id);
      } else {
        setError(result.message || 'Failed to update stage');
      }
    } catch (err) {
      setError('Network error during stage update');
      console.error('Error updating stage:', err);
    } finally {
      setLoading(false);
    }
  };

  // Rafraîchir les données du joueur
  const refreshPlayerData = async (): Promise<void> => {
    if (!player) return;

    try {
      const response = await fetch(`/api/player/${player.reddit_id}`);
      const result = await response.json();

      if (result.status === 'success') {
        setPlayer(result.data);
        await fetchPlayerStats(result.data.reddit_id);
      }
    } catch (err) {
      console.error('Error refreshing player data:', err);
    }
  };

  return {
    player,
    stats,
    loading,
    error,
    initializePlayer,
    completeLevel,
    updateStage,
    refreshPlayerData,
  };
};
