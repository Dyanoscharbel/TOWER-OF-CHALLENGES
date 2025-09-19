import React, { useState, useEffect, useCallback, useRef } from 'react';

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const EMPTY_CELL = 0;

type Cell = { value: number; color: string };
type Piece = { shape: number[][]; color: string; x: number; y: number };
type Stage = { id: number; nom: string; description: string; regles: string; niveau: number; target_score: number };

// Définition des pièces Tetris (Tetrominos)
const TETROMINOES: Record<string, { shape: number[][]; color: string }> = {
  I: {
    shape: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ],
    color: '#00f5ff'
  },
  O: {
    shape: [
      [1, 1],
      [1, 1]
    ],
    color: '#ffd700'
  },
  T: {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    color: '#da70d6'
  },
  S: {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0]
    ],
    color: '#32cd32'
  },
  Z: {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0]
    ],
    color: '#ff6347'
  },
  J: {
    shape: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    color: '#1e90ff'
  },
  L: {
    shape: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0]
    ],
    color: '#ff8c00'
  }
};

const TETROMINO_NAMES = Object.keys(TETROMINOES) as Array<keyof typeof TETROMINOES>;

// Créer une grille vide
const createEmptyBoard = (): Cell[][] => 
  Array.from({ length: BOARD_HEIGHT }, () => 
    Array.from({ length: BOARD_WIDTH }, () => ({ value: EMPTY_CELL, color: 'transparent' }))
  );

// Obtenir un tetromino aléatoire
const getRandomTetromino = (): Piece => {
  const name = TETROMINO_NAMES[Math.floor(Math.random() * TETROMINO_NAMES.length)];
  const entry = TETROMINOES[name as string] as { shape: number[][]; color: string };
  const shape = entry.shape;
  const color = entry.color;
  return {
    shape,
    color,
    x: Math.floor(BOARD_WIDTH / 2) - Math.floor(shape[0]!.length / 2),
    y: 0
  };
};

// Faire tourner une matrice de 90 degrés
const rotatePiece = (piece: Piece): Piece => {
  const rotated = piece.shape[0]!.map((_, index) =>
    piece.shape.map((row: number[]) => row[index]!).reverse()
  );
  return { ...piece, shape: rotated };
};

// Vérifier les collisions
const isValidPosition = (board: Cell[][], piece: Piece, dx: number = 0, dy: number = 0): boolean => {
  for (let y = 0; y < piece.shape.length; y++) {
    const row = piece.shape[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x++) {
      const cell = row[x];
      if (cell) {
        const newX = piece.x + x + dx;
        const newY = piece.y + y + dy;
        
        if (newX < 0 || newX >= BOARD_WIDTH || newY >= BOARD_HEIGHT) {
          return false;
        }
        
        if (newY >= 0 && newY < BOARD_HEIGHT && newX >= 0 && newX < BOARD_WIDTH) {
          const row = board[newY];
          const cell = row && row[newX];
          if (cell && cell.value !== EMPTY_CELL) {
          return false;
          }
        }
      }
    }
  }
  return true;
};

// Placer la pièce sur le plateau
const placePiece = (board: Cell[][], piece: Piece): Cell[][] => {
  const newBoard: Cell[][] = board.map((row: Cell[]) => [...row]);
  
  for (let y = 0; y < piece.shape.length; y++) {
    const row = piece.shape[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x++) {
      const filled = row[x];
      if (filled) {
        const boardY = piece.y + y;
        const boardX = piece.x + x;
        if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH && newBoard[boardY]) {
          newBoard[boardY]![boardX] = { value: 1, color: piece.color };
        }
      }
    }
  }
  
  return newBoard;
};

