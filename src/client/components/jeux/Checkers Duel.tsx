import { useState, useCallback, useEffect, useRef } from 'react';

const BOARD_SIZE = 8;
const EMPTY = 0;
const WHITE_PIECE = 1;
const BLACK_PIECE = 2;
const WHITE_KING = 3;
const BLACK_KING = 4;

const HUMAN_PLAYER = WHITE_PIECE;
const AI_PLAYER = BLACK_PIECE;

type Board = number[][];
type Difficulty = 'easy' | 'medium' | 'hard';
type Coord = { row: number; col: number };
type Move = {
  from: Coord;
  to: Coord;
  type: 'move' | 'capture';
  capturedRow?: number;
  capturedCol?: number;
};
type Stage = { id: number; nom: string; description: string; regles: string; niveau: number; target_score: number };

interface CheckersGameProps {
  onBack: () => void;
}

const CheckersGame = ({ onBack }: CheckersGameProps) => {
  // Initialisation du plateau
  const initializeBoard = (): Board => {
    const board: Board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(EMPTY));
    
    // Placement des pièces noires (IA - en haut)
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if ((row + col) % 2 === 1) {
          board[row]![col] = BLACK_PIECE;
        }
      }
    }
    
    // Placement des pièces blanches (Humain - en bas)
    for (let row = 5; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if ((row + col) % 2 === 1) {
          board[row]![col] = WHITE_PIECE;
        }
      }
    }
    
    return board;
  };

  const [board, setBoard] = useState<Board>(initializeBoard);
  const [currentPlayer, setCurrentPlayer] = useState<number>(HUMAN_PLAYER);
  const [selectedSquare, setSelectedSquare] = useState<Coord | null>(null);
  const [validMoves, setValidMoves] = useState<Coord[]>([]);
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  // Stage data from DB
  const [stageData, setStageData] = useState<Stage | null>(null);
  const [loadingStage, setLoadingStage] = useState<boolean>(true);
  
  // Système de cœurs et personnages
  const [playerHearts, setPlayerHearts] = useState<number>(3);
  const [aiHearts, setAiHearts] = useState<number>(3);
  const [gameStatus, setGameStatus] = useState<string>('');
  const [heartAnimation, setHeartAnimation] = useState<'' | 'player' | 'ai'>('');
  const [characterAnimation, setCharacterAnimation] = useState<{ player: string; ai: string }>({ player: '', ai: '' });
  const [roundWinner, setRoundWinner] = useState<string>('');
  // Audio refs
  const moveSfxRef = useRef<HTMLAudioElement | null>(null);
  const captureSfxRef = useRef<HTMLAudioElement | null>(null);
  const loseHeartSfxRef = useRef<HTMLAudioElement | null>(null);
  const successSfxRef = useRef<HTMLAudioElement | null>(null);
  const loseSfxRef = useRef<HTMLAudioElement | null>(null);
  
  // États pour les différents écrans
  const [showMenu, setShowMenu] = useState(true);
  const [showScoreScreen, setShowScoreScreen] = useState(false);

  // Vérifier si une pièce appartient au joueur donné
  const isPlayerPiece = (piece: number, player: number): boolean => {
    return (player === WHITE_PIECE && (piece === WHITE_PIECE || piece === WHITE_KING)) ||
           (player === BLACK_PIECE && (piece === BLACK_PIECE || piece === BLACK_KING));
  };

  // Vérifier si une pièce est un roi
  const isKing = (piece: number): boolean => piece === WHITE_KING || piece === BLACK_KING;

  // Obtenir les directions de mouvement possibles
  const getDirections = (piece: number): number[][] => {
    if (isKing(piece)) {
      return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    } else if (piece === WHITE_PIECE) {
      return [[-1, -1], [-1, 1]];
    } else if (piece === BLACK_PIECE) {
      return [[1, -1], [1, 1]];
    }
    return [];
  };

  // Calculer les mouvements valides pour une position
  const getValidMoves = useCallback((row: number, col: number, board: Board, player: number = currentPlayer): Move[] => {
    if (!board[row] || board[row][col] === undefined) return [];
    const piece = board[row][col]!;
    if (!isPlayerPiece(piece, player)) return [];

    const moves: Move[] = [];
    const directions = getDirections(piece);
    for (const dir of directions) {
      const [dRow, dCol] = dir as [number, number];
      const newRow = row + dRow;
      const newCol = col + dCol;

      if (newRow >= 0 && newRow < BOARD_SIZE && newCol >= 0 && newCol < BOARD_SIZE) {
        if (board[newRow] && board[newRow]![newCol] === EMPTY) {
          moves.push({ 
            from: { row, col },
            to: { row: newRow, col: newCol },
            type: 'move' 
          });
        }
        else if (board[newRow] && !isPlayerPiece(board[newRow]![newCol]!, player)) {
          const captureRow = newRow + dRow;
          const captureCol = newCol + dCol;
          
          if (captureRow >= 0 && captureRow < BOARD_SIZE && 
              captureCol >= 0 && captureCol < BOARD_SIZE &&
              board[captureRow] && board[captureRow]![captureCol] === EMPTY) {
            moves.push({ 
              from: { row, col },
              to: { row: captureRow, col: captureCol },
              type: 'capture',
              capturedRow: newRow,
              capturedCol: newCol
            });
          }
        }
      }
    }

    return moves;
  }, [currentPlayer]);

  // Obtenir tous les mouvements possibles pour un joueur
  const getAllValidMoves = useCallback((board: Board, player: number): Move[] => {
    const moves: Move[] = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (board[row] && isPlayerPiece(board[row]![col]!, player)) {
          const pieceMoves = getValidMoves(row, col, board, player);
          moves.push(...pieceMoves);
        }
      }
    }
    return moves;
  }, [getValidMoves]);

  // Évaluer la position pour l'IA
  const evaluateBoard = (board: Board): number => {
    let score = 0;
    
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (!board[row]) continue;
        const piece = board[row]![col]!;
        if (piece === BLACK_PIECE) score += 10;
        else if (piece === BLACK_KING) score += 15;
        else if (piece === WHITE_PIECE) score -= 10;
        else if (piece === WHITE_KING) score -= 15;
      }
    }
    
    const aiMoves = getAllValidMoves(board, AI_PLAYER).length;
    const humanMoves = getAllValidMoves(board, HUMAN_PLAYER).length;
    score += (aiMoves - humanMoves) * 2;
    
    return score;
  };

  // Algorithme minimax pour l'IA
  const minimax = (board: Board, depth: number, isMaximizing: boolean, alpha: number = -Infinity, beta: number = Infinity): number => {
    if (depth === 0) {
      return evaluateBoard(board);
    }

    const player = isMaximizing ? AI_PLAYER : HUMAN_PLAYER;
    const moves = getAllValidMoves(board, player);
    
    if (moves.length === 0) {
      return isMaximizing ? -1000 : 1000;
    }

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const move of moves) {
        const newBoard = makeSimulatedMove(board, move);
        const eval_ = minimax(newBoard, depth - 1, false, alpha, beta);
        maxEval = Math.max(maxEval, eval_);
        alpha = Math.max(alpha, eval_);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of moves) {
        const newBoard = makeSimulatedMove(board, move);
        const eval_ = minimax(newBoard, depth - 1, true, alpha, beta);
        minEval = Math.min(minEval, eval_);
        beta = Math.min(beta, eval_);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  };

  // Simuler un mouvement sans modifier l'état
  const makeSimulatedMove = (board: Board, move: Move): Board => {
    const newBoard: Board = board.map(row => [...row]);
    const piece = newBoard[move.from.row]?.[move.from.col] ?? EMPTY;
    
    if (newBoard[move.from.row]) newBoard[move.from.row]![move.from.col] = EMPTY;
    if (newBoard[move.to.row]) newBoard[move.to.row]![move.to.col] = piece;

    if (move.type === 'capture' && move.capturedRow !== undefined && move.capturedCol !== undefined) {
      newBoard[move.capturedRow]![move.capturedCol] = EMPTY;
    }

    if ((piece === WHITE_PIECE && move.to.row === 0) || 
        (piece === BLACK_PIECE && move.to.row === BOARD_SIZE - 1)) {
      if (newBoard[move.to.row]) {
        newBoard[move.to.row]![move.to.col] = piece === WHITE_PIECE ? WHITE_KING : BLACK_KING;
      }
    }

    return newBoard;
  };

  // IA choisit le meilleur mouvement
  const getAIMove = (board: Board): Move | null => {
    const moves = getAllValidMoves(board, AI_PLAYER);
    if (moves.length === 0) return null;

    const depths: Record<Difficulty, number> = { easy: 2, medium: 4, hard: 6 };
    const searchDepth = depths[difficulty];

    let bestMove: Move = moves[0]!;
    let bestScore = -Infinity;

    const randomFactor = difficulty === 'easy' ? 0.3 : difficulty === 'medium' ? 0.1 : 0;

    for (const move of moves) {
      const newBoard = makeSimulatedMove(board, move);
      let score = minimax(newBoard, searchDepth - 1, false);
      
      if (randomFactor > 0) {
        score += (Math.random() - 0.5) * randomFactor * 100;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove;
  };

  // Load stage data (description & rules)
  const loadStageData = useCallback(async () => {
    try {
      setLoadingStage(true);
      const res = await fetch('/api/stages');
      if (!res.ok) return;
      const json = await res.json();
      if (json.status === 'success' && Array.isArray(json.data)) {
        const variants = ['checkers duel', 'checkers', 'dame'];
        const found = json.data.find((s: Stage) => s.nom && variants.some((v: string) => (s.nom as string).toLowerCase().includes(v)) ) || null;
        setStageData(found);
      }
    } catch (_) {
    } finally {
      setLoadingStage(false);
    }
  }, []);

  useEffect(() => { loadStageData(); }, [loadStageData]);

  // Init sounds
  useEffect(() => {
    try {
      const vol = parseFloat(localStorage.getItem('sfxVolume') || '0.8');
      moveSfxRef.current = new Audio('/dame_move_piece.mp3');
      moveSfxRef.current.volume = Math.min(Math.max(vol * 0.7, 0), 1);
      captureSfxRef.current = new Audio('/dame_capture_piece.mp3');
      captureSfxRef.current.volume = Math.min(Math.max(vol, 0), 1);
      loseHeartSfxRef.current = new Audio('/Lose_heart.mp3');
      loseHeartSfxRef.current.volume = Math.min(Math.max(vol, 0), 1);
      successSfxRef.current = new Audio('/success.mp3');
      successSfxRef.current.volume = Math.min(Math.max(vol, 0), 1);
      loseSfxRef.current = new Audio('/lose.mp3');
      loseSfxRef.current.volume = Math.min(Math.max(vol, 0), 1);
    } catch (_) {}
  }, []);

  // Animation de perte de cœur
  const playHeartLossAnimation = (player: 'player' | 'ai') => {
    setHeartAnimation(player);
    setCharacterAnimation(prev => ({
      ...prev,
      [player]: 'damage'
    }));
    
    setTimeout(() => {
      setHeartAnimation('');
      setCharacterAnimation(prev => ({
        ...prev,
        [player]: ''
      }));
    }, 1500);
  };

  // Animation de mort du personnage
  const playDeathAnimation = (player: 'player' | 'ai') => {
    setCharacterAnimation(prev => ({
      ...prev,
      [player]: 'death'
    }));
  };

  // Gérer la sélection d'une case (seulement pour l'humain)
  const handleSquareClick = (row: number, col: number) => {
    if (currentPlayer !== HUMAN_PLAYER || isThinking || gameStatus) return;

    if (!board[row]) return [];
    const piece = board[row]![col]!;

    if (isPlayerPiece(piece, HUMAN_PLAYER)) {
      setSelectedSquare({ row, col });
      const moves = getValidMoves(row, col, board, HUMAN_PLAYER);
      setValidMoves(moves.map(m => m.to));
    }
    else if (selectedSquare) {
      const possibleMoves = getValidMoves(selectedSquare.row, selectedSquare.col, board, HUMAN_PLAYER);
      const move = possibleMoves.find(m => m.to.row === row && m.to.col === col);
      if (move) {
        makeMove(move);
      }
      setSelectedSquare(null);
      setValidMoves([]);
    }
    else {
      setSelectedSquare(null);
      setValidMoves([]);
    }
  };

  // Effectuer un mouvement
  const makeMove = (move: Move) => {
    const newBoard = makeSimulatedMove(board, move);
    setBoard(newBoard);
    setCurrentPlayer(currentPlayer === HUMAN_PLAYER ? AI_PLAYER : HUMAN_PLAYER);
    checkGameEnd(newBoard);
    // Sounds: move/capture
    try {
      if (move.type === 'capture') {
        if (captureSfxRef.current) { captureSfxRef.current.currentTime = 0; captureSfxRef.current.play().catch(() => {}); }
      } else {
        if (moveSfxRef.current) { moveSfxRef.current.currentTime = 0; moveSfxRef.current.play().catch(() => {}); }
      }
    } catch (_) {}
  };

  // Vérifier la fin de manche
  const checkGameEnd = (board: Board) => {
    const whiteMoves = getAllValidMoves(board, HUMAN_PLAYER);
    const blackMoves = getAllValidMoves(board, AI_PLAYER);

    let whitePieces = 0;
    let blackPieces = 0;

    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (!board[row]) continue;
        const piece = board[row]![col]!;
        if (piece === WHITE_PIECE || piece === WHITE_KING) whitePieces++;
        else if (piece === BLACK_PIECE || piece === BLACK_KING) blackPieces++;
      }
    }

    if (whitePieces === 0 || whiteMoves.length === 0) {
      // IA gagne la manche
      setRoundWinner('IA');
      const newPlayerHearts = playerHearts - 1;
      setPlayerHearts(newPlayerHearts);
      playHeartLossAnimation('player');
      
      if (newPlayerHearts === 0) {
        setTimeout(() => {
          playDeathAnimation('player');
          setGameStatus('💀 TOTAL DEFEAT! AI dominates the battle! 💀');
          try { if (loseSfxRef.current) { loseSfxRef.current.currentTime = 0; loseSfxRef.current.play().catch(() => {}); } } catch (_) {}
          setTimeout(() => {
            setShowScoreScreen(true);
          }, 1500);
        }, 1500);
      } else {
        setTimeout(() => {
          setGameStatus(`🤖 AI wins this round! You have ${newPlayerHearts} heart(s) left`);
          try { if (loseHeartSfxRef.current) { loseHeartSfxRef.current.currentTime = 0; loseHeartSfxRef.current.play().catch(() => {}); } } catch (_) {}
          setTimeout(() => startNewRound(), 2000);
        }, 1500);
      }
    } else if (blackPieces === 0 || blackMoves.length === 0) {
      // Joueur gagne la manche
      setRoundWinner('Joueur');
      const newAiHearts = aiHearts - 1;
      setAiHearts(newAiHearts);
      playHeartLossAnimation('ai');
      
      if (newAiHearts === 0) {
        setTimeout(() => {
          playDeathAnimation('ai');
          setGameStatus('🎉 TOTAL VICTORY! You defeated the AI! 🎉\n✅ Next stage unlocked!');
          try { if (successSfxRef.current) { successSfxRef.current.currentTime = 0; successSfxRef.current.play().catch(() => {}); } } catch (_) {}
          // Upgrade player level if stage info available
          (async () => {
            try {
              if (stageData && typeof stageData.niveau === 'number') {
                await fetch('/api/player/update', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ etage_actuel: stageData.niveau + 1 })
                });
              }
            } catch (_) {}
          })();
          setTimeout(() => {
            setShowScoreScreen(true);
          }, 1500);
        }, 1500);
      } else {
        setTimeout(() => {
          setGameStatus(`🏆 You win this round! AI has ${newAiHearts} heart(s) left`);
          try { if (successSfxRef.current) { successSfxRef.current.currentTime = 0; successSfxRef.current.play().catch(() => {}); } } catch (_) {}
          setTimeout(() => startNewRound(), 2000);
        }, 1500);
      }
    }
  };

  // Commencer une nouvelle manche
  const startNewRound = () => {
    if (playerHearts > 0 && aiHearts > 0) {
      setBoard(initializeBoard());
      setCurrentPlayer(HUMAN_PLAYER);
      setSelectedSquare(null);
      setValidMoves([]);
      setGameStatus('');
      setRoundWinner('');
      setCharacterAnimation({ player: '', ai: '' });
    }
  };

  // IA joue automatiquement
  useEffect(() => {
    if (currentPlayer === AI_PLAYER && !gameStatus && playerHearts > 0 && aiHearts > 0) {
      setIsThinking(true);
      const timer = setTimeout(() => {
        const aiMove = getAIMove(board);
        if (aiMove) {
          makeMove(aiMove);
        }
        setIsThinking(false);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [currentPlayer, board, gameStatus, playerHearts, aiHearts]);

  // Commencer le jeu depuis le menu
  const startGame = () => {
    setBoard(initializeBoard());
    setCurrentPlayer(HUMAN_PLAYER);
    setSelectedSquare(null);
    setValidMoves([]);
    setPlayerHearts(3);
    setAiHearts(3);
    setGameStatus('');
    setIsThinking(false);
    setHeartAnimation('');
    setCharacterAnimation({ player: '', ai: '' });
    setRoundWinner('');
    setShowMenu(false);
    setShowScoreScreen(false);
  };
  
  // Nouvelle partie complète
  const newGame = () => {
    startGame();
  };
  
  // Retour au menu principal
  const goToMainMenu = () => {
    setShowMenu(true);
    setShowScoreScreen(false);
  };

  // Rendu d'une pièce
  const renderPiece = (piece: number) => {
    if (piece === EMPTY) return null;
    
    const isWhite = piece === WHITE_PIECE || piece === WHITE_KING;
    const isKingPiece = isKing(piece);
    
    return (
      <div className={`
        w-6 h-6 sm:w-7 sm:h-7 rounded-full border border-2 flex items-center justify-center font-bold text-sm
        ${isWhite 
          ? 'bg-gradient-to-br from-blue-200 to-blue-400 border-blue-500/50 text-blue-900 shadow-inner shadow-white/30' 
          : 'bg-gradient-to-br from-red-200 to-red-400 border-red-500/50 text-red-900 shadow-inner shadow-white/30'
        }
        transition-all duration-200 hover:scale-110 select-none
      `}
      style={{
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15), inset 0 1px 3px rgba(255, 255, 255, 0.3)'
      }}
      >
        {isKingPiece && <span style={{ textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)' }} className="text-xs sm:text-sm">♔</span>}
      </div>
    );
  };

  // Rendu des cœurs
  const renderHearts = (hearts: number, player: 'player' | 'ai') => {
    return (
      <div className={`flex gap-0.5 ${heartAnimation === player ? 'animate-pulse' : ''}`}>
        {[...Array(3)].map((_, i) => (
          <span 
            key={i} 
            className={`text-sm sm:text-base transition-all ${
              i < hearts 
                ? 'text-red-500' 
                : 'text-gray-300 opacity-50'
            } ${heartAnimation === player && i === hearts ? 'animate-bounce' : ''}`}
          >
            ❤️
          </span>
        ))}
      </div>
    );
  };

  // Rendu du personnage
  const renderCharacter = (player: 'player' | 'ai', position: string) => {
    const isPlayer = player === 'player';
    const animation = characterAnimation[player];
    
    return (
      <div className={`
        text-8xl transition-all duration-500 
        ${animation === 'damage' ? 'animate-bounce text-red-500 scale-110' : ''}
        ${animation === 'death' ? 'animate-spin opacity-20 grayscale' : ''}
        ${position}
      `}>
        {isPlayer ? '🛡️' : '🤖'}
      </div>
    );
  };

  // Écran de menu principal
  if (showMenu) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4 relative"
        style={{
          backgroundImage: 'url(/dame.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <button
          onClick={onBack}
          className="absolute top-4 left-4 bg-black/30 hover:bg-black/40 text-amber-100 px-4 py-2 rounded-lg transition-colors z-10 border border-amber-500/30"
        >
          ← Back to menu
        </button>
        
        <div className="absolute inset-0 bg-black/30"></div>
        
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-amber-200 rounded-full animate-pulse opacity-60"
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
          <h1 className="text-3xl font-bold text-amber-100 mb-6 drop-shadow-lg">⚔️ Checkers Battle</h1>
          
          <div className="bg-black/20 rounded-lg p-4 mb-6 border border-amber-700/20">
            <h2 className="text-lg font-semibold text-amber-200 mb-3">Game Rules:</h2>
            {loadingStage ? (
              <div className="text-amber-200 text-center">Loading game data...</div>
            ) : (
              <div className="text-amber-100/80 text-base leading-relaxed space-y-2">
                {stageData?.description && (
                  <div>
                    <h3 className="font-semibold text-amber-200">Description</h3>
                    <div className="whitespace-pre-wrap">{stageData.description}</div>
                  </div>
                )}
                {stageData?.regles ? (
                  <div>
                    <h3 className="font-semibold text-amber-200">Rules</h3>
                    <div className="text-amber-100/80" dangerouslySetInnerHTML={{ __html: stageData.regles.replace(/\n/g, '<br/>') }} />
                  </div>
                ) : (
                  <>
                    <p>• Move your pieces (blue) on dark squares</p>
                    <p>• Capture opponent pieces by jumping over them</p>
                    <p>• Win a round to remove one heart from your opponent</p>
                    <p>• Eliminate all opponent's hearts to win</p>
                  </>
                )}
              </div>
            )}
          </div>

          

          <button
            onClick={startGame}
            className="w-full bg-gradient-to-r from-amber-600/80 to-yellow-600/80 text-white py-3 px-6 rounded-lg 
                     font-semibold hover:from-amber-700/90 hover:to-yellow-700/90 transition-all duration-300 
                     transform hover:scale-105 shadow-lg border border-amber-500/30 relative z-20 cursor-pointer"
          >
            Start Battle
          </button>
        </div>
      </div>
    );
  }
  
  // Écran de résultats
  if (showScoreScreen) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4 relative"
        style={{
          backgroundImage: 'url(/dame.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <button
          onClick={onBack}
          className="absolute top-4 left-4 bg-black/30 hover:bg-black/40 text-amber-100 px-4 py-2 rounded-lg transition-colors z-10 border border-amber-500/30"
        >
          ← Back to menu
        </button>

        <div className="absolute inset-0 bg-black/40"></div>

        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(25)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-amber-200 rounded-full animate-pulse opacity-70"
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
            {playerHearts > 0 ? "Victory!" : "Defeat!"}
          </h1>
          
          <div className="mb-6 space-y-4">
            <div className="flex justify-center gap-8 items-center">
              <div className="text-center">
                <p className="text-lg text-amber-100">You</p>
                {renderHearts(playerHearts, 'player')}
              </div>
              
              <div className="text-5xl">⚔️</div>
              
              <div className="text-center">
                <p className="text-lg text-amber-100">AI</p>
                {renderHearts(aiHearts, 'ai')}
              </div>
            </div>
            
            <div className="mt-4">
              <p className="text-xl text-amber-100">Battle Result:</p>
              <p className={`text-2xl font-bold ${playerHearts > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {playerHearts > 0 
                  ? '🎉 Victory! You defeated the AI!' 
                  : '💀 Defeat! The AI dominated the battle!'}
              </p>
            </div>
            
            
          </div>

          <div className="space-y-3">
            <button
              onClick={newGame}
              className="w-full bg-gradient-to-r from-amber-600/80 to-yellow-600/80 text-white py-3 px-6 rounded-lg 
                      font-semibold hover:from-amber-700/90 hover:to-yellow-700/90 transition-all duration-300 
                      transform hover:scale-105 shadow-lg border border-amber-500/30 cursor-pointer z-20 pointer-events-auto"
            >
              Play Again
            </button>
            
            <button
              onClick={goToMainMenu}
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

  // Écran de jeu principal
  return (
    <div 
      className="min-h-screen p-1 flex items-center justify-center overflow-hidden"
      style={{
        backgroundImage: 'url(/Faleter2.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="absolute inset-0 bg-black/40"></div>
      
      {/* Étoiles/particules d'arrière-plan */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-amber-200 rounded-full animate-pulse opacity-50"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 2}s`
            }}
          />
        ))}
      </div>
      
      <div className="bg-black/80 backdrop-blur-sm rounded-lg shadow-lg w-[95vw] max-w-lg sm:max-w-md md:max-w-lg mx-auto border border-amber-500/30 relative z-10 flex flex-col p-2">
        {/* En-tête ultra compact */}
        <div className="mb-1">
          <div className="flex justify-between items-center mb-1">
            <button
              onClick={onBack}
              className="px-2 py-0.5 bg-black/30 text-amber-100 rounded text-sm"
            >
              ← Back
            </button>
            <h1 className="text-lg sm:text-xl font-bold text-amber-100 drop-shadow-lg">⚔️ Checkers Battle ⚔️</h1>
            <button 
              onClick={goToMainMenu}
              className="px-2 py-0.5 bg-black/30 text-amber-100 rounded text-sm"
            >
              Menu
            </button>
          </div>
          
          <div className="flex justify-between items-center text-sm px-1">
            <span className={`font-bold ${currentPlayer === HUMAN_PLAYER ? 'text-blue-400' : 'text-red-400'}`}>
              Turn: {currentPlayer === HUMAN_PLAYER ? 'You' : 'AI'}
            </span>
            
           
       
          </div>
          
          {gameStatus && (
            <div className={`text-lg sm:text-xl font-bold py-1 sm:py-2 px-3 sm:px-4 rounded-lg mb-2 ${
              gameStatus.includes('VICTOIRE') 
                ? 'text-green-400 bg-green-900/50 border border-green-600/30' 
                : gameStatus.includes('DÉFAITE')
                ? 'text-red-400 bg-red-900/50 border border-red-600/30'
                : 'text-yellow-400 bg-yellow-900/50 border border-yellow-600/30'
            }`}>
              {gameStatus}
            </div>
          )}
        </div>

        {/* Player information area */}
        <div className="flex justify-between items-center mb-1 mx-1 text-center">
          {/* Player Zone */}
          <div className="flex flex-col items-center">
            <div className="flex items-center">
              <span className="text-blue-400 mr-1">🛡️</span>
              <span className="text-blue-300 text-sm">YOU</span>
            </div>
            <div className="flex">{renderHearts(playerHearts, 'player')}</div>
          </div>

          {/* Game status message */}
          {gameStatus && (
            <div className={`text-sm font-bold px-1 py-0.5 rounded-sm mx-auto ${
              gameStatus.includes('VICTOIRE') || gameStatus.includes('Victory') 
                ? 'text-green-400 bg-green-900/50' 
                : gameStatus.includes('DÉFAITE') || gameStatus.includes('Defeat')
                ? 'text-red-400 bg-red-900/50'
                : 'text-yellow-400 bg-yellow-900/50'
            }`}>
              {gameStatus.replace(/(.*!)\s.*/, '$1')}
            </div>
          )}

          {/* AI Zone */}
          <div className="flex flex-col items-center">
            <div className="flex items-center">
              <span className="text-red-300 text-sm">AI</span>
              <span className="text-red-400 ml-1">🤖</span>
            </div>
            <div className="flex">{renderHearts(aiHearts, 'ai')}</div>
          </div>
        </div>

        {/* Plateau de jeu */}
        <div className="border-2 border-amber-600/50 rounded shadow bg-black/70 p-1 mx-auto aspect-square">
          <div className="grid grid-cols-8 gap-0 w-full h-full border border-amber-600/30 rounded overflow-hidden">
            {board.map((row, rowIndex) =>
              row.map((piece, colIndex) => {
                const isSelected = selectedSquare?.row === rowIndex && selectedSquare?.col === colIndex;
                const isValidMove = validMoves.some(move => move.row === rowIndex && move.col === colIndex);
                const isDarkSquare = (rowIndex + colIndex) % 2 === 1;
                
                return (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    className={`
                      aspect-square flex items-center justify-center cursor-pointer relative
                      ${isDarkSquare 
                        ? isSelected 
                          ? 'bg-yellow-600/80' 
                          : 'bg-amber-800/80' 
                        : 'bg-amber-200/80'
                      }
                      ${isValidMove ? 'ring-1 ring-green-400/70 ring-inset animate-pulse' : ''}
                      ${currentPlayer !== HUMAN_PLAYER || isThinking ? 'cursor-not-allowed opacity-75' : ''}
                    `}
                    onClick={() => handleSquareClick(rowIndex, colIndex)}
                  >
                    {renderPiece(piece)}
                    {isValidMove && (
                      <div className="absolute inset-0 bg-green-400/40 opacity-40 rounded-full m-2 animate-ping"></div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Pieces legend */}
        <div className="flex justify-between items-center mx-1 mt-1 text-sm">
          <span className="text-blue-300">Blue Pieces</span>
          <span className="text-red-300">Red Pieces</span>
        </div>

        {/* Minimalist instructions */}
        <div className="mt-1 text-center text-amber-100/70 bg-black/20 backdrop-blur-sm rounded p-0.5 border border-amber-500/20 text-xs">
          ⚔️ Win = -1❤️ opponent | 0❤️ = defeat 💀
        </div>
      </div>
    </div>
  );
};

export default CheckersGame;