import React, { useState, useEffect, useCallback } from 'react';
import { Player } from '../../../shared/types/player';
import { Progression } from '../../../shared/types/progression';
import { Stage } from '../../../shared/types/stage';

// Add custom CSS for animations
const heartbeatAnimation = `
  @keyframes heartbeat {
    0% { transform: scale(1); }
    25% { transform: scale(1.3); }
    50% { transform: scale(1); }
    75% { transform: scale(1.3); }
    100% { transform: scale(1); }
  }
  
  @keyframes fadeOut {
    0% { opacity: 1; }
    70% { opacity: 1; }
    100% { opacity: 0; }
  }
  
  @keyframes floatUpAndFade {
    0% { transform: translateY(0); opacity: 1; filter: blur(0); }
    50% { transform: translateY(-40px); opacity: 0.7; filter: blur(1px); }
    100% { transform: translateY(-80px); opacity: 0; filter: blur(3px); }
  }
`;

interface MemoryCardsTwistProps {
  onBack?: () => void;
}

interface Card {
  id: number;
  value: string;
  flipped: boolean;
  matched: boolean;
}

// Card symbols - easy to recognize emojis
const CARD_SYMBOLS = ['🌟', '🍎', '🌈', '🎵', '🚀', '🎮', '🎲', '🏆', '🔮', '⚡', '🌍', '🔥', '🎭', '🌺', '🦄', '🍦', '🎨', '🧩', '📱', '🏄'];