// Effacer les lignes complètes
const clearLines = (board: Cell[][]): { board: Cell[][]; linesCleared: number } => {
  const newBoard: Cell[][] = [];
  let linesCleared = 0;
  
  for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
    if (board[y]!.every((cell: Cell) => cell.value !== EMPTY_CELL)) {
      linesCleared++;
    } else {
      newBoard.unshift(board[y]!);
    }
  }
  
  // Ajouter de nouvelles lignes vides en haut
  while (newBoard.length < BOARD_HEIGHT) {
    newBoard.unshift(Array.from({ length: BOARD_WIDTH }, () => ({ value: EMPTY_CELL, color: 'transparent' })) as Cell[]);
  }
  
  return { board: newBoard, linesCleared };
};

interface TetrisGameProps {
  onBack?: () => void;
}

const Tetris: React.FC<TetrisGameProps> = ({ onBack }) => {
  const [gameState, setGameState] = useState('menu'); // menu, playing, gameOver
  const [board, setBoard] = useState<Cell[][]>(createEmptyBoard);
  const [currentPiece, setCurrentPiece] = useState<Piece>(getRandomTetromino);
  const [nextPiece, setNextPiece] = useState<Piece>(getRandomTetromino);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [bestScore, setBestScore] = useState(0);
  // Stage data from DB
  const [stageData, setStageData] = useState<Stage | null>(null);
  const [loadingStage, setLoadingStage] = useState<boolean>(true);
  // Player & progression
  const [playerData, setPlayerData] = useState<{ reddit_id: string } | null>(null);
  const [progressionSaved, setProgressionSaved] = useState<boolean>(false);
  const [nextStageUnlocked, setNextStageUnlocked] = useState<boolean>(false);
  // Sounds
  const clickSfxRef = useRef<HTMLAudioElement | null>(null);
  const successSfxRef = useRef<HTMLAudioElement | null>(null);
  const loseSfxRef = useRef<HTMLAudioElement | null>(null);

  // États pour les contrôles tactiles
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const [touchStartTime, setTouchStartTime] = useState<number>(0);

  // Déplacer la pièce vers le bas
  const dropPiece = useCallback(() => {
    if (isPaused || isGameOver) return;

    setCurrentPiece(prevPiece => {
      if (isValidPosition(board, prevPiece, 0, 1)) {
        return { ...prevPiece, y: prevPiece.y + 1 };
      } else {
        // Placer la pièce et générer une nouvelle
        const newBoard = placePiece(board, prevPiece);
        const { board: clearedBoard, linesCleared } = clearLines(newBoard);
        
        const gained = linesCleared * 100 * level;
        setBoard(clearedBoard);
        setScore(prev => prev + gained);
        setLines(prev => prev + linesCleared);
        setLevel(() => Math.floor((lines + linesCleared) / 10) + 1);
        if (linesCleared > 0) {
          try { successSfxRef.current?.play().catch(() => {}); } catch (_) {}
        }
        
        // Vérifier si le jeu est terminé
        if (!isValidPosition(clearedBoard, nextPiece)) {
          setIsGameOver(true);
          const finalScore = score + gained;
          endGame();
          // Save progression at game over
          const achieved = stageData?.target_score ? finalScore >= stageData.target_score : false;
          setNextStageUnlocked(!!achieved);
          submitProgression(finalScore, achieved);
          return prevPiece;
        }
        
        setNextPiece(getRandomTetromino());
        return nextPiece;
      }
    });
  }, [board, nextPiece, level, lines, isPaused, isGameOver]);

  // Déplacer la pièce horizontalement
  const movePiece = (dx: number) => {
    if (isPaused || isGameOver) return;
    
    setCurrentPiece(prevPiece => {
      if (isValidPosition(board, prevPiece, dx, 0)) {
        return { ...prevPiece, x: prevPiece.x + dx };
      }
      return prevPiece;
    });
  };

  // Faire tourner la pièce avec Wall Kick
  const rotatePieceHandler = () => {
    if (isPaused || isGameOver) return;
    try { clickSfxRef.current?.play().catch(() => {}); } catch (_) {}

    setCurrentPiece(prevPiece => {
      const rotated = rotatePiece(prevPiece);

      // Tests de décalage (Wall Kick)
      const kickOffsets: Array<[number, number]> = [
        [0, 0],   // Pas de décalage
        [-1, 0],  // Gauche
        [1, 0],   // Droite
        [0, -1],  // Haut (floor kick)
        [-2, 0],  // Gauche (pour la pièce I)
        [2, 0],   // Droite (pour la pièce I)
        [-1, -1], // Diagonale haut-gauche
        [1, -1],  // Diagonale haut-droite
      ];

      for (const [dx, dy] of kickOffsets) {
        if (isValidPosition(board, rotated, dx, dy)) {
          return { ...rotated, x: rotated.x + dx, y: rotated.y + dy };
        }
      }

      // Si aucune rotation n'est possible, retourner la pièce originale
      return prevPiece;
    });
  };

  // Chute rapide
  const hardDrop = () => {
    if (isPaused || isGameOver) return;
    try { clickSfxRef.current?.play().catch(() => {}); } catch (_) {}
    
    setCurrentPiece(prevPiece => {
      let newY = prevPiece.y;
      while (isValidPosition(board, { ...prevPiece, y: newY + 1 })) {
        newY++;
      }
      return { ...prevPiece, y: newY };
    });
  };

  // Redémarrer le jeu
  const resetGame = () => {
    setBoard(createEmptyBoard());
    setCurrentPiece(getRandomTetromino());
    setNextPiece(getRandomTetromino());
    setScore(0);
    setLines(0);
    setLevel(1);
    setIsGameOver(false);
    setIsPaused(false);
    setGameState('playing');
    setProgressionSaved(false);
  };
  
  // Terminer le jeu
  const endGame = () => {
    try { loseSfxRef.current?.play().catch(() => {}); } catch (_) {}
    if (score > bestScore) {
      setBestScore(score);
    }
    setGameState('gameOver');
    // Progression will be saved in dropPiece branch when game over occurs.
  };

  // Gestion des touches
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          movePiece(-1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          movePiece(1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          dropPiece();
          break;
        case 'ArrowUp':
          e.preventDefault();
          rotatePieceHandler();
          break;
        case ' ':
          e.preventDefault();
          hardDrop();
          break;
        case 'p':
        case 'P':
          setIsPaused(prev => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [dropPiece]);

  // Timer pour la chute automatique
  useEffect(() => {
    if (isPaused || isGameOver) return;
    
    const interval = setInterval(() => {
      dropPiece();
    }, Math.max(100, 1000 - (level - 1) * 100));

    return () => clearInterval(interval);
  }, [dropPiece, level, isPaused, isGameOver]);

  // Load current player
  useEffect(() => {
    const loadPlayer = async () => {
      try {
        const res = await fetch('/api/player/init');
        if (res.ok) {
          const json = await res.json();
          if (json.status === 'success' && json.data) {
            setPlayerData({ reddit_id: json.data.reddit_id });
          }
        }
      } catch (_) {}
    };
    loadPlayer();
  }, []);

  // Init sounds
  useEffect(() => {
    try {
      const sfxVolume = parseFloat(localStorage.getItem('sfxVolume') || '0.8');
      clickSfxRef.current = new Audio('/click_reaction_dash.mp3');
      clickSfxRef.current.volume = Math.min(Math.max(sfxVolume * 0.6, 0), 1);
      successSfxRef.current = new Audio('/success.mp3');
      successSfxRef.current.volume = Math.min(Math.max(sfxVolume, 0), 1);
      loseSfxRef.current = new Audio('/lose.mp3');
      loseSfxRef.current.volume = Math.min(Math.max(sfxVolume, 0), 1);
    } catch (_) {}
  }, []);

  // Save progression helper
  const submitProgression = useCallback(async (finalScore: number, completed: boolean) => {
    if (!playerData || !stageData || progressionSaved) return;
    try {
      const getRes = await fetch(`/api/progression?joueur_id=${encodeURIComponent(playerData.reddit_id)}&etage_id=${encodeURIComponent(String(stageData.id))}`);
      if (getRes.ok) {
        const getJson = await getRes.json();
        if (getJson.status === 'success' && getJson.data) {
          const existing = getJson.data as { score: number };
          if (finalScore > existing.score) {
            await fetch('/api/progression/update', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                joueur_id: playerData.reddit_id,
                etage_id: stageData.id,
                score: finalScore,
                completed
              })
            });
          }
        } else {
          await fetch('/api/progression/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              joueur_id: playerData.reddit_id,
              etage_id: stageData.id,
              score: finalScore,
              completed
            })
          });
        }
      } else if (getRes.status === 404) {
        await fetch('/api/progression/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            joueur_id: playerData.reddit_id,
            etage_id: stageData.id,
            score: finalScore,
            completed
          })
        });
      }

      if (completed && stageData?.niveau !== undefined) {
        try {
          await fetch('/api/player/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ etage_actuel: stageData.niveau + 1 })
          });
        } catch (_) {}
      }

      setProgressionSaved(true);
    } catch (_) {}
  }, [playerData, stageData, progressionSaved]);

  // Load stage data (description & rules) from API
  const loadStageData = useCallback(async () => {
    try {
      setLoadingStage(true);
      const res = await fetch('/api/stages');
      if (!res.ok) return;
      const json = await res.json();
      if (json.status === 'success' && Array.isArray(json.data)) {
        let found: Stage | null = json.data.find((s: Stage) => (s.nom || '').toLowerCase().includes('tetris')) || null;
        if (!found) {
          const variants = ['tetris game', 'tetromino'];
          found = json.data.find((s: Stage) => s.nom && variants.some((v: string) => s.nom.toLowerCase().includes(v))) || null;
        }
        if (found) setStageData(found);
      }
    } catch (e) {
      // ignore
    } finally {
      setLoadingStage(false);
    }
  }, []);

  useEffect(() => {
    loadStageData();
  }, [loadStageData]);

  // Calculer la position de la pièce fantôme
  const getGhostPiece = (): Piece => {
    let ghost: Piece = { ...currentPiece };
    while (isValidPosition(board, ghost, 0, 1)) {
      ghost.y++;
    }
    return ghost;
  };

  // Créer le plateau de jeu avec la pièce actuelle et la pièce fantôme
  const getBoardWithCurrentPiece = (): Cell[][] => {
    const boardCopy: Cell[][] = board.map((row: Cell[]) => [...row]);
    const ghostPiece: Piece = getGhostPiece();

    // Dessiner la pièce fantôme d'abord
    for (let y = 0; y < ghostPiece.shape.length; y++) {
    const row = ghostPiece.shape[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x++) {
      if (row[x]) {
          const boardY = ghostPiece.y + y;
          const boardX = ghostPiece.x + x;
          if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
          if (boardCopy[boardY] && boardCopy[boardY]![boardX] && boardCopy[boardY]![boardX]!.value === EMPTY_CELL) {
            boardCopy[boardY]![boardX] = { value: 2, color: currentPiece.color }; // 2 pour la pièce fantôme
            }
          }
        }
      }
    }
    
    // Dessiner la pièce actuelle par-dessus
    for (let y = 0; y < currentPiece.shape.length; y++) {
    const row2 = currentPiece.shape[y];
    if (!row2) continue;
    for (let x = 0; x < row2.length; x++) {
      if (row2[x]) {
          const boardY = currentPiece.y + y;
          const boardX = currentPiece.x + x;
          if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
          if (boardCopy[boardY]) {
            boardCopy[boardY]![boardX] = { value: 1, color: currentPiece.color };
          }
          }
        }
      }
    }
    
    return boardCopy;
  };

  const displayBoard = getBoardWithCurrentPiece();

  // Gestionnaires pour les événements tactiles
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Empêcher le scroll/zoom par défaut sur mobile
    e.preventDefault();
    if (isPaused || isGameOver || !e.touches[0]) return;
    setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    setTouchEnd(null);
    setTouchStartTime(Date.now());
  }, [isPaused, isGameOver]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // Empêcher le scroll pendant le déplacement
    e.preventDefault();
    if (!touchStart || isPaused || isGameOver || !e.touches[0]) return;
    setTouchEnd({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  }, [touchStart, isPaused, isGameOver]);

  const handleTouchEnd = useCallback(() => {
    if (!touchStart || isPaused || isGameOver) return;

    const touchDuration = Date.now() - touchStartTime;
    const minSwipeDistance = 30;

    // Si le toucher est très court et a peu bougé, c'est un TAP pour la rotation
    if (touchDuration < 250 && (!touchEnd || (Math.abs(touchStart.x - (touchEnd?.x || 0)) < minSwipeDistance && Math.abs(touchStart.y - (touchEnd?.y || 0)) < minSwipeDistance))) {
      rotatePieceHandler();
    } else if (touchEnd) {
      const xDistance = touchEnd.x - touchStart.x;
      const yDistance = touchEnd.y - touchStart.y;

      // Si le mouvement vertical est dominant
      if (Math.abs(yDistance) > Math.abs(xDistance)) {
        if (yDistance > minSwipeDistance) { // Glisser vers le bas
          hardDrop();
        }
      } else { // Si le mouvement horizontal est dominant
        if (Math.abs(xDistance) > minSwipeDistance) {
          movePiece(xDistance > 0 ? 1 : -1);
        }
      }
    }

    setTouchStart(null);
    setTouchEnd(null);
  }, [touchStart, touchEnd, touchStartTime, isPaused, isGameOver, rotatePieceHandler, movePiece, hardDrop]);

  // Menu principal
  if (gameState === 'menu') {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-2 sm:p-4 relative"
        style={{
          backgroundImage: 'url(/Tetris.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {onBack && (
          <button
            onClick={onBack}
            className="absolute top-2 left-2 sm:top-4 sm:left-4 bg-black/30 hover:bg-black/40 text-amber-100 px-3 py-2 sm:px-4 sm:py-2 rounded-lg transition-colors z-10 border border-amber-500/30 text-sm sm:text-base"
          >
            ← Back to menu
          </button>
        )}
        
        <div className="absolute inset-0 bg-black/30"></div>
        
        

        <div className="bg-black/40 backdrop-blur-sm rounded-lg p-4 sm:p-8 max-w-sm sm:max-w-md w-full mx-2 text-center border border-amber-500/30 relative z-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-amber-100 mb-4 sm:mb-6 drop-shadow-lg">⚡ TETRIS ⚡</h1>
          
          <div className="bg-black/20 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 border border-amber-700/20">
            <h2 className="text-base sm:text-lg font-semibold text-amber-200 mb-2 sm:mb-3">Game Rules:</h2>
            {loadingStage ? (
              <div className="text-amber-200 text-center text-sm">Loading game data...</div>
            ) : (
              <div className="text-amber-100/80 text-xs sm:text-sm leading-relaxed space-y-3 text-left px-2 sm:px-4">
                {stageData?.description && (
                  <div className="mb-2">
                    <h3 className="font-bold text-amber-200 mb-1">Description:</h3>
                    <div className="whitespace-pre-wrap">{stageData.description}</div>
                  </div>
                )}
                {stageData?.regles ? (
              <div>
                    <h3 className="font-bold text-amber-200 mb-1">Rules:</h3>
                    <div className="text-amber-100/80" dangerouslySetInnerHTML={{ __html: stageData.regles.replace(/\n/g, '<br/>') }} />
              </div>
                ) : (
              <div>
                    <h3 className="font-bold text-amber-200 mb-1">Controls:</h3>
                    <p>• Use Left/Right to move</p>
                    <p>• Up to rotate, Space to hard drop</p>
                    <p>• On touch: tap to rotate, swipe to move, swipe down to drop</p>
              </div>
                )}
            </div>
            )}
          </div>

          {bestScore > 0 && (
            <div className="mb-4 sm:mb-6 text-amber-100/90">
              <p className="text-base sm:text-lg">Best Score: <span className="font-bold text-yellow-300">{bestScore}</span></p>
            </div>
          )}

          <button
            onClick={resetGame}
            className="w-full bg-gradient-to-r from-amber-600/80 to-yellow-600/80 text-white py-3 px-4 sm:px-6 rounded-lg 
                    font-semibold hover:from-amber-700/90 hover:to-yellow-700/90 transition-all duration-300 
                    transform hover:scale-105 shadow-lg border border-amber-500/30 relative z-20 cursor-pointer text-sm sm:text-base"
          >
            Start Game
          </button>
        </div>
      </div>
    );
  }
  
  // Écran de fin de jeu
  if (gameState === 'gameOver') {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-2 sm:p-4 relative"
        style={{
          backgroundImage: 'url(/Tetris.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {onBack && (
          <button
            onClick={onBack}
            className="absolute top-2 left-2 sm:top-4 sm:left-4 bg-black/30 hover:bg-black/40 text-amber-100 px-3 py-2 sm:px-4 sm:py-2 rounded-lg transition-colors z-10 border border-amber-500/30 text-sm sm:text-base"
          >
            ← Back to menu
          </button>
        )}

        <div className="absolute inset-0 bg-black/40"></div>

        

        <div className="bg-black/50 backdrop-blur-sm rounded-lg p-4 sm:p-8 max-w-sm sm:max-w-md w-full mx-2 text-center border border-amber-500/30 relative z-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-amber-100 mb-4 sm:mb-6 drop-shadow-lg">
            Game Over
          </h1>
          
          <div className="mb-4 sm:mb-6 space-y-3 sm:space-y-4">
            <div className="text-amber-100">
              <p className="text-lg sm:text-xl">Final Score:</p>
              <p className="text-3xl sm:text-4xl font-bold text-yellow-300">{score}</p>
            </div>
            
            <div className="text-amber-100">
              <p className="text-base sm:text-lg">Lines Cleared: <span className="font-bold text-green-300">{lines}</span></p>
              <p className="text-base sm:text-lg">Level Reached: <span className="font-bold text-blue-300">{level}</span></p>
            </div>

            {(score === bestScore && score > 0) && (
              <div className="text-yellow-300 text-base sm:text-lg font-bold animate-pulse">
                🏆 New High Score! 🏆
              </div>
            )}

            {nextStageUnlocked && (
              <div className="text-green-300 text-base sm:text-lg font-bold">
                ✅ Next stage unlocked!
              </div>
            )}
          </div>

          <div className="space-y-3">
            <button
              onClick={resetGame}
              className="w-full bg-gradient-to-r from-amber-600/80 to-yellow-600/80 text-white py-3 px-4 sm:px-6 rounded-lg 
                      font-semibold hover:from-amber-700/90 hover:to-yellow-700/90 transition-all duration-300 
                      transform hover:scale-105 shadow-lg border border-amber-500/30 cursor-pointer z-20 pointer-events-auto text-sm sm:text-base"
            >
              Play Again
            </button>
            
            <button
              onClick={() => setGameState('menu')}
              className="w-full bg-gradient-to-r from-gray-600/80 to-gray-700/80 text-white py-3 px-4 sm:px-6 rounded-lg 
                      font-semibold hover:from-gray-700/90 hover:to-gray-800/90 transition-all duration-300 
                      transform hover:scale-105 shadow-lg border border-gray-500/30 cursor-pointer z-20 pointer-events-auto text-sm sm:text-base"
            >
              Back to Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Écran de jeu principal
  return (
    <div 
      className="min-h-screen flex items-center justify-center relative overflow-auto"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        backgroundImage: 'url(/Tetris.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        touchAction: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none'
      }}
    >
      <div className="absolute inset-0 bg-black/60"></div>
      
      
      
      <div className="relative z-10 w-full min-h-screen py-1 px-1" style={{ transform: "scale(0.95)", transformOrigin: "center top" }}>
        {/* Titre compact */}
        <h1 className="text-lg sm:text-xl font-bold mb-2 text-amber-100 drop-shadow-lg text-center">⚡ TETRIS ⚡</h1>
        
        {/* Layout en trois colonnes : Infos | Plateau | Contrôles */}
        <div className="flex items-start justify-center gap-2 sm:gap-3 min-h-[calc(100vh-50px)]">
          
          {/* COLONNE GAUCHE - Informations et Stats */}
          <div className="flex flex-col gap-2 w-24 sm:w-28 lg:w-32">
            {/* Score, Lines, Level - Stack vertical */}
            <div className="bg-black/80 backdrop-blur-sm rounded-lg border border-amber-600/50 p-2">
              <div className="text-amber-100 text-center mb-3">
                <div className="text-xs font-semibold text-yellow-300">SCORE</div>
                <div className="text-sm font-bold">{score.toLocaleString()}</div>
              </div>
              <div className="text-amber-100 text-center mb-3">
                <div className="text-xs font-semibold text-green-300">LINES</div>
                <div className="text-sm font-bold">{lines}</div>
              </div>
              <div className="text-amber-100 text-center">
                <div className="text-xs font-semibold text-blue-300">LEVEL</div>
                <div className="text-sm font-bold">{level}</div>
              </div>
            </div>

            {/* Prochaine pièce */}
            <div className="bg-black/80 backdrop-blur-sm rounded-lg border border-amber-600/50 p-2">
              <h3 className="text-sm font-bold text-amber-400 mb-2 text-center">NEXT</h3>
              <div className="flex items-center justify-center h-16">
                <div 
                  className="grid gap-0 bg-black"
                  style={{ 
                    gridTemplateColumns: `repeat(4, 1fr)`,
                    width: 'fit-content'
                  }}
                >
                  {(() => {
                    // Trouver les limites réelles de la pièce
                    let minX = 4, maxX = 0, minY = 4, maxY = 0;
                    for (let y = 0; y < nextPiece.shape.length; y++) {
                      const row = nextPiece.shape[y];
                      if (!row) continue;
                      for (let x = 0; x < row.length; x++) {
                        if (row[x]) {
                          minX = Math.min(minX, x);
                          maxX = Math.max(maxX, x);
                          minY = Math.min(minY, y);
                          maxY = Math.max(maxY, y);
                        }
                      }
                    }
                    
                    // Dessiner la pièce centrée
                    const width = maxX - minX + 1;
                    const height = maxY - minY + 1;
                    const offsetX = Math.floor((4 - width) / 2);
                    const offsetY = Math.floor((4 - height) / 2);
                    
                    return Array.from({ length: 16 }, (_, i) => {
                      const y = Math.floor(i / 4);
                      const x = i % 4;
                      let isPartOfPiece = false;
                      
                      const pieceY = y - offsetY + minY;
                      const pieceX = x - offsetX + minX;
                      
                      if (pieceY >= 0 && pieceY < nextPiece.shape.length) {
                        const row = nextPiece.shape[pieceY];
                        if (row && pieceX >= 0 && pieceX < row.length) {
                          isPartOfPiece = row[pieceX] === 1;
                        }
                      }
                      
                      return (
                        <div
                          key={i}
                          className="w-3 h-3 sm:w-4 sm:h-4 rounded-sm"
                          style={{
                            backgroundColor: isPartOfPiece ? nextPiece.color : '#111111',
                            boxShadow: isPartOfPiece ? 'inset 0 0 3px rgba(255,255,255,0.6)' : 'none',
                            border: isPartOfPiece ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(100,100,100,0.1)'
                          }}
                        />
                      );
                    });
                  })()}
                </div>
              </div>
            </div>

            {/* Best Score */}
            {bestScore > 0 && (
              <div className="bg-black/80 backdrop-blur-sm rounded-lg border border-amber-600/50 p-2">
                <div className="text-xs font-semibold text-amber-400 text-center mb-1">BEST</div>
                <div className="text-sm font-bold text-yellow-300 text-center">{bestScore.toLocaleString()}</div>
              </div>
            )}
          </div>

          {/* COLONNE CENTRALE - Plateau de jeu */}
          <div className="relative flex-shrink-0" style={{ width: "min(65vw, 380px)", height: "min(85vh, 760px)" }}>
            <div className="bg-black/80 backdrop-blur-sm rounded-lg shadow-2xl border-2 border-amber-600/50 h-full overflow-hidden">
              {/* Grille de jeu */}
              <div className="h-full p-2">
                <div 
                  className="grid gap-0 bg-black/10 backdrop-blur-md p-2 border border-amber-400/10 rounded-2xl shadow-[0_4px_32px_rgba(255,200,80,0.05)] w-full h-full relative transition-all duration-300"
                  style={{ 
                    gridTemplateColumns: `repeat(${BOARD_WIDTH}, 1fr)`, 
                    aspectRatio: `${BOARD_WIDTH}/${BOARD_HEIGHT}` 
                  }}
                >
                  {displayBoard.map((row, y) =>
                    row.map((cell, x) => (
                      <div
                        key={`${y}-${x}`}
                        className={`transition-all duration-200 border-2 ${ 
                          cell.value === EMPTY_CELL 
                            ? 'bg-black/20 border-gray-800/80'
                            : cell.value === 1 // Pièce normale
                            ? 'border-white/20'
                            : 'border-white/10' // Pièce fantôme
                        }`}
                        style={{
                          background: cell.value !== EMPTY_CELL ? cell.color : 'transparent',
                          opacity: cell.value === 2 ? 0.25 : 1, // Pièce fantôme plus transparente
                          boxShadow: cell.value === 1 
                            ? `inset 0 0 5px rgba(255,255,255,0.5), 0 0 3px ${cell.color}`
                            : 'none',
                          filter: cell.value === 1 ? 'brightness(1.1)' : 'none',
                          transition: 'all 0.2s ease'
                        }}
                      />
                    ))
                  )}
                  
                  {/* Overlay de pause/game over */}
                  {(isPaused || isGameOver) && (
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center rounded-sm border border-amber-600/30">
                      <div className="text-center px-2">
                        <div className="text-lg sm:text-xl font-bold mb-3 text-amber-100">
                          {isGameOver ? '⚠️ GAME OVER ⚠️' : '⏸️ PAUSE ⏸️'}
                        </div>
                        {isGameOver && (
                          <button
                            onClick={resetGame}
                            className="bg-gradient-to-r from-amber-600/80 to-yellow-600/80 hover:from-amber-700/90 hover:to-yellow-700/90 text-white px-4 py-2 rounded-lg font-bold shadow-lg border border-amber-500/30 transition-all duration-300 transform hover:scale-105 text-sm"
                          >
                            PLAY AGAIN
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* COLONNE DROITE - Contrôles */}
          <div className="flex flex-col gap-2 w-24 sm:w-28 lg:w-32">
            {/* Boutons d'action */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setIsPaused(!isPaused)}
                className="w-full bg-gradient-to-r from-purple-600/90 to-indigo-600/90 hover:from-purple-700 hover:to-indigo-700 text-white py-2 rounded-md font-bold shadow-lg border border-purple-500/30 text-xs"
                disabled={isGameOver}
              >
                {isPaused ? 'RESUME' : 'PAUSE'}
              </button>
              
              <button
                onClick={resetGame}
                className="w-full bg-gradient-to-r from-amber-600/90 to-yellow-600/90 hover:from-amber-700 hover:to-yellow-700 text-white py-2 rounded-md font-bold shadow-lg border border-amber-500/30 text-xs"
              >
                RESTART
              </button>
              
              <button
                onClick={() => setGameState('menu')}
                className="w-full bg-gradient-to-r from-gray-600/90 to-gray-700/90 hover:from-gray-700 hover:to-gray-800 text-white py-2 rounded-md font-bold shadow-lg border border-gray-500/30 text-xs"
              >
                MENU
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tetris;