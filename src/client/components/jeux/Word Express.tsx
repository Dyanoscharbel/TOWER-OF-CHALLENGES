import React, { useState, useEffect, useCallback } from 'react';
import { Player } from '../../../shared/types/player';
import { Progression } from '../../../shared/types/progression';
import { Stage } from '../../../shared/types/stage';

// Game configuration data moved outside the component for better performance
// as it doesn't change between re-renders.
const gameData = {
  letters: ['A', 'E', 'R', 'T', 'I', 'O', 'N', 'S', 'L'], // Center letter: 'A'
  centerLetter: 'A',
  possibleWords: [
    // Mots de 3 lettres
    'AIR', 'ALE', 'ANT', 'ARC', 'ARE', 'ART', 'ATE', 'EAR', 'ERA', 'LAR', 'LEA', 'OAR', 'OAT', 'ORA', 'TAR', 'TEA',
    
    // Mots de 4 lettres
    'AERO', 'ALES', 'ALTO', 'ANTE', 'ANTI', 'ANTS', 'ARTS', 'EARL', 'EARN', 'EARS', 'EAST', 'EATS', 'ERAS',
    'LAIN', 'LAIR', 'LANE', 'LASE', 'LAST', 'LATE', 'LATS', 'LEAN', 'LEAS', 'LEST', 'LETS', 'LIES', 'LINE', 
    'LINT', 'LION', 'LIST', 'LITE', 'LOAN', 'LONE', 'LORE', 'LOSE', 'LOST', 'LOTS', 'NAIL', 'NEAR', 'NEAT', 
    'NEST', 'NETS', 'NOES', 'NOSE', 'NOTE', 'OARS', 'OATS', 'OILS', 'ONES', 'ORAL', 'ORES', 'RAIN', 'RANT', 
    'RATE', 'RATS', 'REAL', 'RENT', 'REST', 'RILE', 'RIOT', 'RISE', 'ROLE', 'ROSE', 'ROTE', 'SAIL', 'SALE', 
    'SALT', 'SANE', 'SEAT', 'SENT', 'SITE', 'SLAT', 'SLOT', 'SNOT', 'SOAR', 'SOLE', 'SORE', 'SORT', 'STAR', 
    'TALE', 'TALL', 'TAME', 'TANS', 'TAPE', 'TARE', 'TARS', 'TEAR', 'TEAS', 'TELL', 'TENS', 'TERN', 'TIES', 
    'TILE', 'TINS', 'TIRE', 'TOIL', 'TONE', 'TONS', 'TORE', 'TORN', 'TAIL',
    
    // Mots de 5 lettres
    'ALERT', 'ALIEN', 'ALONE', 'ALTER', 'ALTOS', 'ANGEL', 'ANGER', 'ANGLE', 'ANTES', 'ANTIS', 'AROSE', 'ARSON',
    'EARLS', 'EARNS', 'EASEL', 'EATER', 'ELANS', 'INANE', 'INERT', 'INLET', 'INTER', 'INTRO', 'IRONS', 'ISLET', 
    'LAIRS', 'LANES', 'LAPSE', 'LASER', 'LATER', 'LEANS', 'LEARN', 'LEASE', 'LEAST', 'LIENS', 'LINER', 'LINES', 
    'LIONS', 'LISLE', 'LITER', 'LOANS', 'LOSER', 'NAILS', 'NEARS', 'NEATS', 'NESTS', 'NOISE', 'NORSE', 'NOTES', 
    'OATER', 'OILER', 'ORALS', 'ORATE', 'ORIEL', 'OSIER', 'RAINS', 'RAISE', 'RANTS', 'RATES', 'RATIO', 'REALS', 
    'RENTS', 'RESIN', 'RIOTS', 'RISEN', 'ROILS', 'ROLES', 'ROTES', 'SAILS', 'SAINT', 'SALES', 'SALON', 'SALTS', 
    'SANER', 'SATIN', 'SCALE', 'SCARE', 'SEALS', 'SEARS', 'SEATS', 'SENOR', 'SLAIN', 'SLANT', 'SLATE', 'SLIER', 
    'SNAIL', 'SNARE', 'SNARL', 'SNORE', 'SNORT', 'SOARS', 'SOLAR', 'SOLES', 'SORER', 'SORTS', 'STAIN', 'STAIR', 
    'STALE', 'STALL', 'STARE', 'STARS', 'START', 'STATE', 'STEAL', 'STERN', 'STILE', 'STOLE', 'STONE', 'STORE', 
    'STORM', 'TALES', 'TAMES', 'TAPER', 'TARES', 'TAROS', 'TASTE', 'TATER', 'TEASE', 'TELLS', 'TENOR', 'TERNS', 
    'TERRA', 'TIERS', 'TILES', 'TINES', 'TIRES', 'TOILS', 'TONAL', 'TONER', 'TONES', 'TORAS', 'TORES', 'TRAIL', 
    'TRAIN', 'TRANS', 'TRIAL', 'TAILS',
    
    // Mots de 6 lettres
    'ALERTS', 'ALIENS', 'ALTERS', 'ANGERS', 'ANGLES', 'ANTLER', 'ARSINE', 'EATERS', 'ENTAIL', 'INERTS', 'INLETS', 
    'INSOLE', 'NAILER', 'NITERS', 'OATERS', 'OILERS', 'ORATES', 'ORIELS', 'OSIERS', 'RATIOS', 'RETAIL', 'RETINA', 
    'SAILER', 'SALTER', 'SENIOR', 'SERIAL', 'SILANE', 'STALER', 'TAILER', 'TENORS', 'TENSOR', 'TILERS', 'TOILER', 
    'TONERS', 'TRAILS', 'TRAINS', 'TRIALS',
    
    // Mots de 7 lettres
    'ANTSIER', 'ELASTIN', 'ENTAILS', 'NAILERS', 'NASTIER', 'RETAILS', 'RETINAS', 'SALIENT', 'SALTIER', 'TENAILS',
    
    // Mots de 8 lettres
    'ENTRAILS', 'LATRINES', 'RATLINES',
    
    // Mot de 9 lettres (Pangram - utilise toutes les lettres disponibles)
    'ORIENTALS'
  ]
};

