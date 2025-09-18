import { useEffect, useState } from 'react';
import { useLeaderboard } from '../hooks/useLeaderboard';

interface LeaderboardPageProps {
  onHomeClick: () => void;
}

type LeaderboardType = 'total_score' | 'level_ranking' | 'stage_reached';

interface LevelLeaderboard {
  level_id: number;
  level_name: string;
  players: Array<{
    player: unknown;
    score: number;
    stage_id: number;
  }>;
}

export const LeaderboardPage = ({ onHomeClick }: LeaderboardPageProps) => {
  const { leaderboard, loading, error, fetchLeaderboard } = useLeaderboard();
  const [activeTab, setActiveTab] = useState<LeaderboardType>('total_score');
  const [levelLeaderboards, setLevelLeaderboards] = useState<LevelLeaderboard[]>([]);
  const [loadingLevels, setLoadingLevels] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [availableLevels, setAvailableLevels] = useState<Array<{id: number, name: string}>>([]);
  const [totalLeaderboard, setTotalLeaderboard] = useState<Array<{ player: { reddit_id: string; username: string; etage_actuel: number }; score: number }>>([]);
  const [loadingTotal, setLoadingTotal] = useState(false);

  useEffect(() => {
    void fetchLeaderboard();
    if (activeTab === 'level_ranking') {
      void fetchAvailableLevels();
    }
    if (activeTab === 'total_score') {
      void fetchTotalLeaderboard();
    }
  }, [activeTab, fetchLeaderboard]);

  useEffect(() => {
    if (selectedLevel && activeTab === 'level_ranking') {
      void fetchLevelLeaderboards();
    }
  }, [selectedLevel, activeTab]);

  const fetchAvailableLevels = async () => {
    try {
      const stagesResponse = await fetch('/api/stages');
      const stagesData = await stagesResponse.json();
      const stages = stagesData?.data || stagesData;
      
      if (!Array.isArray(stages)) {
        console.error('Stages data is not an array:', stages);
        return;
      }
      
      // Group by level and get unique levels
      const levelMap = new Map<number, string>();
      stages.forEach((stage: unknown) => {
        const stageData = stage as { niveau_id?: number; nom_niveau?: string };
        if (stageData.niveau_id && stageData.nom_niveau) {
          levelMap.set(stageData.niveau_id, stageData.nom_niveau);
        }
      });
      
      const levels = Array.from(levelMap.entries()).map(([id, name]) => ({ id, name }));
      setAvailableLevels(levels);
      
      // Select first level by default
      if (levels.length > 0 && levels[0]?.id) {
        setSelectedLevel(levels[0].id);
      }
    } catch (error) {
      console.error('Error fetching available levels:', error);
    }
  };

  const fetchLevelLeaderboards = async () => {
    if (!selectedLevel) return;
    
    setLoadingLevels(true);
    try {
      // Get stages for the selected level
      const stagesResponse = await fetch('/api/stages');
      const stagesData = await stagesResponse.json();
      const stages = stagesData?.data || stagesData;
      
      if (!Array.isArray(stages)) {
        console.error('Stages data is not an array:', stages);
        return;
      }
      
      // Filter stages for the selected level
      const levelStages = stages.filter((stage: unknown) => {
        const stageData = stage as { niveau_id?: number };
        return stageData.niveau_id === selectedLevel;
      });
      
      if (levelStages.length === 0) {
        setLevelLeaderboards([]);
        return;
      }
      
      // Get progressions
      const progressionsResponse = await fetch('/api/admin/progressions');
      const progressions = await progressionsResponse.json();
      
      if (!Array.isArray(progressions)) {
        console.error('Progressions response is not an array');
        return;
      }
      
      // Filter progressions for this level's stages
      const levelProgressions = progressions.filter((p: unknown) => {
        const progression = p as { etage_id?: number };
        return levelStages.some((stage: unknown) => {
          const stageData = stage as { id?: number };
          return stageData.id === progression.etage_id;
        });
      });
      
      // Group by player and calculate best score
      const playerScores: { [key: string]: { score: number; stage_id: number; player: unknown } } = {};
      for (const progression of levelProgressions) {
        const progressionData = progression as { joueur_id?: string; score?: number; etage_id?: number };
        if (!progressionData.joueur_id || !progressionData.score || !progressionData.etage_id) continue;
        
        const currentPlayerScore = playerScores[progressionData.joueur_id];
        if (!currentPlayerScore || currentPlayerScore.score < progressionData.score) {
          try {
            const playerResponse = await fetch(`/api/admin/players/${progressionData.joueur_id}`);
            const player = await playerResponse.json();
            playerScores[progressionData.joueur_id] = {
              score: progressionData.score,
              stage_id: progressionData.etage_id,
              player
            };
          } catch (e) {
            console.warn('Player not found:', progressionData.joueur_id);
          }
        }
      }
      
      const levelName = availableLevels.find(l => l.id === selectedLevel)?.name || `Niveau ${selectedLevel}`;
      setLevelLeaderboards([{
        level_id: selectedLevel,
        level_name: levelName,
        players: Object.values(playerScores)
          .sort((a, b) => b.score - a.score)
          .slice(0, 10)
      }]);
    } catch (error) {
      console.error('Error fetching level leaderboards:', error);
    } finally {
      setLoadingLevels(false);
    }
  };

  const fetchTotalLeaderboard = async () => {
    setLoadingTotal(true);
    try {
      const progressionsResponse = await fetch('/api/admin/progressions');
      const progressions = await progressionsResponse.json();
      if (!Array.isArray(progressions)) {
        console.error('Progressions response is not an array');
        setTotalLeaderboard([]);
        return;
      }

      // Aggregate total score per player
      const totals: Record<string, number> = {};
      for (const p of progressions) {
        const pr = p as { joueur_id?: string; score?: number };
        if (!pr.joueur_id || typeof pr.score !== 'number') continue;
        totals[pr.joueur_id] = (totals[pr.joueur_id] || 0) + pr.score;
      }

      const entries = Object.entries(totals);
      // Fetch players details sequentially (small sets) or in limited parallel
      const results: Array<{ player: { reddit_id: string; username: string; etage_actuel: number }; score: number }> = [];
      for (const [joueur_id, score] of entries) {
        try {
          const playerRes = await fetch(`/api/admin/players/${joueur_id}`);
          const player = await playerRes.json();
          const safePlayer = {
            reddit_id: player?.reddit_id ?? joueur_id,
            username: player?.username ?? 'Unknown',
            etage_actuel: typeof player?.etage_actuel === 'number' ? player.etage_actuel : 0
          };
          results.push({ player: safePlayer, score });
        } catch (e) {
          results.push({ player: { reddit_id: joueur_id, username: 'Unknown', etage_actuel: 0 }, score });
        }
      }

      results.sort((a, b) => b.score - a.score);
      setTotalLeaderboard(results);
    } catch (error) {
      console.error('Error fetching total leaderboard:', error);
      setTotalLeaderboard([]);
    } finally {
      setLoadingTotal(false);
    }
  };

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
          ← Back
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

        {/* Navigation Tabs */}
        <div className="px-4 md:px-6 mb-6">
          <div className="bg-black bg-opacity-20 rounded-lg p-1 max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-1">
              <button
                onClick={() => setActiveTab('total_score')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'total_score'
                    ? 'bg-yellow-600 text-white shadow-lg'
                    : 'text-gray-300 hover:text-slate-900 hover:bg-white hover:bg-opacity-10'
                }`}
              >
                🎯 Score Total
              </button>
              <button
                onClick={() => setActiveTab('level_ranking')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'level_ranking'
                    ? 'bg-yellow-600 text-white shadow-lg'
                    : 'text-gray-300 hover:text-slate-900 hover:bg-white hover:bg-opacity-10'
                }`}
              >
                🏗️ Classement par Niveau
              </button>
              <button
                onClick={() => setActiveTab('stage_reached')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'stage_reached'
                    ? 'bg-yellow-600 text-white shadow-lg'
                    : 'text-gray-300 hover:text-slate-900 hover:bg-white hover:bg-opacity-10'
                }`}
              >
                📈 Étage Atteint
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 md:p-6 max-w-4xl mx-auto w-full">
        {((activeTab === 'total_score' && loadingTotal) || (activeTab === 'level_ranking' && loadingLevels) || loading) && (
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
        {!error && activeTab === 'total_score' && !loadingTotal && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white text-center mb-6">🎯 Classement par Score Total</h2>
            {totalLeaderboard.length === 0 ? (
              <div className="text-center text-gray-400">
                <p>No players in the leaderboard yet.</p>
              </div>
            ) : (
              totalLeaderboard.map((entry, index) => (
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
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold">
                        {entry.player.username.charAt(0).toUpperCase()}
                      </div>
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
                      <span className="text-yellow-300 text-2xl">🎯</span>
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

        {/* Level Ranking */}
        {!loading && !error && activeTab === 'level_ranking' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white text-center mb-6">🏗️ Classement par Niveau</h2>
            
            {/* Level Selection */}
            {availableLevels.length > 0 && (
              <div className="mb-6">
                <label className="block text-white text-sm font-medium mb-2">Sélectionner un niveau :</label>
                <select
                  value={selectedLevel || ''}
                  onChange={(e) => setSelectedLevel(Number(e.target.value))}
                  className="w-full max-w-md mx-auto block px-4 py-2 bg-black bg-opacity-50 text-white rounded-lg border border-gray-600 focus:border-yellow-500 focus:outline-none"
                >
                  {availableLevels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {loadingLevels ? (
              <div className="text-center text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                Loading level rankings...
              </div>
            ) : levelLeaderboards.length === 0 ? (
              <div className="text-center text-gray-400">
                <p>Aucun classement disponible pour ce niveau.</p>
              </div>
            ) : (
              levelLeaderboards.map((levelBoard) => (
                <div key={levelBoard.level_id} className="space-y-4">
                  <h3 className="text-xl font-bold text-white text-center">
                    🏗️ {levelBoard.level_name}
                  </h3>
                  {levelBoard.players.length === 0 ? (
                    <div className="text-center text-gray-400 py-4">
                      <p>Aucun score enregistré pour ce niveau.</p>
                    </div>
                  ) : (
                    levelBoard.players.map((entry, index: number) => (
                      <div 
                        key={(entry.player as { reddit_id?: string }).reddit_id || `player-${index}`}
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
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold">
                              {(() => {
                                const player = entry.player as { username?: string };
                                return player.username?.charAt(0).toUpperCase() || '?';
                              })()}
                            </div>
                            <div>
                              <div className="text-white font-bold text-lg">
                                {(() => {
                                  const player = entry.player as { username?: string };
                                  return player.username || 'Joueur inconnu';
                                })()}
                              </div>
                              <div className="text-gray-200 text-sm">
                                Stage {entry.stage_id}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-yellow-300 text-2xl">🏗️</span>
                            <span className="text-white font-bold text-xl">
                              {entry.score.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Stage Reached Ranking */}
        {!loading && !error && activeTab === 'stage_reached' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white text-center mb-6">📈 Classement par Étage Atteint</h2>
            {leaderboard.length === 0 ? (
              <div className="text-center text-gray-400">
                <p>Aucun joueur dans le classement pour le moment.</p>
              </div>
            ) : (
              [...leaderboard]
                .sort((a, b) => b.player.etage_actuel - a.player.etage_actuel)
                .map((entry, index) => (
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
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold">
                          {entry.player.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-white font-bold text-lg">
                            {entry.player.username}
                          </div>
                          <div className="text-gray-200 text-sm">
                            Score Total: {entry.score.toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-blue-300 text-2xl">📈</span>
                        <span className="text-white font-bold text-xl">
                          Étage {entry.player.etage_actuel}
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
