import { useEffect, useState } from 'react';
import { useLeaderboard } from '../hooks/useLeaderboard';

interface LeaderboardPageProps {
  onHomeClick: () => void;
}

type LeaderboardType = 'total_score' | 'score_by_game' | 'current_stage' | 'games_ranking';

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
  const [activeTab, setActiveTab] = useState<LeaderboardType>('total_score');
  const [gameLeaderboards, setGameLeaderboards] = useState<GameLeaderboard[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);

  useEffect(() => {
    fetchLeaderboard();
    if (activeTab === 'games_ranking') {
      fetchGameLeaderboards();
    }
  }, [activeTab]);

  const fetchGameLeaderboards = async () => {
    setLoadingGames(true);
    try {
      // Get stages to know the games
      const stagesResponse = await fetch('/api/stages');
      const stagesData = await stagesResponse.json();
      console.log('Stages response:', stagesData);
      
      // Extract the data array from the response
      const stages = stagesData?.data || stagesData;
      
      // Check if stages is an array
      if (!Array.isArray(stages)) {
        console.error('Stages data is not an array:', stages);
        return;
      }
      
      // Group by game name and get best scores
      const gameGroups: { [key: string]: any[] } = {};
      stages.forEach((stage: any) => {
        if (!gameGroups[stage.nom]) {
          gameGroups[stage.nom] = [];
        }
        gameGroups[stage.nom]!.push(stage);
      });

      // For each game, get progressions
      const gameLeaderboardsData: GameLeaderboard[] = [];
      for (const [gameName, gameStages] of Object.entries(gameGroups)) {
        try {
          const progressionsResponse = await fetch('/api/admin/progressions');
          const progressions = await progressionsResponse.json();
          
          // Check if progressions is an array
          if (!Array.isArray(progressions)) {
            console.error('Progressions response is not an array for game:', gameName);
            continue;
          }
          
          // Filter progressions for this game
          const gameProgressions = progressions.filter((p: any) => 
            gameStages.some((stage: any) => stage.id === p.etage_id)
          );
          
          // Group by player and calculate best score
          const playerScores: { [key: string]: { score: number; stage_id: number; player: any } } = {};
          for (const progression of gameProgressions) {
            const currentPlayerScore = playerScores[progression.joueur_id];
            if (!currentPlayerScore || currentPlayerScore.score < progression.score) {
              // Get player info
              try {
                const playerResponse = await fetch(`/api/admin/players/${progression.joueur_id}`);
                const player = await playerResponse.json();
                playerScores[progression.joueur_id] = {
                  score: progression.score,
                  stage_id: progression.etage_id,
                  player
                };
              } catch (e) {
                console.warn('Player not found:', progression.joueur_id);
              }
            }
          }
          
          gameLeaderboardsData.push({
            game_name: gameName,
            players: Object.values(playerScores)
              .sort((a, b) => b.score - a.score)
              .slice(0, 10)
          });
        } catch (e) {
          console.error('Error fetching progressions for game:', gameName, e);
        }
      }
      
      setGameLeaderboards(gameLeaderboardsData);
    } catch (error) {
      console.error('Error fetching game leaderboards:', error);
    } finally {
      setLoadingGames(false);
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

        {/* Navigation Tabs */}
        <div className="px-4 md:px-6 mb-6">
          <div className="bg-black bg-opacity-20 rounded-lg p-1 max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
            <button
              onClick={() => setActiveTab('total_score')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'total_score'
                  ? 'bg-yellow-600 text-white shadow-lg'
                  : 'text-gray-300 hover:text-white hover:bg-white hover:bg-opacity-10'
              }`}
            >
              🎯 Total Score
            </button>
            <button
              onClick={() => setActiveTab('score_by_game')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'score_by_game'
                  ? 'bg-yellow-600 text-white shadow-lg'
                  : 'text-gray-300 hover:text-white hover:bg-white hover:bg-opacity-10'
              }`}
            >
              ⭐ Score by Game
            </button>
            <button
              onClick={() => setActiveTab('current_stage')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'current_stage'
                  ? 'bg-yellow-600 text-white shadow-lg'
                  : 'text-gray-300 hover:text-white hover:bg-white hover:bg-opacity-10'
              }`}
            >
              🏗️ Current Stage
            </button>
            <button
              onClick={() => setActiveTab('games_ranking')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'games_ranking'
                  ? 'bg-yellow-600 text-white shadow-lg'
                  : 'text-gray-300 hover:text-white hover:bg-white hover:bg-opacity-10'
              }`}
            >
              🎮 Games Ranking
            </button>
          </div>
        </div>
      </div>

        {/* Content */}
        <div className="flex-1 p-4 md:p-6 max-w-4xl mx-auto w-full">
        {(loading || (activeTab === 'games_ranking' && loadingGames)) && (
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
        {!loading && !error && activeTab === 'total_score' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white text-center mb-6">🎯 Total Score Ranking</h2>
            {leaderboard.length === 0 ? (
              <div className="text-center text-gray-400">
                <p>No players in the leaderboard yet.</p>
              </div>
            ) : (
              leaderboard.map((entry, index) => (
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

        {/* Score by Game Ranking */}
        {!loading && !error && activeTab === 'score_by_game' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white text-center mb-6">⭐ Score by Game Ranking</h2>
            {leaderboard.length === 0 ? (
              <div className="text-center text-gray-400">
                <p>No players in the leaderboard yet.</p>
              </div>
            ) : (
              [...leaderboard]
                .sort((a, b) => b.player.score_global - a.player.score_global)
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
                            Stage {entry.player.etage_actuel}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-yellow-300 text-2xl">⭐</span>
                        <span className="text-white font-bold text-xl">
                          {entry.player.score_global.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        )}

        {/* Current Stage Ranking */}
        {!loading && !error && activeTab === 'current_stage' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white text-center mb-6">🏗️ Current Stage Ranking</h2>
            {leaderboard.length === 0 ? (
              <div className="text-center text-gray-400">
                <p>No players in the leaderboard yet.</p>
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
                            Total Score: {entry.score.toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-blue-300 text-2xl">🏗️</span>
                        <span className="text-white font-bold text-xl">
                          Stage {entry.player.etage_actuel}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        )}

        {/* Games Ranking */}
        {!loading && !error && activeTab === 'games_ranking' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white text-center mb-6">🎮 Games Ranking</h2>
            {loadingGames ? (
              <div className="text-center text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                Loading game rankings...
              </div>
            ) : gameLeaderboards.length === 0 ? (
              <div className="text-center text-gray-400">
                <p>No game rankings available.</p>
              </div>
            ) : (
              gameLeaderboards.map((gameBoard) => (
                <div key={gameBoard.game_name} className="bg-black bg-opacity-20 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-white mb-4 text-center">
                    🎮 {gameBoard.game_name}
                  </h3>
                  <div className="space-y-3">
                    {gameBoard.players.length === 0 ? (
                      <div className="text-center text-gray-400 py-4">
                        <p>No scores recorded for this game.</p>
                      </div>
                    ) : (
                      gameBoard.players.map((entry, index) => (
                        <div 
                          key={entry.player.reddit_id}
                          className={`p-3 rounded-lg ${
                            index === 0 
                              ? 'bg-gradient-to-r from-yellow-600 to-yellow-500' 
                              : index === 1 
                              ? 'bg-gradient-to-r from-gray-500 to-gray-400'
                              : index === 2
                              ? 'bg-gradient-to-r from-orange-600 to-orange-500'
                              : 'bg-gradient-to-r from-purple-700 to-purple-600'
                          } bg-opacity-80`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-black bg-opacity-20 text-white font-bold text-sm">
                                {index === 0 && '🥇'}
                                {index === 1 && '🥈'}
                                {index === 2 && '🥉'}
                                {index > 2 && `#${index + 1}`}
                              </div>
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                                {entry.player.username.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="text-white font-bold">
                                  {entry.player.username}
                                </div>
                                <div className="text-gray-200 text-xs">
                                  Stage {entry.stage_id}
                                </div>
                              </div>
                            </div>
                            <div className="text-white font-bold">
                              {entry.score.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
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