const MemoryCardsTwist: React.FC<MemoryCardsTwistProps> = ({ onBack }) => {
  // Add the CSS animations to the document
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = heartbeatAnimation;
    document.head.append(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [matchedPairs, setMatchedPairs] = useState<number>(0);
  const [moves, setMoves] = useState<number>(0);
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'preview' | 'gameOver' | 'levelComplete'>('menu');
  const [currentLevel, setCurrentLevel] = useState<number>(1);
  const [hearts, setHearts] = useState<number>(10); // Initial hearts (10 hearts)
  const [levelScore, setLevelScore] = useState<number>(0);
  const [totalScore, setTotalScore] = useState<number>(0);
  const [previewTimeLeft, setPreviewTimeLeft] = useState<number>(5);
  const [bestScore, setBestScore] = useState<number>(0);
  const [showHeartLoss, setShowHeartLoss] = useState<boolean>(false); // For heart loss animation

  // Progression-related states
  const [playerData, setPlayerData] = useState<Player | null>(null);
  const [gameDataStage, setGameDataStage] = useState<Stage | null>(null);
  const [nextStageUnlocked, setNextStageUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);

  // Level configuration - now supports infinite levels
  const getLevelConfig = (level: number) => {
  // Base configurations for levels 1-2
  if (level === 1) return { pairs: 4, maxPoints: 200 }; // 8 cards
  if (level === 2) return { pairs: 6, maxPoints: 300 }; // 12 cards
  // For level 3 and above, always 8 pairs (16 cards)
  return { pairs: 8, maxPoints: 400 };
  };

  // Load player data
  const loadPlayerData = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Fetching player data...');
      const response = await fetch('/api/player/init');
      console.log('Player response status:', response.status);
      if (response.ok) {
        const result = await response.json();
        console.log('Player result:', result);
        if (result.status === 'success') {
          setPlayerData(result.data);
        } else {
          console.error('Player API error:', result);
        }
      } else {
        console.error('Player fetch failed with status:', response.status);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des données du joueur:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load game data
  const loadGameData = useCallback(async () => {
    try {
      console.log('Fetching stages...');
      const response = await fetch('/api/stages');
      console.log('Response status:', response.status);
      if (response.ok) {
        const result = await response.json();
        console.log('Received result:', result);
        if (result.status === 'success' && Array.isArray(result.data)) {
          console.log('Stages data:', result.data);
          // Chercher le stage "Tiles Match" avec plusieurs critères
          const currentStage = result.data.find((stage: Stage) => 
            stage.nom.toLowerCase().includes('tiles match') || 
            stage.nom.toLowerCase().includes('tiles') ||
            stage.nom.toLowerCase().includes('memory') ||
            stage.niveau === 4 // Niveau 4 pour Tiles Match (après Word Express)
          );
          console.log('Found Tiles Match stage:', currentStage);
          setGameDataStage(currentStage || null);
        } else {
          console.error('Invalid response format or not an array:', result);
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement des données de jeu:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle game end logic with progression
  const endGame = useCallback(async () => {
    if (!playerData || !gameDataStage) return;

    try {
      const success = totalScore >= gameDataStage.target_score;
      
      // Create or update progression
      const progressionData = {
        joueur_id: playerData.reddit_id,
        etage_id: gameDataStage.id,
        score: totalScore,
        completed: success
      };

      const response = await fetch('/api/progression/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(progressionData),
      });

      if (response.ok) {
        console.log('Progression sauvegardée avec succès');
        if (success) {
          console.log('Stage réussi! Débloquage du stage suivant...');
          setNextStageUnlocked(true);
          
          // Mettre à jour le niveau du joueur vers le stage suivant
          try {
            const updateResponse = await fetch('/api/player/update', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                etage_actuel: gameDataStage.niveau + 1
              }),
            });

            if (updateResponse.ok) {
              console.log('Niveau du joueur mis à jour avec succès');
            } else {
              console.error('Erreur lors de la mise à jour du niveau du joueur');
            }
          } catch (updateError) {
            console.error('Erreur lors de la mise à jour du niveau:', updateError);
          }
        } else {
          console.log('Stage non réussi. Score:', totalScore, 'Target:', gameDataStage.target_score);
        }
      } else {
        console.error('Erreur lors de la sauvegarde de la progression');
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
    }
  }, [playerData, gameDataStage, totalScore]);

  // Function to handle next stage navigation
  const handleNextStage = useCallback(() => {
    if (onBack) {
      onBack(); // Navigate back to TowerLevelsPage
    }
  }, [onBack]);

  // Load initial data
  useEffect(() => {
    loadPlayerData();
    loadGameData();
  }, [loadPlayerData, loadGameData]);

  // Initialize a level
  const initializeLevel = useCallback((level: number) => {
    setCurrentLevel(level);
    const config = getLevelConfig(level);
    const pairCount = config.pairs;

    // Create the card deck
    const symbols = [...CARD_SYMBOLS].slice(0, pairCount);
    const cardDeck: Card[] = [];

    // Create two cards for each symbol
    symbols.forEach((symbol, index) => {
      cardDeck.push({ id: index * 2, value: symbol, flipped: false, matched: false });
      cardDeck.push({ id: index * 2 + 1, value: symbol, flipped: false, matched: false });
    });

    // Shuffle the cards
    const shuffledDeck = [...cardDeck].sort(() => Math.random() - 0.5);

    // All cards are flipped for preview
    const previewDeck = shuffledDeck.map(card => ({ ...card, flipped: true }));

    setCards(previewDeck);
    setFlippedIndices([]);
    setMatchedPairs(0);
    setMoves(0);
    setLevelScore(0);
    setPreviewTimeLeft(5);
    setGameState('preview');
  }, []);

  // Commencer le jeu (niveau 1)
  const startGame = useCallback(() => {
    setTotalScore(0);
    setCurrentLevel(1);
    setHearts(10); // Reset hearts to 10
    initializeLevel(1);
  }, [initializeLevel]);

  // Handle card click
  const handleCardClick = useCallback((index: number) => {
    // Do nothing if the game is in preview mode
    if (gameState === 'preview') {
      return;
    }

    // Check if index is valid and card exists
    if (index < 0 || index >= cards.length || !cards[index]) {
      return;
    }

    // Do nothing if more than 2 cards are flipped or if the card is already flipped/matched
    if (flippedIndices.length >= 2 || cards[index].flipped || cards[index].matched) {
      return;
    }

    // Flip the card
    const newCards = [...cards];
    if (newCards[index]) {
      newCards[index].flipped = true;
      setCards(newCards);
    }

    // Add this card to flipped cards
    const newFlippedIndices = [...flippedIndices, index];
    setFlippedIndices(newFlippedIndices);

    // If it's the second flipped card, check if it's a match
    if (newFlippedIndices.length === 2) {
      // Increment the number of moves
      setMoves(prev => prev + 1);

      // Check if the two cards match
      const [firstIndex, secondIndex] = newFlippedIndices;
      
      // Verify that both indices are valid and cards exist
      if (firstIndex !== undefined && secondIndex !== undefined && 
          cards[firstIndex] && cards[secondIndex] &&
          cards[firstIndex].value === cards[secondIndex].value) {
        // Cards match, mark them as matched
        const newCards = [...cards];
        if (newCards[firstIndex] && newCards[secondIndex]) {
          newCards[firstIndex].matched = true;
          newCards[secondIndex].matched = true;
          setCards(newCards);
          setMatchedPairs(prev => prev + 1);
          setFlippedIndices([]); // Reset flipped cards
        }
        
        // Award points for a found pair
        const config = getLevelConfig(currentLevel);
        const basePoints = Math.floor(config.maxPoints / config.pairs); // Points per pair
        const pointsEarned = basePoints;
        
        setLevelScore(prev => prev + pointsEarned);
        
      } else {
        // Cards don't match, point penalty
        const penalty = currentLevel * 10; // Penalty increases with level
        setLevelScore(prev => Math.max(0, prev - penalty)); // Prevent negative score
        
        // Lose one heart for each mismatch
        setHearts(prev => Math.max(0, prev - 1));
        
        // Trigger heart loss animation
        setShowHeartLoss(true);
        setTimeout(() => {
          setShowHeartLoss(false);
        }, 1500);
        
        // Cards don't match, flip them back after a delay
        setTimeout(() => {
          const newCards = [...cards];
          if (firstIndex !== undefined && secondIndex !== undefined && 
              newCards[firstIndex] && newCards[secondIndex]) {
            newCards[firstIndex].flipped = false;
            newCards[secondIndex].flipped = false;
            setCards(newCards);
          }
          setFlippedIndices([]); // Reset flipped cards
        }, 1000);
        
        // Check if game over (no hearts left)
        if (hearts <= 1) {
          // Game over - no hearts left
          if (totalScore + levelScore > bestScore) {
            setBestScore(totalScore + levelScore);
          }
          // Save progression
          endGame();
          setTimeout(() => {
            setGameState('gameOver');
          }, 1000);
        }
      }
    }
  }, [cards, flippedIndices, gameState, currentLevel, moves, hearts, totalScore, levelScore, bestScore]);

  // Vérifier si le niveau est terminé
  useEffect(() => {
    if (gameState === 'playing' && matchedPairs === cards.length / 2 && cards.length > 0) {
      // Niveau terminé
      setTotalScore(prev => prev + levelScore);
      
      // Save progression when level completed
      endGame();
      
      // Always proceed to the next level - infinite levels
      setGameState('levelComplete');
    }
  }, [matchedPairs, cards.length, gameState, levelScore, totalScore, endGame]);

  // Minuteur du jeu et de prévisualisation
  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (gameState === 'preview') {
      timer = setInterval(() => {
        setPreviewTimeLeft(prev => {
          if (prev <= 1) {
            // La prévisualisation est terminée, retourner toutes les cartes et commencer le jeu
            setCards(cards => cards.map(card => ({ ...card, flipped: false })));
            setGameState('playing');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(timer);
  }, [gameState]);

  // Écran du menu principal
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-500">
        <div className="text-center p-8 bg-white/20 backdrop-blur-lg rounded-3xl shadow-2xl">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg font-semibold">Loading...</p>
        </div>
      </div>
    );
  }

  if (gameState === 'menu') {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4 relative"
        style={{
          backgroundImage: 'url(/arena-background.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {onBack && (
          <button
            onClick={onBack}
            className="absolute top-4 left-4 bg-black/30 hover:bg-black/40 text-amber-100 px-4 py-2 rounded-lg transition-colors z-10 border border-amber-500/30"
          >
            ← Retour au menu
          </button>
        )}

        <div className="absolute inset-0 bg-black/30"></div>
        
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

        <div className="bg-black/40 backdrop-blur-sm rounded-lg p-8 max-w-md w-full text-center border border-amber-500/30 relative z-10">
          <h1 className="text-3xl font-bold text-amber-100 mb-6 drop-shadow-lg">Tiles Match</h1>
          
          <div className="bg-black/20 rounded-lg p-4 mb-6 border border-amber-700/20">
            <h2 className="text-lg font-semibold text-amber-200 mb-3">Challenge Rules:</h2>
            <div className="text-amber-100/80 text-sm leading-relaxed space-y-2">
              {gameDataStage?.description && (
                <p className="text-yellow-300 mb-2">{gameDataStage.description}</p>
              )}
              {gameDataStage?.regles ? (
                <div dangerouslySetInnerHTML={{ __html: gameDataStage.regles }} />
              ) : (
                <>
                  <p>• <span className="text-yellow-300">Unlimited levels</span> of increasing difficulty</p>
                  <p>• Level 1: 4 pairs (8 cards)</p>
                  <p>• Level 2: 6 pairs (12 cards)</p>
                  <p>• Level 3+: 8+ pairs (gradually increasing)</p>
                  <p>• Earn points for each pair found</p>
                  <p>• <span className="text-red-300">Lose one heart</span> when you mismatch cards</p>
                  <p>• Game ends when you run out of hearts</p>
                </>
              )}
            </div>
          </div>

          {bestScore > 0 && (
            <div className="bg-gradient-to-r from-yellow-600/20 to-amber-600/20 rounded-lg p-3 mb-4 border border-yellow-500/30">
              <p className="text-amber-200 text-sm">Best Score</p>
              <p className="text-2xl font-bold text-yellow-300">{bestScore} pts</p>
            </div>
          )}

          <button
            onClick={startGame}
            className="w-full bg-gradient-to-r from-purple-600/80 to-pink-600/80 text-white py-4 px-6 rounded-lg 
                    font-semibold hover:from-purple-500/90 hover:to-pink-500/90 transition-all duration-300 
                    transform hover:scale-105 shadow-lg border border-purple-500/30 relative z-20 cursor-pointer"
          >
            🚀 Start Challenge
          </button>
        </div>
      </div>
    );
  }

  // Écran de fin de niveau
  if (gameState === 'levelComplete') {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4 relative"
        style={{
          backgroundImage: 'url(/arena-background.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="absolute inset-0 bg-black/40"></div>
        
        <div className="bg-black/50 backdrop-blur-sm rounded-lg p-8 max-w-md w-full text-center border border-amber-500/30 relative z-10">
          <h1 className="text-3xl font-bold text-amber-100 mb-6 drop-shadow-lg">Level {currentLevel} Completed! ✨</h1>
          
          <div className="mb-6 space-y-4">
            <div className="bg-black/20 rounded-lg p-3 border border-amber-500/20">
              <p className="text-amber-200 text-sm">Level Score</p>
              <p className="text-3xl font-bold text-yellow-300">{levelScore}</p>
            </div>
            
            <div className="bg-black/20 rounded-lg p-3 border border-purple-500/20">
              <p className="text-purple-200 text-sm">Total Score</p>
              <p className="text-2xl font-bold text-purple-300">{totalScore + levelScore}</p>
            </div>
          </div>

          <div className="mb-6 bg-black/20 rounded-lg p-4 border border-blue-500/20">
            <p className="text-blue-200 text-lg mb-2">Next Level:</p>
            <p className="text-white">Level {currentLevel + 1}</p>
            <p className="text-cyan-300">{getLevelConfig(currentLevel + 1).pairs} pairs</p>
            <p className="text-orange-300">❤️ {hearts} hearts remaining</p>
          </div>

          <button
            onClick={() => initializeLevel(currentLevel + 1)}
            className="w-full bg-gradient-to-r from-green-600/80 to-blue-600/80 text-white py-4 px-6 rounded-lg 
                      font-semibold hover:from-green-500/90 hover:to-blue-500/90 transition-all duration-300 
                      transform hover:scale-105 shadow-lg border border-green-500/30 cursor-pointer z-20 pointer-events-auto"
          >
            Next Level →
          </button>
        </div>
      </div>
    );
  }

  // Écran de jeu (partagé entre le mode prévisualisation et le jeu proprement dit)
  if (gameState === 'playing' || gameState === 'preview') {
    // Fonction pour déterminer les classes de grille selon le niveau
    const getGridClasses = (level: number): string => {
      const config = getLevelConfig(level);
      const totalCards = config.pairs * 2;
      
      // Déterminer la meilleure grille selon le nombre de cartes
      if (totalCards <= 8) {
        return 'grid-cols-4'; // 4x2 pour 8 cartes ou moins
      } else if (totalCards <= 12) {
        return 'grid-cols-4'; // 4x3 pour 12 cartes
      } else if (totalCards <= 16) {
        return 'grid-cols-4'; // 4x4 pour 16 cartes
      } else if (totalCards <= 20) {
        return 'grid-cols-5'; // 5x4 pour 20 cartes
      } else if (totalCards <= 24) {
        return 'grid-cols-6'; // 6x4 pour 24 cartes
      } else if (totalCards <= 28) {
        return 'grid-cols-7'; // 7x4 pour 28 cartes
      } else {
        return 'grid-cols-8'; // 8x4+ pour plus de 28 cartes
      }
    };

    const gridClass = getGridClasses(currentLevel);

    const isPreview = gameState === 'preview';

    return (
      <div 
        className="min-h-screen flex flex-col items-center justify-center p-2 md:p-4 relative"
        style={{
          backgroundImage: 'url(/arena-background.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {onBack && (
          <button
            onClick={onBack}
            className="absolute top-2 left-2 bg-black/30 hover:bg-black/40 text-amber-100 px-3 py-1 text-sm rounded-lg transition-colors z-10 border border-amber-500/30"
          >
            ← Menu
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

        <div className="relative z-10 w-full max-w-2xl">
          <div className="flex justify-between items-center mb-2 bg-black/30 backdrop-blur-sm rounded-lg p-2 border border-amber-500/20 flex-wrap gap-1 text-xs md:text-base">
            <div className="text-amber-100">
              <span className="font-semibold">Level: </span>
              <span className="font-bold text-cyan-300">{currentLevel}</span>
            </div>
            <div className="text-amber-100">
              <span className="font-semibold">Score: </span>
              <span className="font-bold text-yellow-300">{totalScore + levelScore}</span>
            </div>
            <div className="text-amber-100">
              <span className="font-semibold">Hearts: </span>
              <span className={`font-bold text-red-400 ${hearts <= 3 ? 'animate-pulse' : ''}`} 
                    style={{ transition: 'all 0.3s ease' }}>
                ❤️ × {hearts}
              </span>
            </div>
            <div className="text-amber-100">
              <span className="font-semibold">Moves: </span>
              <span className="font-bold text-yellow-300">{moves}</span>
            </div>
          </div>

          {isPreview && (
            <div className="bg-black/50 backdrop-blur-sm rounded-lg p-3 mb-2 text-center text-white">
              <p className="text-sm md:text-lg">Memorize the cards! They will be flipped in <span className="text-cyan-300 font-bold">{previewTimeLeft}</span> seconds</p>
            </div>
          )}

          <div className="bg-black/30 backdrop-blur-sm border-2 border-amber-500/30 rounded-lg p-2 md:p-4 mb-2 relative">
            {/* Heart loss animation - floating up from bottom of the card area */}
            {showHeartLoss && (
              <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 z-30 pointer-events-none">
                <div className="bg-black/30 backdrop-blur-sm rounded-full px-2 py-1"
                     style={{ animation: 'floatUpAndFade 1.5s forwards' }}>
                  <div className="text-xl font-bold text-red-500" 
                       style={{ animation: 'heartbeat 0.8s ease-in-out' }}>
                    ❤️ -1
                  </div>
                </div>
              </div>
            )}
            
            <div className={`grid ${gridClass} gap-1 md:gap-2 mx-auto`}>
              {cards.map((card, index) => (
                <div
                  key={index}
                  className={`aspect-square flex items-center justify-center rounded-lg cursor-pointer transform transition-all duration-300 ${
                    card.flipped || card.matched
                      ? 'bg-gradient-to-br from-amber-500/30 to-yellow-700/30 shadow-inner border-2 border-amber-400/50 rotate-0'
                      : 'bg-gradient-to-br from-purple-900/70 to-indigo-900/70 hover:from-purple-800/70 hover:to-indigo-800/70 shadow-lg border-2 border-amber-500/30 hover:scale-105 rotate-1'
                  } ${card.matched ? 'animate-pulse' : ''}`}
                  onClick={() => handleCardClick(index)}
                  style={{ maxHeight: '80px', maxWidth: '80px' }} // Limite la taille des cartes
                >
                  <div className={`text-lg md:text-3xl transition-all duration-300 ${
                    card.flipped || card.matched 
                      ? 'scale-100 opacity-100' 
                      : 'scale-0 opacity-0'
                  }`}>
                    {card.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center space-x-2">
            <button
              onClick={() => {
                initializeLevel(currentLevel);
              }}
              className="bg-gradient-to-r from-gray-600/80 to-gray-700/80 text-white py-2 px-3 rounded-lg 
                      text-sm font-semibold hover:from-gray-500/90 hover:to-gray-600/90 transition-all duration-200 
                      transform hover:scale-105 shadow-lg border border-gray-500/30 relative z-20 cursor-pointer"
            >
              Restart
            </button>
            <button
              onClick={() => setGameState('menu')}
              className="bg-gradient-to-r from-blue-600/80 to-blue-700/80 text-white py-2 px-3 rounded-lg 
                      text-sm font-semibold hover:from-blue-500/90 hover:to-blue-600/90 transition-all duration-200 
                      transform hover:scale-105 shadow-lg border border-blue-500/30 relative z-20 cursor-pointer"
            >
              Main Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Écran de fin de jeu
  if (gameState === 'gameOver') {
    const finalScore = totalScore + levelScore;
    const isNewBest = finalScore > bestScore && finalScore > 0;

    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4 relative"
        style={{
          backgroundImage: 'url(/arena-background.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {onBack && (
          <button
            onClick={onBack}
            className="absolute top-4 left-4 bg-black/30 hover:bg-black/40 text-amber-100 px-4 py-2 rounded-lg transition-colors z-10 border border-amber-500/30"
          >
            ← Retour au menu
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
          <h1 className="text-3xl font-bold text-amber-100 mb-6 drop-shadow-lg">
            Game Over! ❤️
          </h1>
          
          <div className="mb-6 space-y-4">
            <div className="text-amber-100">
              <p className="text-xl">Level reached:</p>
              <p className="text-3xl font-bold text-cyan-300">{currentLevel}</p>
            </div>
            
            <div className="bg-black/20 rounded-lg p-3 border border-amber-500/20 mb-3">
              <p className="text-amber-200 text-sm">Final Score</p>
              <p className="text-4xl font-bold text-yellow-300">{finalScore}</p>
              {isNewBest && (
                <p className="text-green-400 text-sm font-bold animate-pulse">🎉 New Record! 🎉</p>
              )}
            </div>
            
            {bestScore > 0 && !isNewBest && (
              <div className="bg-black/20 rounded-lg p-3 border border-purple-500/20">
                <p className="text-purple-200 text-sm">Best Score</p>
                <p className="text-2xl font-bold text-purple-300">{bestScore}</p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {nextStageUnlocked && (
              <button
                onClick={handleNextStage}
                className="w-full bg-gradient-to-r from-green-600/80 to-emerald-600/80 text-white py-3 px-6 rounded-lg 
                          font-semibold hover:from-green-700/90 hover:to-emerald-700/90 transition-all duration-300 
                          transform hover:scale-105 shadow-lg border border-green-500/30 cursor-pointer z-20 pointer-events-auto"
              >
                🎯 Next Stage
              </button>
            )}
            
            <button
              onClick={startGame}
              className="w-full bg-gradient-to-r from-amber-600/80 to-yellow-600/80 text-white py-3 px-6 rounded-lg 
                        font-semibold hover:from-amber-700/90 hover:to-yellow-700/90 transition-all duration-300 
                        transform hover:scale-105 shadow-lg border border-amber-500/30 cursor-pointer z-20 pointer-events-auto"
              >
                Restart Challenge
              </button>            <button
              onClick={() => setGameState('menu')}
              className="w-full bg-gradient-to-r from-gray-600/80 to-gray-700/80 text-white py-3 px-6 rounded-lg 
                        font-semibold hover:from-gray-700/90 hover:to-gray-800/90 transition-all duration-300 
                        transform hover:scale-105 shadow-lg border border-gray-500/30 cursor-pointer z-20 pointer-events-auto"
            >
              Main Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default MemoryCardsTwist;
