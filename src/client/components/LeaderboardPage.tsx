import { useEffect, useState } from 'react';
import { useLeaderboard } from '../hooks/useLeaderboard';

interface LeaderboardPageProps {
  onHomeClick: () => void;
}

type LeaderboardType = 'total_score';

interface GameLeaderboard {
  game_name: string;
  players: Array<{
    player: any;
    score: number;
    stage_id: number;
  }>;
}

export const LeaderboardPage = ({ onHomeClick }: LeaderboardPageProps) => {
  const { leaderboard, loading, error, fetchLeaderboard } = useLeaderboard();
  const [activeTab] = useState<LeaderboardType>('total_score');
  const [totalScoreLeaderboard, setTotalScoreLeaderboard] = useState<Array<{ player: { reddit_id: string; username: string; etage_actuel: number; avatar_url?: string }; score: number }>>([]);
  const [loadingTotalScore, setLoadingTotalScore] = useState(false);

  useEffect(() => {
    fetchLeaderboard();
    fetchTotalScoreLeaderboard();
  }, []);

  const fetchTotalScoreLeaderboard = async () => {
    if (loadingTotalScore) return; // Prevent multiple simultaneous calls
    setLoadingTotalScore(true);
    try {
      // Get all progressions
      const progressionsResponse = await fetch('/api/admin/progressions');
      const progressionsResult = await progressionsResponse.json();
      
      // Extract the data array from the response
      const progressions = progressionsResult?.data || progressionsResult;
      
      if (!Array.isArray(progressions)) {
        console.error('Progressions data is not an array:', progressions);
        setTotalScoreLeaderboard([]);
        return;
      }

      // Aggregate total score per player (sum of all progression scores)
      const totals: Record<string, number> = {};
      for (const p of progressions) {
        const pr = p as { joueur_id?: string; score?: number };
        if (!pr.joueur_id || typeof pr.score !== 'number') continue;
        totals[pr.joueur_id] = (totals[pr.joueur_id] || 0) + pr.score;
      }

      const entries = Object.entries(totals);
      
      // Get all players at once
      const playersResponse = await fetch('/api/admin/players');
      const playersResult = await playersResponse.json();
      const allPlayers = playersResult?.data || playersResult;
      
      if (!Array.isArray(allPlayers)) {
        console.error('Players data is not an array:', allPlayers);
        setTotalScoreLeaderboard([]);
        return;
      }
      
      // Create a map for quick player lookup
      const playersMap = new Map<string, any>();
      allPlayers.forEach((player: any) => {
        if (player?.reddit_id) {
          playersMap.set(player.reddit_id, player);
        }
      });
      
      // Build results using the players map
      const results: Array<{ player: { reddit_id: string; username: string; etage_actuel: number; avatar_url?: string }; score: number }> = [];
      for (const [joueur_id, score] of entries) {
        const player = playersMap.get(joueur_id);
        const safePlayer = {
          reddit_id: player?.reddit_id ?? joueur_id,
          username: player?.username ?? 'Unknown',
          etage_actuel: typeof player?.etage_actuel === 'number' ? player.etage_actuel : 0,
          avatar_url: player?.avatar_url
        };
        results.push({ player: safePlayer, score });
      }

      // Sort by total score (sum of progressions) descending
      results.sort((a, b) => b.score - a.score);
      setTotalScoreLeaderboard(results);
    } catch (error) {
      console.error('Error fetching total score leaderboard:', error);
      setTotalScoreLeaderboard([]);
    } finally {
      setLoadingTotalScore(false);
    }
  };

  // removed other leaderboards; only Total Score is displayed

  return (
    <div className="fixed inset-0 w-full h-full relative">
      {/* Background image as img element (like HomePage and LoadingScreen) */}
      <img 
        src="/leaderboard.jpg"
        alt="Leaderboard background"
        className="absolute inset-0 w-full h-full object-cover"
        onError={(e) => {
          console.error('Failed to load leaderboard.jpg');
          // Fallback to a solid background
          e.currentTarget.style.display = 'none';
        }}
        onLoad={() => console.log('Leaderboard background loaded successfully')}
      />
      
      {/* Content container */}
      <div className="absolute inset-0 overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 w-full">
          <button
            onClick={onHomeClick}
            className="px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-800 text-white rounded-lg hover:from-gray-500 hover:to-gray-700 transition-all duration-300 flex items-center gap-2"
          >
            <span className="text-lg">🏠</span>
            Home
          </button>
          
          <div className="text-center">
            <h1 className="text-2xl md:text-4xl font-bold text-white">
              🏆 LEADERBOARD
            </h1>
            <p className="text-sm md:text-lg text-gray-300 mt-2">
              Player Rankings
            </p>
          </div>
          
          <div className="w-20"></div> {/* Spacer */}
        </div>

        {/* Navigation Tabs - only Total Score retained */}
        <div className="px-4 md:px-6 mb-6">
          <div className="bg-black bg-opacity-20 rounded-lg p-1 max-w-4xl mx-auto">
            <div className="grid grid-cols-1 gap-1">
              <button
                className={`px-3 py-2 rounded-md text-sm font-medium transition-all bg-yellow-600 text-white shadow-lg`}
              >
                 Total Score
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 md:p-6 max-w-4xl mx-auto w-full">
        {(loading || loadingTotalScore) && (
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
            Loading leaderboard...
          </div>
        )}

        {error && (
          <div className="text-center text-red-400">
            <p>Error loading leaderboard:</p>
            <p className="text-sm mt-2">{error}</p>
            <button 
              onClick={fetchLeaderboard}
              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Total Score Ranking */}
        {!loading && !error && !loadingTotalScore && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white text-center mb-6"> Total Score Ranking</h2>
            {totalScoreLeaderboard.length === 0 ? (
              <div className="text-center text-gray-400">
                <p>No players in the leaderboard yet.</p>
              </div>
            ) : (
              totalScoreLeaderboard.map((entry, index) => (
                <div 
                  key={entry.player.reddit_id}
                  className={`p-4 rounded-lg ${
                    index === 0 
                      ? 'bg-gradient-to-r from-yellow-600 to-yellow-500 border-2 border-yellow-400' 
                      : index === 1 
                      ? 'bg-gradient-to-r from-gray-500 to-gray-400 border-2 border-gray-300'
                      : index === 2
                      ? 'bg-gradient-to-r from-orange-600 to-orange-500 border-2 border-orange-400'
                      : 'bg-gradient-to-r from-purple-700 to-purple-600 border border-purple-500'
                  } transition-all duration-300 hover:scale-[1.02] bg-opacity-90`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-black bg-opacity-20 text-white font-bold text-lg">
                        {index === 0 && '🥇'}
                        {index === 1 && '🥈'}
                        {index === 2 && '🥉'}
                        {index > 2 && `#${index + 1}`}
                      </div>
                      {entry.player.avatar_url ? (
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-black/30">
                          <img
                            src={`/Avatar/${entry.player.avatar_url}`}
                            alt={entry.player.username}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold">
                          {entry.player.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="text-white font-bold text-lg">
                          {entry.player.username}
                        </div>
                        <div className="text-gray-200 text-sm">
                          Stage {entry.player.etage_actuel}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-xl">
                        {entry.score.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        
      </div>
      </div>
    </div>
  );
};