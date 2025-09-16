import React, { useState, useEffect, useCallback } from 'react';
import { Player } from '../../../shared/types/player';
import { Progression } from '../../../shared/types/progression';

interface ColorClickGameProps {
  onBack?: () => void;
}

interface ColorOption {
  name: string;
  color: string;
}

interface Stage {
  id: number;
  nom: string;
  description: string;
  regles: string;
  niveau: number;
  target_score: number;
}

const COLORS: ColorOption[] = [
  { name: 'Red', color: '#ef4444' },
  { name: 'Blue', color: '#3b82f6' },
  { name: 'Green', color: '#22c55e' },
  { name: 'Yellow', color: '#eab308' },
  { name: 'Purple', color: '#a855f7' },
  { name: 'Orange', color: '#f97316' },
];

const INITIAL_TIME_LIMIT = 3000; // Délai initial (3 secondes pour les 10 premières)
const POINTS_PER_CORRECT = 10;
const SPEED_BONUS_MULTIPLIER = 2;

const ColorClickGame: React.FC<ColorClickGameProps> = ({ onBack }) => {
  const [gameState, setGameState] = useState<'menu' | 'countdown' | 'playing' | 'gameOver'>('menu');
  const [currentColorWord, setCurrentColorWord] = useState<ColorOption>(COLORS[0]!);
  const [currentDisplayColor, setCurrentDisplayColor] = useState<ColorOption>(COLORS[0]!);
  const [correctAnswer, setCorrectAnswer] = useState<ColorOption>(COLORS[0]!);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(INITIAL_TIME_LIMIT);
  const [currentTimeLimit, setCurrentTimeLimit] = useState(INITIAL_TIME_LIMIT);
  const [streak, setStreak] = useState(0);
  const [answersCount, setAnswersCount] = useState(0);
  const [countdownTime, setCountdownTime] = useState(5);
  const [bestScore, setBestScore] = useState(() => {
    // Using in-memory storage instead of localStorage
    return 0;
  });
  const [gameData, setGameData] = useState<Stage | null>(null);
  const [loading, setLoading] = useState(true);
  const [playerData, setPlayerData] = useState<Player | null>(null);
  const [nextStageUnlocked, setNextStageUnlocked] = useState<boolean>(false);

  const generateRandomChallenge = useCallback(() => {
    // Choisir un mot de couleur aléatoire
    const wordIndex = Math.floor(Math.random() * COLORS.length);
    const wordColor = COLORS[wordIndex]!;
    
    // Choisir une couleur d'affichage aléatoire (peut être différente du mot)
    const displayIndex = Math.floor(Math.random() * COLORS.length);
    const displayColor = COLORS[displayIndex]!;
    
    setCurrentColorWord(wordColor);
    setCurrentDisplayColor(displayColor);
    
    // La bonne réponse est toujours la couleur dans laquelle le texte est affiché
    setCorrectAnswer(displayColor);
  }, []);

  // Fonction pour calculer le délai selon le nombre de réponses
  const getAnswerDelay = useCallback((answerCount: number) => {
    if (answerCount < 10) return 3000; // 3 secondes pour les 10 premières
    if (answerCount < 20) return 2000; // 2 secondes pour les 10 suivantes
    return 1000; // 1 seconde pour le reste
  }, []);

  const startGame = () => {
    setGameState('countdown');
    setCountdownTime(5);
    setScore(0);
    setStreak(0);
    setAnswersCount(0);
    const initialDelay = getAnswerDelay(0);
    setCurrentTimeLimit(initialDelay);
    setTimeLeft(initialDelay);
    setNextStageUnlocked(false);
    generateRandomChallenge();
  };

  const handleColorClick = (clickedColor: ColorOption) => {
    if (clickedColor.color === correctAnswer.color) {
      const timeBonus = Math.floor((timeLeft / currentTimeLimit) * SPEED_BONUS_MULTIPLIER);
      const points = POINTS_PER_CORRECT + timeBonus;
      setScore(prev => prev + points);
      setStreak(prev => prev + 1);
      setAnswersCount(prev => prev + 1);
      
      generateRandomChallenge();
      // Utiliser le nouveau délai basé sur le nombre de réponses
      const newDelay = getAnswerDelay(answersCount + 1);
      setCurrentTimeLimit(newDelay);
      setTimeLeft(newDelay);
    } else {
      endGame();
    }
  };

  const endGame = useCallback(async () => {
    setGameState('gameOver');
    if (score > bestScore) {
      setBestScore(score);
    }

    // Gérer la progression du joueur
    if (playerData && gameData) {
      try {
        const isPlayerAtStageLevel = playerData.etage_actuel === gameData.niveau;
        const hasReachedTargetScore = score >= gameData.target_score;

        if (isPlayerAtStageLevel && hasReachedTargetScore) {
          // Cas 1: Joueur au bon niveau ET score atteint -> débloquer l'étage suivant
          
          // 1. Mettre à jour le niveau du joueur
          const updatePlayerResponse = await fetch('/api/player/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              etage_actuel: playerData.etage_actuel + 1
            })
          });

          // 2. Créer une nouvelle progression
          const createProgressionResponse = await fetch('/api/progression/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              joueur_id: playerData.reddit_id,
              etage_id: gameData.id,
              score: score,
              completed: true
            })
          });

          if (updatePlayerResponse.ok && createProgressionResponse.ok) {
            setNextStageUnlocked(true);
            // Mettre à jour les données locales du joueur
            setPlayerData(prev => prev ? { ...prev, etage_actuel: prev.etage_actuel + 1 } : null);
          }

        } else if (playerData.etage_actuel > gameData.niveau) {
          // Cas 2: Joueur de niveau supérieur -> mettre à jour le score seulement si meilleur
          
          // D'abord récupérer la progression existante
          const getProgressionResponse = await fetch(`/api/progression?joueur_id=${playerData.reddit_id}&etage_id=${gameData.id}`);
          
          if (getProgressionResponse.ok) {
            const progressionResult = await getProgressionResponse.json();
            
            if (progressionResult.status === 'success' && progressionResult.data) {
              const existingProgression = progressionResult.data;
              
              // Mettre à jour seulement si le nouveau score est meilleur
              if (score > existingProgression.score) {
                const updateProgressionResponse = await fetch('/api/progression/update', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    joueur_id: playerData.reddit_id,
                    etage_id: gameData.id,
                    score: score
                  })
                });

                if (!updateProgressionResponse.ok) {
                  console.error('Failed to update progression score');
                }
              }
            } else {
              console.error('Failed to retrieve existing progression');
            }
          } else {
            console.error('Failed to fetch existing progression');
          }
        }
        // Cas 3: Joueur au bon niveau mais score insuffisant -> rien faire de spécial

      } catch (error) {
        console.error('Error handling game progression:', error);
      }
    }
  }, [score, bestScore, playerData, gameData]);

  const handleBackToMenu = () => {
    if (onBack) {
      // Pas de confirm() dans un environnement sandboxé - on appelle directement
      onBack();
    }
  };

  // Gestion du compte à rebours de préparation
  useEffect(() => {
    if (gameState === 'countdown' && countdownTime > 0) {
      const timer = setTimeout(() => {
        setCountdownTime(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (gameState === 'countdown' && countdownTime <= 0) {
      setGameState('playing');
    }
  }, [gameState, countdownTime]);

  useEffect(() => {
    if (gameState === 'playing' && timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft((prev: number) => prev - 50);
      }, 50);
      return () => clearTimeout(timer);
    } else if (gameState === 'playing' && timeLeft <= 0) {
      endGame();
    }
  }, [gameState, timeLeft, endGame]);

  // Charger les données du jeu depuis la base de données
  useEffect(() => {
    const fetchGameData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/stages');
        const data = await response.json();
        
        if (data.status === 'success' && Array.isArray(data.data)) {
          // Chercher le stage "Color Click Game"
          const colorClickStage = data.data.find((stage: Stage) => 
            stage.nom.toLowerCase().includes('color click game') || 
            stage.nom.toLowerCase().includes('color click') ||
            stage.niveau === 2 // D'après la base de données, c'est le niveau 2
          );
          
          if (colorClickStage) {
            setGameData(colorClickStage);
          }
        }
      } catch (error) {
        console.error('Erreur lors du chargement des données du jeu:', error);
      } finally {
        setLoading(false);
      }
    };

    const loadPlayerData = async () => {
      try {
        const response = await fetch('/api/player/init');
        const result = await response.json();
        
        if (result.status === 'success') {
          setPlayerData(result.data);
        } else {
          console.error('Failed to load player data:', result.message);
        }
      } catch (err) {
        console.error('Error loading player data:', err);
      }
    };

    fetchGameData();
    loadPlayerData();
  }, []);

  if (gameState === 'menu') {
    return (
      <div className="fixed inset-0 w-full h-full relative">
        {/* Utiliser arena-background.png comme image de fond temporaire */}
        <img 
          src="/arena-background.png"
          alt="Color Click Game background"
          className="absolute inset-0 w-full h-full object-cover opacity-20"
          onError={() => {
            console.error('Failed to load background image');
          }}
        />
        
        {onBack && (
          <button
            onClick={handleBackToMenu}
            className="absolute top-4 left-4 bg-black/30 hover:bg-black/40 text-amber-100 px-4 py-2 rounded-lg transition-colors z-10 border border-amber-500/30"
          >
            Back to menu
          </button>
        )}
        
        {/* Contenu centré */}
        <div className="absolute inset-0 flex items-center justify-center p-4">
          
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(30)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-yellow-200 rounded-full animate-pulse opacity-60"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 3}s`,
                  animationDuration: `${2 + Math.random() * 2}s`
                }}
              />
            ))}
          </div>

          <div className="bg-black/20 backdrop-blur-sm rounded-lg p-8 max-w-md w-full text-center border border-amber-500/30 relative z-10">
          <h1 className="text-3xl font-bold text-amber-100 mb-6 drop-shadow-lg">
            {gameData?.nom || 'Color Click Game'}
          </h1>
          
          {loading ? (
            <div className="bg-black/20 rounded-lg p-4 mb-6 border border-amber-700/20">
              <p className="text-amber-100/80 text-sm">Loading the rules...</p>
            </div>
          ) : (
            <>
              {gameData?.description && (
                <div className="bg-black/20 rounded-lg p-4 mb-4 border border-amber-700/20">
                  <h2 className="text-lg font-semibold text-amber-200 mb-3">Description and rules:</h2>
                  <p className="text-amber-100/80 text-sm leading-relaxed">
                    {gameData.description} 
                    {gameData.regles}
                  </p>
                </div>
              )}
              
            
            </>
          )}

          {bestScore > 0 && (
            <div className="mb-6 text-amber-100/90">
              <p className="text-lg">Record : <span className="font-bold text-yellow-300">{bestScore}</span></p>
            </div>
          )}

          <button
            onClick={startGame}
            className="w-full bg-gradient-to-r from-amber-600/80 to-yellow-600/80 text-white py-3 px-6 rounded-lg 
                     font-semibold hover:from-amber-700/90 hover:to-yellow-700/90 transition-all duration-300 
                     transform hover:scale-105 shadow-lg border border-amber-500/30 relative z-20 cursor-pointer"
          >
            Start
          </button>

          <button
            onClick={onBack ? handleBackToMenu : () => {
              // Si pas de fonction onBack, retourner à la page des niveaux
              console.log('No onBack function provided');
            }}
            className="w-full mt-3 bg-gradient-to-r from-gray-600/80 to-gray-700/80 text-white py-3 px-6 rounded-lg 
                     font-semibold hover:from-gray-700/90 hover:to-gray-800/90 transition-all duration-300 
                     transform hover:scale-105 shadow-lg border border-gray-500/30 cursor-pointer z-20"
          >
            Back
          </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'countdown') {
    return (
      <div className="fixed inset-0 w-full h-full relative">
        {/* Image de fond en tant qu'élément img */}
        <img 
          src="/arena-background.png"
          alt="Color Click Game background"
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => {
            console.error('Failed to load arena-background.png');
            e.currentTarget.src = '/arena-background.png';
          }}
        />
        
        {/* Bouton retour */}
        {onBack && (
          <button
            onClick={handleBackToMenu}
            className="absolute top-4 left-4 bg-black/30 hover:bg-black/40 text-amber-100 px-4 py-2 rounded-lg transition-colors z-10 border border-amber-500/30"
          >
            ← Back to Menu
          </button>
        )}

        {/* Overlay sombre */}
        <div className="absolute inset-0 bg-black/40"></div>

        {/* Animations d'arrière-plan */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(25)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-yellow-200 rounded-full animate-pulse opacity-70"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${2 + Math.random() * 2}s`
              }}
            />
          ))}
        </div>

        {/* Écran de compte à rebours */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-black/50 backdrop-blur-sm rounded-lg p-12 text-center border border-amber-500/30 relative z-10 max-w-2xl">
            <h1 className="text-4xl font-bold text-amber-100 mb-8 drop-shadow-lg">Get Ready!</h1>
            
            <div className="text-8xl font-bold text-yellow-300 mb-8 animate-pulse drop-shadow-2xl">
              {countdownTime}
            </div>
            
            <p className="text-amber-100/80 text-xl mb-6">
              Game starts in {countdownTime} second{countdownTime !== 1 ? 's' : ''}...
            </p>
            
            <div className="bg-black/30 rounded-lg p-4 mb-6 border border-amber-500/20">
              <h3 className="text-amber-100 text-lg font-semibold mb-3">Game Rules:</h3>
              <p className="text-amber-100/80 text-sm mb-2">
                Click on the color in which the word is written, not the word itself!
              </p>
            </div>
            
            <div className="text-amber-100/60 text-sm space-y-2">
              <h4 className="text-amber-100 font-semibold">Time Limits:</h4>
              <p>• First 10 answers: 3 seconds each</p>
              <p>• Next 10 answers: 2 seconds each</p>
              <p>• Remaining answers: 1 second each</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'playing') {
    return (
      <div className="fixed inset-0 w-full h-full relative">
        {/* Image de fond en tant qu'élément img */}
        <img 
          src="/arena-background.png"
          alt="Color Click Game background"
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => {
            console.error('Failed to load arena-background.png');
            e.currentTarget.src = '/arena-background.png';
          }}
        />
        
        {/* Contenu du jeu */}
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
          {onBack && (
          <button
            onClick={handleBackToMenu}
            className="absolute top-4 left-4 bg-black/30 hover:bg-black/40 text-amber-100 px-4 py-2 rounded-lg transition-colors z-10 border border-amber-500/30"
          >
            ← Back to menu
          </button>
        )}

        <div className="absolute inset-0 bg-black/40"></div>

        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-yellow-200 rounded-full animate-pulse opacity-50"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${2 + Math.random() * 2}s`
              }}
            />
          ))}
        </div>

        <div className="relative z-10 w-full max-w-4xl">
          <div className="flex justify-between items-center mb-8 bg-black/30 backdrop-blur-sm rounded-lg p-4 border border-amber-500/20">
            <div className="text-amber-100">
              <span className="text-lg font-semibold">Score: </span>
              <span className="text-2xl font-bold text-yellow-300">{score}</span>
            </div>
            {gameData && (
              <div className="text-amber-100">
                <span className="text-lg font-semibold">Target: </span>
                <span className="text-xl font-bold text-blue-300">{gameData.target_score}</span>
              </div>
            )}
            <div className="text-amber-100">
              <span className="text-lg font-semibold">Answers: </span>
              <span className="text-xl font-bold text-purple-300">{answersCount}</span>
            </div>
            <div className="text-amber-100">
              <span className="text-lg font-semibold">Time: </span>
              <span className="text-xl font-bold text-orange-300">{currentTimeLimit/1000}s</span>
            </div>
            <div className="text-amber-100">
              <span className="text-lg font-semibold">Série: </span>
              <span className="text-2xl font-bold text-green-300">{streak}</span>
            </div>
          </div>

          <div className="mb-8 bg-black/30 rounded-full h-3 overflow-hidden border border-amber-500/20">
            <div
              className="h-full bg-gradient-to-r from-green-400 to-red-500 transition-all duration-75 ease-linear"
              style={{ width: `${(timeLeft / currentTimeLimit) * 100}%` }}
            />
          </div>

          <div className="text-center mb-8">
            <div className="text-6xl font-bold mb-4 drop-shadow-lg" style={{ color: currentDisplayColor.color }}>
              {currentColorWord.name}
            </div>
            <p className="text-amber-100/80 text-lg">
              Click on the color in which the word is written!
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
            {COLORS.map((colorOption) => (
              <button
                key={colorOption.name}
                onClick={() => handleColorClick(colorOption)}
                className="relative text-white py-8 px-4 rounded-lg font-semibold 
                         transition-all duration-200 transform hover:scale-105 shadow-lg
                         border-2 border-white/30 hover:border-white/50 cursor-pointer z-20 pointer-events-auto"
                style={{ backgroundColor: colorOption.color }}
              >
              </button>
            ))}
          </div>
        </div>
        </div>
      </div>
    );
  }

  if (gameState === 'gameOver') {
    return (
      <div className="fixed inset-0 w-full h-full relative">
        {/* Image de fond en tant qu'élément img */}
        <img 
          src="/arena-background.png"
          alt="Color Click Game background"
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => {
            console.error('Failed to load arena-background.png');
            e.currentTarget.src = '/arena-background.png';
          }}
        />
        
        {/* Contenu de fin de jeu */}
        <div className="absolute inset-0 flex items-center justify-center p-4">
          {onBack && (
          <button
            onClick={handleBackToMenu}
            className="absolute top-4 left-4 bg-black/30 hover:bg-black/40 text-amber-100 px-4 py-2 rounded-lg transition-colors z-10 border border-amber-500/30"
          >
            ← Back to Menu
          </button>
        )}

        <div className="absolute inset-0 bg-black/40"></div>

        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(25)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-yellow-200 rounded-full animate-pulse opacity-70"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${2 + Math.random() * 2}s`
              }}
            />
          ))}
        </div>

        <div className="bg-black/50 backdrop-blur-sm rounded-lg p-8 max-w-md w-full text-center border border-amber-500/30 relative z-10">
          <h1 className="text-3xl font-bold text-amber-100 mb-6 drop-shadow-lg">End of the Challenge</h1>
          
          <div className="mb-6 space-y-4">
            <div className="text-amber-100">
              <p className="text-xl">Final Score:</p>
              <p className="text-4xl font-bold text-yellow-300">{score}</p>
            </div>
            
            {gameData && (
              <div className="text-amber-100">
                <p className="text-lg">Target Score: <span className="font-bold text-blue-300">{gameData.target_score}</span></p>
              </div>
            )}
            
            <div className="text-amber-100">
              <p className="text-lg">Max Streak: <span className="font-bold text-green-300">{streak}</span></p>
            </div>

            {nextStageUnlocked && (
              <div className="bg-green-600/20 border border-green-400/50 rounded-lg p-3 mb-4">
                <p className="text-green-300 font-bold text-lg">🎉 Next Stage Unlocked!</p>
                <p className="text-green-200 text-sm">You reached the target score!</p>
              </div>
            )}
            
            {gameData && score < gameData.target_score && playerData?.etage_actuel === gameData.niveau && (
              <div className="bg-red-600/20 border border-red-400/50 rounded-lg p-3 mb-4">
                <p className="text-red-300 font-bold">Score Insufficient</p>
                <p className="text-red-200 text-sm">Reach {gameData.target_score} points to unlock the next stage</p>
              </div>
            )}

            {score === bestScore && score > 0 && (
              <div className="text-yellow-300 text-lg font-bold animate-pulse">
                🏆 New Record! 🏆
              </div>
            )}
          </div>

          <div className="space-y-3">
            {nextStageUnlocked && onBack && (
              <button
                onClick={() => onBack()}
                className="w-full bg-gradient-to-r from-green-600/80 to-emerald-600/80 text-white py-3 px-6 rounded-lg 
                         font-semibold hover:from-green-700/90 hover:to-emerald-700/90 transition-all duration-300 
                         transform hover:scale-105 shadow-lg border border-green-500/30 cursor-pointer z-20 pointer-events-auto animate-pulse"
              >
                🎯 Next Stage Available!
              </button>
            )}
            
            <button
              onClick={startGame}
              className="w-full bg-gradient-to-r from-amber-600/80 to-yellow-600/80 text-white py-3 px-6 rounded-lg 
                       font-semibold hover:from-amber-700/90 hover:to-yellow-700/90 transition-all duration-300 
                       transform hover:scale-105 shadow-lg border border-amber-500/30 cursor-pointer z-20 pointer-events-auto"
            >
              New Challenge
            </button>
            
            <button
              onClick={() => setGameState('menu')}
              className="w-full bg-gradient-to-r from-gray-600/80 to-gray-700/80 text-white py-3 px-6 rounded-lg 
                       font-semibold hover:from-gray-700/90 hover:to-gray-800/90 transition-all duration-300 
                       transform hover:scale-105 shadow-lg border border-gray-500/30 cursor-pointer z-20 pointer-events-auto"
            >
              Back to Menu
            </button>
          </div>
        </div>
        </div>
      </div>
    );
  }

  return null;
};

export default ColorClickGame;
