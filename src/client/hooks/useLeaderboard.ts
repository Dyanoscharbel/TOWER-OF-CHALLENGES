import { useState } from 'react';
import { Player } from '../../shared/types/player';

interface LeaderboardEntry {
  player: Player;
  score: number;
}

interface UseLeaderboardReturn {
  leaderboard: LeaderboardEntry[];
  loading: boolean;
  error: string | null;
  fetchLeaderboard: () => Promise<void>;
}

export const useLeaderboard = (): UseLeaderboardReturn => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/leaderboard');
      const result = await response.json();

      if (result.status === 'success') {
        setLeaderboard(result.data);
      } else {
        setError(result.message || 'Failed to fetch leaderboard');
      }
    } catch (err) {
      setError('Network error during leaderboard fetch');
      console.error('Error fetching leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  return {
    leaderboard,
    loading,
    error,
    fetchLeaderboard,
  };
};