interface WordSpreeProps {
  onBack?: () => void;
}

const WordSpree: React.FC<WordSpreeProps> = ({ onBack }) => {
  // State for the game flow: 'rules', 'playing', 'finished'
  const [gameState, setGameState] = useState<'rules' | 'playing' | 'finished'>('rules');
  const [timeLeft, setTimeLeft] = useState(15);

  const [currentWord, setCurrentWord] = useState('');
  const [foundWords, setFoundWords] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState('');
  const [shuffledLetters, setShuffledLetters] = useState<string[]>([]);

  // Progression-related states
  const [playerData, setPlayerData] = useState<Player | null>(null);
  const [gameDataStage, setGameDataStage] = useState<Stage | null>(null);
  const [nextStageUnlocked, setNextStageUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);

  // Function to shuffle the outer letters
  const shuffleLetters = useCallback(() => {
    const outerLetters = gameData.letters.filter(letter => letter !== gameData.centerLetter);
    const shuffled = [...outerLetters].sort(() => Math.random() - 0.5);
    setShuffledLetters(shuffled);
  }, []);

  // Load player data
  const loadPlayerData = useCallback(async () => {
    try {
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
          // Chercher le stage "Word Express" avec plusieurs critères
          const currentStage = result.data.find((stage: Stage) => 
            stage.nom.toLowerCase().includes('word express') || 
            stage.nom.toLowerCase().includes('word') ||
            stage.niveau === 3 // Niveau 3 pour Word Express (après Color Click Game et Reaction Dash)
          );
          console.log('Found Word Express stage:', currentStage);
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
      const success = score >= gameDataStage.target_score;
      
      // Create or update progression
      const progressionData = {
        joueur_id: playerData.reddit_id,
        etage_id: gameDataStage.id,
        score: score,
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
          console.log('Stage non réussi. Score:', score, 'Target:', gameDataStage.target_score);
        }
      } else {
        console.error('Erreur lors de la sauvegarde de la progression');
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
    }
  }, [playerData, gameDataStage, score]);

  // Initial shuffle of letters
  useEffect(() => {
    shuffleLetters();
  }, [shuffleLetters]);

  // Load initial data
  useEffect(() => {
    loadPlayerData();
    loadGameData();
  }, [loadPlayerData, loadGameData]);

  // Timer countdown logic
  useEffect(() => {
    if (gameState !== 'playing' || timeLeft === 0) {
      if (timeLeft === 0) {
        endGame(); // Handle progression when game ends
        setGameState('finished');
      }
      return;
    }

    const timerId = setInterval(() => {
      setTimeLeft(prevTime => prevTime - 1);
    }, 1000);

    return () => clearInterval(timerId); // Cleanup interval on unmount or state change
  }, [gameState, timeLeft, endGame]);

  // Add a letter to the current word
  const addLetter = (letter: string) => {
    setCurrentWord(prev => prev + letter);
    setMessage('');
  };

  // Remove the last letter
  const removeLetter = () => {
    setCurrentWord(prev => prev.slice(0, -1));
  };

  // Clear the current word input
  const clearWord = () => {
    setCurrentWord('');
    setMessage('');
  };

  // Calculate points based on word length
  const calculatePoints = useCallback((word: string) => {
    const length = word.length;
    if (length === 3) return 1;
    if (length === 4) return 2;
    if (length === 5) return 3;
    if (length === 6) return 5;
    if (length === 7) return 8;
    if (length === 8) return 12;
    if (length >= 9) return 20; // Pangram bonus
    return 0;
  }, []);

  // Submit the word for validation
  const submitWord = useCallback(() => {
    if (!currentWord) return;

    // Validation logic
    if (!currentWord.includes(gameData.centerLetter)) {
      setMessage('The word must contain the center letter!');
      return;
    }
    if (currentWord.length < 3) {
      setMessage('Word too short (3 letters minimum)');
      return;
    }
    if (!gameData.possibleWords.includes(currentWord.toUpperCase())) {
      setMessage('Word not recognized');
      return;
    }
    if (foundWords.includes(currentWord.toUpperCase())) {
      setMessage('Word already found');
      return;
    }

    // If valid, update score and found words
    const points = calculatePoints(currentWord);
    const newWord = currentWord.toUpperCase();

    setFoundWords(prev => [...prev, newWord]);
    setScore(prev => prev + points);
    setMessage(`Great! +${points} points`);
    setCurrentWord('');
  }, [currentWord, foundWords, calculatePoints]);

  // Keyboard input handler
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return;

      const key = e.key.toUpperCase();
      if (key === 'ENTER') {
        e.preventDefault();
        submitWord();
      } else if (key === 'BACKSPACE') {
        e.preventDefault();
        removeLetter();
      } else if (key === 'ESCAPE') {
        e.preventDefault();
        clearWord();
      } else if (gameData.letters.includes(key)) {
        e.preventDefault();
        addLetter(key);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameState, submitWord]); // Dependencies ensure the function is up-to-date

  // Function to start the game
  const startGame = () => {
    setGameState('playing');
  };

  // Function to restart the game
  const restartGame = () => {
    setScore(0);
    setFoundWords([]);
    setCurrentWord('');
    setMessage('');
    setTimeLeft(180);
    setGameState('rules'); // Go back to rules screen
    shuffleLetters();
  };

  // Helper for letter positioning in a circle
  const getLetterPosition = (index: number, total: number) => {
    const angle = (index * 2 * Math.PI) / total - Math.PI / 2;
    const radius = 120;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    return { x, y };
  };

  const renderRulesScreen = () => (
    <div className="relative z-10 w-full max-w-2xl text-center">
      <h1 className="text-5xl font-bold text-amber-100 mb-8 drop-shadow-lg">Word Spree</h1>
      <div className="bg-black/40 backdrop-blur-sm rounded-lg p-8 border border-amber-500/30">
        <h3 className="text-2xl font-semibold text-amber-200 mb-4">How to Play:</h3>
        
        {gameDataStage ? (
          <div className="text-amber-100/80 space-y-4 text-left max-w-md mx-auto">
            <div>
              <h4 className="text-lg font-semibold text-amber-200 mb-2">Description:</h4>
            {gameDataStage.description} {gameDataStage.regles}</div>
            </div>
        
        ) : (
          <ul className="text-amber-100/80 space-y-3 text-left max-w-md mx-auto">
            <li>• Create English words using the available letters.</li>
            <li>• Words must be at least 3 letters long.</li>
            <li>• The center letter (yellow) must be in every word.</li>
            <li>• The longer the word, the more points you get!</li>
            <li>• You have <strong>3 minutes</strong> to find as many words as you can.</li>
            <li>• Only words from the English dictionary are accepted.</li>
          </ul>
        )}
        <button
          onClick={startGame}
          className="mt-8 px-8 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white text-xl font-bold rounded-lg 
                     hover:from-green-500 hover:to-green-600 transition-all duration-300 transform hover:scale-105 shadow-lg border border-green-500/30"
        >
          Start Game
        </button>
      </div>
    </div>
  );

  const renderGameScreen = () => (
    <div className="relative z-10 w-full max-w-4xl">
      <h1 className="text-4xl font-bold text-center text-amber-100 mb-8 drop-shadow-lg">Word Spree</h1>
      {/* Score and stats */}
      <div className="bg-black/30 backdrop-blur-sm rounded-lg p-6 mb-6 border border-amber-500/20">
        <div className="flex justify-between items-center mb-2">
          <div className="text-2xl font-bold text-amber-100">
            Score: <span className="text-yellow-300">{score}</span>
          </div>
          <div className="text-2xl font-bold text-amber-100">
            Time: <span className="text-yellow-300">{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
          </div>
          <div className="text-lg text-amber-100">
            Words found: <span className="text-yellow-300">{foundWords.length}</span>
          </div>
        </div>
        {gameDataStage && (
          <div className="text-center">
            <div className="text-lg text-amber-100/80">
              Target Score: <span className="text-amber-200 font-semibold">{gameDataStage.target_score}</span>
              {score >= gameDataStage.target_score && (
                <span className="ml-2 text-green-400 font-bold">✓ Target Reached!</span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Game Area */}
        <div className="bg-black/30 backdrop-blur-sm rounded-lg p-6 border border-amber-500/30">
          <h2 className="text-xl font-semibold text-amber-200 mb-4">Game Board</h2>
          <div className="mb-6">
            <div className="text-center">
              <div className="text-2xl font-mono font-bold bg-black/40 text-amber-100 rounded-lg p-4 min-h-16 flex items-center justify-center border border-amber-500/30">
                {currentWord || 'Click on the letters...'}
              </div>
              {message && (
                <div className={`mt-2 text-sm font-medium ${message.includes('Great') ? 'text-green-300' : 'text-red-300'}`}>
                  {message}
                </div>
              )}
            </div>
          </div>
          <div className="relative mx-auto" style={{ width: '300px', height: '300px' }}>
            <button
              onClick={() => addLetter(gameData.centerLetter)}
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 
                       w-16 h-16 bg-gradient-to-r from-amber-400 to-yellow-500 text-white text-2xl font-bold rounded-full 
                       hover:from-amber-500 hover:to-yellow-600 transition-all duration-200 shadow-lg
                       border-4 border-yellow-600/50 shadow-amber-500/50"
            >
              {gameData.centerLetter}
            </button>
            {shuffledLetters.map((letter, index) => {
              const pos = getLetterPosition(index, shuffledLetters.length);
              return (
                <button
                  key={index}
                  onClick={() => addLetter(letter)}
                  className="absolute w-14 h-14 bg-gradient-to-r from-purple-600/80 to-indigo-700/80 text-white text-xl font-bold 
                           rounded-full hover:from-purple-500/90 hover:to-indigo-600/90 transition-all duration-200 
                           shadow-lg transform -translate-x-1/2 -translate-y-1/2 border-2 border-purple-400/30"
                  style={{ left: `${150 + pos.x}px`, top: `${150 + pos.y}px` }}
                >
                  {letter}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-6">
            <button onClick={removeLetter} className="px-4 py-2 bg-gradient-to-r from-red-600/80 to-red-700/80 text-white rounded-lg hover:from-red-500/90 hover:to-red-600/90 transition-all duration-300 transform hover:scale-105 shadow-lg border border-red-500/30">
              ⌫ Delete
            </button>
            <button onClick={clearWord} className="px-4 py-2 bg-gradient-to-r from-gray-600/80 to-gray-700/80 text-white rounded-lg hover:from-gray-500/90 hover:to-gray-600/90 transition-all duration-300 transform hover:scale-105 shadow-lg border border-gray-500/30">
              🗑 Clear
            </button>
            <button onClick={submitWord} className="px-6 py-2 bg-gradient-to-r from-green-600/80 to-green-700/80 text-white rounded-lg hover:from-green-500/90 hover:to-green-600/90 transition-all duration-300 transform hover:scale-105 shadow-lg border border-green-500/30 font-semibold">
              ✓ Submit
            </button>
            <button onClick={shuffleLetters} className="px-4 py-2 bg-gradient-to-r from-blue-600/80 to-blue-700/80 text-white rounded-lg hover:from-blue-500/90 hover:to-blue-600/90 transition-all duration-300 transform hover:scale-105 shadow-lg border border-blue-500/30">
              🔄 Shuffle
            </button>
          </div>
        </div>
        {/* Found Words List */}
        <div className="bg-black/30 backdrop-blur-sm rounded-lg p-6 border border-amber-500/30">
          <h2 className="text-xl font-semibold text-amber-200 mb-4">Found Words</h2>
          <div className="max-h-96 overflow-y-auto">
            {foundWords.length === 0 ? (
              <p className="text-amber-100/70 text-center italic">No words found yet...</p>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {foundWords.map((word, index) => (
                  <div key={index} className="flex justify-between items-center bg-black/20 rounded-lg p-3 border border-amber-500/20 hover:bg-black/40 transition-colors">
                    <span className="font-mono font-medium text-amber-100">{word}</span>
                    <span className="text-sm text-yellow-300 font-semibold">
                      {calculatePoints(word)} pts
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Handle next stage navigation
  const handleNextStage = () => {
    console.log('Next Stage button clicked - returning to TowerLevelsPage');
    if (onBack) {
      console.log('Calling onBack to return to TowerLevelsPage');
      onBack();
    } else {
      console.error('onBack function not provided');
    }
  };

  const renderFinishedScreen = () => (
     <div className="relative z-10 w-full max-w-2xl text-center">
      <h1 className="text-5xl font-bold text-amber-100 mb-4 drop-shadow-lg">Time's Up!</h1>
      <div className="bg-black/40 backdrop-blur-sm rounded-lg p-8 border border-amber-500/30">
        <h3 className="text-2xl font-semibold text-amber-200 mb-4">Your Results</h3>
        <div className="text-4xl font-bold text-amber-100 mb-2">
          Final Score: <span className="text-yellow-300">{score}</span>
        </div>
        {gameDataStage && (
          <div className="text-lg text-amber-100/80 mb-4">
            Target Score: <span className="text-amber-200 font-semibold">{gameDataStage.target_score}</span>
          </div>
        )}
        {gameDataStage && (
          <div className={`text-xl font-bold mb-4 ${score >= gameDataStage.target_score ? 'text-green-400' : 'text-red-400'}`}>
            {score >= gameDataStage.target_score ? '🎉 Stage Completed!' : '❌ Stage Failed'}
          </div>
        )}
        <div className="text-xl text-amber-100/80 mb-6">
          You found <span className="text-yellow-300 font-semibold">{foundWords.length}</span> words.
        </div>
         <div className="max-h-60 overflow-y-auto bg-black/20 p-4 rounded-lg border border-amber-500/20">
           {foundWords.length > 0 ? (
             <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
               {foundWords.map((word, index) => (
                 <div key={index} className="text-amber-100 font-mono">{word}</div>
               ))}
             </div>
           ) : (
             <p className="text-amber-100/70 italic">You didn't find any words.</p>
           )}
         </div>
        <div className="flex gap-4 mt-8">
          <button
            onClick={restartGame}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-xl font-bold rounded-lg 
                       hover:from-blue-500 hover:to-blue-600 transition-all duration-300 transform hover:scale-105 shadow-lg border border-blue-500/30"
          >
            Play Again
          </button>
          {(nextStageUnlocked || (gameDataStage && score >= gameDataStage.target_score)) && (
            <button
              onClick={handleNextStage}
              className="px-8 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white text-xl font-bold rounded-lg 
                         hover:from-green-500 hover:to-green-600 transition-all duration-300 transform hover:scale-105 shadow-lg border border-green-500/30"
            >
              Next Stage
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 relative"
      style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e3a8a 100%)'
      }}
    >
      {onBack && (
        <button
          onClick={onBack}
          className="absolute top-4 left-4 bg-black/30 hover:bg-black/40 text-amber-100 px-4 py-2 rounded-lg transition-colors z-20 border border-amber-500/30"
        >
          ← Back to Menu
        </button>
      )}

      <div className="absolute inset-0 bg-black/40"></div>

      {/* Background decoration */}
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
      
      {/* Conditionally render game screens */}
      {loading ? (
        <div className="relative z-10 w-full max-w-2xl text-center">
          <div className="bg-black/40 backdrop-blur-sm rounded-lg p-8 border border-amber-500/30">
            <h2 className="text-2xl font-semibold text-amber-200 mb-4">Loading...</h2>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-100 mx-auto"></div>
          </div>
        </div>
      ) : (
        <>
          {gameState === 'rules' && renderRulesScreen()}
          {gameState === 'playing' && renderGameScreen()}
          {gameState === 'finished' && renderFinishedScreen()}
        </>
      )}
      
    </div>
  );
};

export default WordSpree;
