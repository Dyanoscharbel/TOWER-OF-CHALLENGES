import React, { useState, useEffect, useCallback, useRef } from 'react';

interface Game2048Props {
  onBack: () => void;
}

interface Stage {
  id: number;
  nom: string;
  description: string;
  regles: string;
  niveau: number;
  target_score: number;
}

const Game2048 = ({ onBack }: Game2048Props) => {
  const WIN_TILE = 2048;
  const [grid, setGrid] = useState(() => initializeGrid());
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [hasWon, setHasWon] = useState(false);
  const [showMenu, setShowMenu] = useState(true);
  const [showScoreScreen, setShowScoreScreen] = useState(false);
  const [bestScore, setBestScore] = useState(0);
  
  // États pour les animations
  const [mergedTiles, setMergedTiles] = useState<number[][]>([]);
  const [movedTiles, setMovedTiles] = useState<number[][]>([]);
  const [newTile, setNewTile] = useState<number[] | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentDirection, setCurrentDirection] = useState<'left' | 'right' | 'up' | 'down'>('left');
  
  // États pour la gestion des interactions tactiles
  const [touchStart, setTouchStart] = useState<{x: number, y: number} | null>(null);
  const [touchEnd, setTouchEnd] = useState<{x: number, y: number} | null>(null);
  
  // États pour les données de la base de données
  const [stageData, setStageData] = useState<Stage | null>(null);
  const [loadingStage, setLoadingStage] = useState(true);

  // Sons
  const clickSfxRef = useRef<HTMLAudioElement | null>(null);
  const successSfxRef = useRef<HTMLAudioElement | null>(null);

  // Données joueur et progression
  const [playerData, setPlayerData] = useState<{ reddit_id: string } | null>(null);
  const [progressionSaved, setProgressionSaved] = useState(false);

  // Charger les données de la base de données
  const loadStageData = useCallback(async () => {
    try {
      setLoadingStage(true);
      console.log('Loading stage data for 2048 Challenge...');
      
      // Charger toutes les étapes depuis l'API
      const response = await fetch('/api/stages');
      if (response.ok) {
        const result = await response.json();
        console.log('All stages loaded:', result);
        
        if (result.status === 'success' && result.data) {
          // Chercher l'étape "2048 Challenge" exactement
          let stageFound = result.data.find((stage: Stage) => 
            stage.nom === '2048 Challenge'
          );
          
          // Si pas trouvé, chercher des variantes
          if (!stageFound) {
            const possibleNames = ['2048', 'Game 2048', '2048 Game'];
            stageFound = result.data.find((stage: Stage) => 
              stage.nom && possibleNames.some(name => 
                stage.nom!.toLowerCase().includes(name.toLowerCase())
              )
            );
          }
          
          // Si toujours pas trouvé, chercher toute étape contenant "2048"
          if (!stageFound) {
            stageFound = result.data.find((stage: Stage) => 
              stage.nom && stage.nom.toLowerCase().includes('2048')
            );
          }
          
          if (stageFound) {
            console.log('Stage data found for 2048:', stageFound);
            setStageData(stageFound);
          } else {
            console.warn('No stage data found for 2048 Challenge. Available stages:', 
              result.data.map((s: Stage) => s.nom));
          }
        } else {
          console.error('Failed to load stages:', result);
        }
      } else {
        console.error('Failed to fetch stages:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error loading stage data:', error);
    } finally {
      setLoadingStage(false);
    }
  }, []);

  useEffect(() => {
    loadStageData();
  }, [loadStageData]);

  // Charger le joueur courant
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
      } catch (e) {
        console.error('Error loading current player:', e);
      }
    };
    loadPlayer();
  }, []);

  // Initialiser les sons
  useEffect(() => {
    try {
      const sfxVolume = parseFloat(localStorage.getItem('sfxVolume') || '0.8');
      clickSfxRef.current = new Audio('/click_reaction_dash.mp3');
      clickSfxRef.current.volume = Math.min(Math.max(sfxVolume * 0.6, 0), 1);
      successSfxRef.current = new Audio('/success.mp3');
      successSfxRef.current.volume = Math.min(Math.max(sfxVolume, 0), 1);
    } catch (e) {
      // ignorer
    }
  }, []);

  // Sauvegarde progression et upgrade niveau
  const submitProgression = useCallback(async (finalScore: number, completed: boolean) => {
    if (!playerData || !stageData || progressionSaved) return;

    let saved = false;
    try {
      // Vérifier progression existante
      const getRes = await fetch(`/api/progression?joueur_id=${encodeURIComponent(playerData.reddit_id)}&etage_id=${encodeURIComponent(String(stageData.id))}`);
      if (getRes.ok) {
        const getJson = await getRes.json();
        if (getJson.status === 'success' && getJson.data) {
          const existing = getJson.data as { score: number };
          if (finalScore > existing.score) {
            const upd = await fetch('/api/progression/update', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                joueur_id: playerData.reddit_id,
                etage_id: stageData.id,
                score: finalScore,
                completed
              })
            });
            if (upd.ok) {
              const updJson = await upd.json().catch(() => null);
              saved = updJson?.status === 'success' || upd.status === 200;
            }
          } else {
            // score not better: consider as no-op but not error
            saved = true;
          }
        } else {
          // Créer si non trouvée (cas status error mais 200)
          const crt = await fetch('/api/progression/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              joueur_id: playerData.reddit_id,
              etage_id: stageData.id,
              score: finalScore,
              completed
            })
          });
          if (crt.ok) {
            const crtJson = await crt.json().catch(() => null);
            saved = crtJson?.status === 'success';
          }
        }
      } else if (getRes.status === 404) {
        const crt = await fetch('/api/progression/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            joueur_id: playerData.reddit_id,
            etage_id: stageData.id,
            score: finalScore,
            completed
          })
        });
        if (crt.ok) {
          const crtJson = await crt.json().catch(() => null);
          saved = crtJson?.status === 'success';
        }
      }

      // Upgrade du niveau si gagné (WIN_TILE atteint)
      if (completed && stageData?.niveau !== undefined) {
        try {
          const up = await fetch(`/api/player/${encodeURIComponent(playerData.reddit_id)}/update-stage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stage: (stageData.niveau + 1) })
          });
          // Optionally ensure it's ok; we don't block saving on this
          if (!up.ok) {
            console.warn('Failed to update player stage:', up.status, up.statusText);
          }
        } catch (_) {}
      }

      if (saved) setProgressionSaved(true);
    } catch (e) {
      console.error('Error submitting progression:', e);
    }
  }, [playerData, stageData, progressionSaved]);

  function initializeGrid() {
    const newGrid = Array(4).fill(null).map(() => Array(4).fill(0));
    addRandomTile(newGrid);
    addRandomTile(newGrid);
    return newGrid;
  }

  function addRandomTile(grid: number[][]) {
    const emptyCells = [];
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        if (grid[i]![j]! === 0) {
          emptyCells.push([i, j]);
        }
      }
    }
    if (emptyCells.length > 0) {
      const randomIndex = Math.floor(Math.random() * emptyCells.length);
      const cell = emptyCells[randomIndex];
      if (cell) {
        const [row, col] = cell;
        if (row !== undefined && col !== undefined) {
          grid[row]![col]! = Math.random() < 0.9 ? 2 : 4;
          return [row, col] as [number, number]; // Retourner la position de la nouvelle tuile pour l'animation
        }
      }
    }
    return null;
  }

  function moveLeft(grid: number[][]) {
    let moved = false;
    let newScore = 0;
    const newMergedTiles: number[][] = []; // Pour suivre les tuiles fusionnées
    const newMovedTiles: number[][] = []; // Pour suivre les tuiles déplacées
    
    const newGrid = grid.map((row: number[], rowIndex: number) => {
      const originalRow = [...row];
      const filtered = row.filter((cell: number) => cell !== 0);
      const merged = [];
      let i = 0;
      while (i < filtered.length) {
        if (i < filtered.length - 1 && filtered[i] === filtered[i + 1]) {
          // Fusion
          const mergedValue = filtered[i]! * 2;
          merged.push(mergedValue);
          newScore += mergedValue;
          
          // Enregistrer cette fusion
          newMergedTiles.push([rowIndex, merged.length - 1]);
          
          if (mergedValue === WIN_TILE && !hasWon) {
            setHasWon(true);
            // Son de succès quand 2048 atteint
            try {
              if (successSfxRef.current) {
                successSfxRef.current.currentTime = 0;
                successSfxRef.current.play().catch(() => {});
              }
            } catch (_) {}
          }
          i += 2;
        } else {
          merged.push(filtered[i]!);
          i += 1;
        }
      }
      while (merged.length < 4) {
        merged.push(0);
      }
      
      // Vérifier les mouvements dans cette rangée - uniquement pour les tuiles avec des nombres
      for (let j = 0; j < 4; j++) {
        if (merged[j]! > 0) {
          // Trouver toutes les positions possibles d'origine pour cette valeur
          const possibleOrigPositions = [];
          for (let k = 0; k < originalRow.length; k++) {
            if (originalRow[k]! === merged[j]!) {
              possibleOrigPositions.push(k);
            }
          }
          
          // Filtrer les positions déjà utilisées
          const availablePositions = possibleOrigPositions.filter(pos => 
            !newMovedTiles.some(([r, orig]) => r === rowIndex && orig === pos)
          );
          
          // Si on a des positions disponibles et qu'elles sont différentes de la position actuelle
          if (availablePositions.length > 0 && availablePositions[0] !== j) {
            newMovedTiles.push([rowIndex, availablePositions[0]!, j]);
          }
        }
      }
      
      if (JSON.stringify(merged) !== JSON.stringify(row)) {
        moved = true;
      }
      return merged;
    });
    
    return { 
      grid: newGrid, 
      moved, 
      score: newScore,
      mergedTiles: newMergedTiles,
      movedTiles: newMovedTiles
    };
  }

  function rotateGrid(grid: number[][]) {
    return grid[0]!.map((_, i) => grid.map(row => row[i]!).reverse());
  }

  function move(direction: 'left' | 'right' | 'up' | 'down', currentGrid: number[][]) {
    let result;
    let workingGrid = [...currentGrid.map((row: number[]) => [...row])];
    let mergedTiles: number[][] = [];
    let movedTiles: number[][] = [];

    switch (direction) {
      case 'left':
        result = moveLeft(workingGrid);
        mergedTiles = result.mergedTiles || [];
        movedTiles = result.movedTiles || [];
        break;
      case 'right':
        workingGrid = rotateGrid(rotateGrid(workingGrid));
        result = moveLeft(workingGrid);
        result.grid = rotateGrid(rotateGrid(result.grid));
        
        // Ajuster les coordonnées pour la rotation
        mergedTiles = (result.mergedTiles || []).map(([row, col]) => [row!, 3 - col!]);
        movedTiles = (result.movedTiles || []).map(([row, from, to]) => [row!, 3 - from!, 3 - to!]);
        break;
      case 'up':
        workingGrid = rotateGrid(rotateGrid(rotateGrid(workingGrid)));
        result = moveLeft(workingGrid);
        result.grid = rotateGrid(result.grid);
        
        // Ajuster les coordonnées pour la rotation
        mergedTiles = (result.mergedTiles || []).map(([row, col]) => [col!, 3 - row!]);
        movedTiles = (result.movedTiles || []).map(([row, from, to]) => [from!, 3 - row!, 3 - to!]);
        break;
      case 'down':
        workingGrid = rotateGrid(workingGrid);
        result = moveLeft(workingGrid);
        result.grid = rotateGrid(rotateGrid(rotateGrid(result.grid)));
        
        // Ajuster les coordonnées pour la rotation
        mergedTiles = (result.mergedTiles || []).map(([row, col]) => [3 - col!, row!]);
        movedTiles = (result.movedTiles || []).map(([row, from, to]) => [3 - from!, row!, 3 - to!]);
        break;
      default:
        return { grid: workingGrid, moved: false, score: 0, mergedTiles: [], movedTiles: [] };
    }

    return { 
      ...result, 
      mergedTiles, 
      movedTiles
    };
  }

  function canMove(grid: number[][]) {
    // Check for empty cells
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        if (grid[i]![j]! === 0) return true;
      }
    }
    
    // Check for possible merges
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const current = grid[i]![j]!;
        if ((j < 3 && current === grid[i]![j + 1]!) ||
            (i < 3 && current === grid[i + 1]![j]!)) {
          return true;
        }
      }
    }
    return false;
  }

  // Gestionnaire pour les événements tactiles
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (gameOver || isAnimating || !e.touches[0]) return;
    
    // Enregistrer le point de départ du toucher
    setTouchStart({
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    });
    setTouchEnd(null);
  }, [gameOver, isAnimating]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStart || gameOver || isAnimating || !e.touches[0]) return;
    
    // Mettre à jour le point final du toucher pendant le mouvement
    setTouchEnd({
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    });
  }, [touchStart, gameOver, isAnimating]);

  // Nous utiliserons cette fonction dans handleTouchEnd et handleKeyPress
  const processMove = useCallback((direction: 'left' | 'right' | 'up' | 'down') => {
    const result = move(direction, grid);
    
    if (result.moved) {
      // Son de clic à chaque déplacement
      try {
        if (clickSfxRef.current) {
          clickSfxRef.current.currentTime = 0;
          clickSfxRef.current.play().catch(() => {});
        }
      } catch (_) {}
      // Enregistrer la direction actuelle
      setCurrentDirection(direction);
      
      // Activer l'animation
      setIsAnimating(true);
      setMergedTiles(result.mergedTiles || []);
      setMovedTiles(result.movedTiles || []);
      
      // Planifier la mise à jour de la grille après l'animation
      setTimeout(() => {
        const newGrid = [...result.grid.map((row: number[]) => [...row])];
        const newTilePosition = addRandomTile(newGrid);
        setGrid(newGrid);
        setNewTile(newTilePosition ? [newTilePosition[0]!, newTilePosition[1]!] : null);
        setScore(prev => prev + result.score);
        
        // Réinitialiser les animations
        setTimeout(() => {
          setIsAnimating(false);
          setMergedTiles([]);
          setMovedTiles([]);
          setNewTile(null);
          
          // Vérifier si le jeu est terminé
          if (!canMove(newGrid)) {
            const finalScore = score + result.score;
            setGameOver(true);
            // Son de fin (demande: jouer success.mp3 même si perdu)
            try {
              if (successSfxRef.current) {
                successSfxRef.current.currentTime = 0;
                successSfxRef.current.play().catch(() => {});
              }
            } catch (_) {}
            // Mettre à jour le meilleur score et afficher l'écran de score
            if (finalScore > bestScore) {
              setBestScore(finalScore);
            }
            setShowScoreScreen(true);
            // Sauvegarder la progression (completed selon 2048 atteint)
            submitProgression(finalScore, hasWon);
          }
        }, 150);
      }, 200);
    }
  }, [grid, move, setCurrentDirection, setMergedTiles, setMovedTiles, setGrid, setNewTile, setScore, canMove, setGameOver, bestScore, score, submitProgression, hasWon]);

  const handleTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd || gameOver || isAnimating) return;
    
    // Calculer la distance du swipe
    const xDistance = touchEnd.x - touchStart.x;
    const yDistance = touchEnd.y - touchStart.y;
    
    // Déterminer la direction du swipe si la distance est suffisante
    // (seuil minimum pour éviter les petits mouvements accidentels)
    const minSwipeDistance = 30;
    
    if (Math.abs(xDistance) > Math.abs(yDistance) && Math.abs(xDistance) > minSwipeDistance) {
      // Swipe horizontal
      const direction = xDistance > 0 ? 'right' : 'left';
      processMove(direction);
    } else if (Math.abs(yDistance) > Math.abs(xDistance) && Math.abs(yDistance) > minSwipeDistance) {
      // Swipe vertical
      const direction = yDistance > 0 ? 'down' : 'up';
      processMove(direction);
    }
    
    // Réinitialiser les points de toucher
    setTouchStart(null);
    setTouchEnd(null);
  }, [touchStart, touchEnd, gameOver, isAnimating, processMove]);

  // Gestion des touches du clavier
  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    // Ignorer les touches si le jeu est terminé ou en cours d'animation
    if (gameOver || isAnimating) return;

    let direction;
    switch (e.key) {
      case 'ArrowLeft':
        direction = 'left' as const;
        break;
      case 'ArrowRight':
        direction = 'right' as const;
        break;
      case 'ArrowUp':
        direction = 'up' as const;
        break;
      case 'ArrowDown':
        direction = 'down' as const;
        break;
      default:
        return;
    }

    e.preventDefault();
    processMove(direction);
  }, [gameOver, isAnimating, processMove]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);
  
  // Effet pour mettre à jour le meilleur score lorsque le score actuel le dépasse
  useEffect(() => {
    if (score > bestScore) {
      setBestScore(score);
    }
  }, [score, bestScore]);

  const startGame = () => {
    setGrid(initializeGrid());
    setScore(0);
    setGameOver(false);
    setHasWon(false);
    setShowMenu(false);
    setShowScoreScreen(false);
    
    // Réinitialiser les animations et états
    setIsAnimating(false);
    setMergedTiles([]);
    setMovedTiles([]);
    setNewTile(null);
    setTouchStart(null);
    setTouchEnd(null);
  };
  
  const resetGame = () => {
    // Sauvegarder le meilleur score
    if (score > bestScore) {
      setBestScore(score);
    }
    setShowMenu(true);
    setShowScoreScreen(false);
  };

  const getTileColor = (value: number) => {
    const colors = {
      0: 'bg-gray-200/20 border border-gray-400/10',
      2: 'bg-gradient-to-br from-amber-50 to-amber-100 text-amber-900 border border-amber-200/50 shadow-inner shadow-white/20',
      4: 'bg-gradient-to-br from-amber-200 to-amber-300 text-amber-900 border border-amber-400/50 shadow-inner shadow-white/20',
      8: 'bg-gradient-to-br from-orange-300 to-orange-400 text-white border border-orange-500/50 shadow-inner shadow-white/20',
      16: 'bg-gradient-to-br from-orange-400 to-orange-500 text-white border border-orange-600/50 shadow-inner shadow-white/20',
      32: 'bg-gradient-to-br from-orange-500 to-orange-600 text-white border border-orange-700/50 shadow-inner shadow-white/20',
      64: 'bg-gradient-to-br from-red-400 to-red-500 text-white border border-red-600/50 shadow-inner shadow-white/20',
      128: 'bg-gradient-to-br from-yellow-400 to-yellow-500 text-white font-bold border border-yellow-600/50 shadow-inner shadow-white/30',
      256: 'bg-gradient-to-br from-yellow-500 to-yellow-600 text-white font-bold border border-yellow-700/50 shadow-inner shadow-white/30',
      512: 'bg-gradient-to-br from-yellow-600 to-amber-700 text-white font-bold border border-yellow-800/50 shadow-inner shadow-white/30',
      1024: 'bg-gradient-to-br from-yellow-700 to-amber-800 text-white font-bold text-sm border border-yellow-900/50 shadow-inner shadow-white/30',
      2048: 'bg-gradient-to-br from-yellow-800 to-amber-900 text-white font-bold text-sm border border-yellow-950/50 shadow-inner shadow-white/30 animate-pulse'
    };
    return colors[value as keyof typeof colors] || 'bg-gradient-to-br from-purple-500 to-purple-600 text-white font-bold text-xs border border-purple-700/50 shadow-inner shadow-white/30';
  };

  // Écran de menu principal
  if (showMenu) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4 relative"
        style={{
          backgroundImage: 'url(/Faleter2.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <button
          onClick={onBack}
          className="absolute top-4 left-4 bg-black/30 hover:bg-black/40 text-amber-100 px-4 py-2 rounded-lg transition-colors z-10 border border-amber-500/30"
        >
          ← Retour au menu
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
          <h1 className="text-3xl font-bold text-amber-100 mb-6 drop-shadow-lg">
            {stageData?.nom || "🧩 2048 Challenge"}
          </h1>
          
          {loadingStage ? (
            <div className="bg-black/20 rounded-lg p-4 mb-6 border border-amber-700/20">
              <div className="text-amber-200 text-center">Loading game data...</div>
            </div>
          ) : (
            <div className="bg-black/20 rounded-lg p-4 mb-6 border border-amber-700/20">
              <h2 className="text-lg font-semibold text-amber-200 mb-3">Game Rules:</h2>
              <div className="text-amber-100/80 text-sm leading-relaxed space-y-2">
                {stageData?.regles ? (
                  <div dangerouslySetInnerHTML={{ __html: stageData.regles.replace(/\n/g, '<br/>') }} />
                ) : (
                  <>
                    <p>• Use <span className="text-yellow-300">arrow keys</span> or <span className="text-yellow-300">swipe</span> on touch screen</p>
                    <p>• Combine tiles of the same value to merge them</p>
                    <p>• Reach the <span className="text-yellow-300">2048</span> tile to win!</p>
                    <p>• Game ends when no moves are possible</p>
                    <p>• Each move adds a new tile (2 or 4) to the board</p>
                    <p>• Plan your moves carefully to avoid filling the board!</p>
                  </>
                )}
              </div>
            </div>
          )}

          <button
            onClick={startGame}
            disabled={loadingStage}
            className="w-full bg-gradient-to-r from-amber-600/80 to-yellow-600/80 text-white py-3 px-6 rounded-lg 
                     font-semibold hover:from-amber-700/90 hover:to-yellow-700/90 transition-all duration-300 
                     transform hover:scale-105 shadow-lg border border-amber-500/30 relative z-20 cursor-pointer
                     disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {loadingStage ? "Loading..." : "Start Playing"}
          </button>
        </div>
      </div>
    );
  }
  
  // Écran de résultats
  if (showScoreScreen && gameOver) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4 relative"
        style={{
          backgroundImage: 'url(/Faleter2.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <button
          onClick={onBack}
          className="absolute top-4 left-4 bg-black/30 hover:bg-black/40 text-amber-100 px-4 py-2 rounded-lg transition-colors z-10 border border-amber-500/30"
        >
          ← Retour au menu
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
            {hasWon ? "Victory!" : "Game Over!"}
          </h1>
          
          <div className="mb-6 space-y-4">
            <div className="text-amber-100">
              <p className="text-xl">Final Score:</p>
              <p className="text-4xl font-bold text-yellow-300">{score}</p>
            </div>
            
            <div className="text-amber-100">
              <p className="text-lg">Best Score: <span className="font-bold text-green-300">{Math.max(bestScore, score)}</span></p>
            </div>
            
            {hasWon && (
              <div className="bg-yellow-600/40 rounded-lg p-3 border border-yellow-500/30">
                <p className="text-yellow-200 font-bold">🎉 Congratulations! You reached {WIN_TILE}!</p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <button
              onClick={startGame}
              className="w-full bg-gradient-to-r from-amber-600/80 to-yellow-600/80 text-white py-3 px-6 rounded-lg 
                      font-semibold hover:from-amber-700/90 hover:to-yellow-700/90 transition-all duration-300 
                      transform hover:scale-105 shadow-lg border border-amber-500/30 cursor-pointer z-20 pointer-events-auto"
            >
              Play Again
            </button>
            
            <button
              onClick={resetGame}
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
      className="flex flex-col items-center justify-center min-h-screen p-2 sm:p-4 overflow-hidden relative"
      style={{
        backgroundImage: 'url(/Faleter2.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Overlay de fond sombre */}
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
      
      {/* Animations CSS */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes tileAppear {
          0% { 
            opacity: 0.4; 
            transform: scale(0.8); 
          }
          100% { 
            opacity: 1; 
            transform: scale(1); 
          }
        }
        
        @keyframes tilePulse {
          0% { 
            transform: scale(1); 
          }
          50% { 
            transform: scale(1.1); 
          }
          100% { 
            transform: scale(1); 
          }
        }
        
        @keyframes tileSlideLeft {
          0% { 
            transform: translateX(-15px); 
            opacity: 0.8;
          }
          100% { 
            transform: translateX(0); 
            opacity: 1;
          }
        }
        
        @keyframes tileSlideRight {
          0% { 
            transform: translateX(15px); 
            opacity: 0.8;
          }
          100% { 
            transform: translateX(0); 
            opacity: 1;
          }
        }
        
        @keyframes tileSlideUp {
          0% { 
            transform: translateY(-15px); 
            opacity: 0.8;
          }
          100% { 
            transform: translateY(0); 
            opacity: 1;
          }
        }
        
        @keyframes tileSlideDown {
          0% { 
            transform: translateY(15px); 
            opacity: 0.8;
          }
          100% { 
            transform: translateY(0); 
            opacity: 1;
          }
        }
        
        @keyframes tileNew {
          0% { 
            transform: scale(0.2); 
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
            opacity: 1;
          }
          100% { 
            transform: scale(1); 
            opacity: 1;
          }
        }
      `}} />
      
      {/* Header */}
      <div className="mb-2 sm:mb-6 text-center relative z-10 w-full max-w-md">
        <button
          onClick={onBack}
          className="mb-2 sm:mb-4 px-3 py-1 sm:px-4 sm:py-2 bg-black/30 hover:bg-black/40 text-amber-100 rounded-lg transition-colors border border-amber-500/30 text-sm sm:text-base"
        >
          ← Back to menu
        </button>
        <h1 className="text-2xl sm:text-4xl font-bold text-amber-100 mb-1 sm:mb-2 drop-shadow-lg">🧩 2048</h1>
        <div className="flex gap-2 sm:gap-4 justify-center items-center text-amber-100 bg-black/30 backdrop-blur-sm rounded-lg p-2 sm:p-3 border border-amber-500/20 text-sm sm:text-base">
          <div className="font-semibold">Score: <span className="font-bold text-yellow-300">{score}</span></div>
          <div className="font-semibold">Best: <span className="font-bold text-green-300">{Math.max(bestScore, score)}</span></div>
          <button 
            onClick={resetGame}
            className="ml-2 px-3 py-1 bg-amber-600/60 hover:bg-amber-700/70 text-white rounded text-sm font-semibold transition-colors"
          >
            New Game
          </button>
        </div>
        
        {hasWon && !gameOver && (
          <div className="mt-2 bg-yellow-600/40 text-yellow-200 px-4 py-2 rounded-lg mb-2 font-bold border border-yellow-500/30 animate-pulse">
            🎉 Congratulations! You reached {WIN_TILE}!
          </div>
        )}
      </div>

      {/* Game Area */}
      <div 
        className="relative bg-black/40 backdrop-blur-lg p-4 rounded-xl overflow-hidden shadow-lg shadow-amber-500/30 border-2 border-amber-500/30 z-10"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {grid.map((row, i) =>
            row.map((cell, j) => (
              <div
                key={`${i}-${j}`}
                className={`w-16 h-16 sm:w-20 sm:h-20 rounded-lg flex items-center justify-center font-bold text-lg sm:text-xl transition-all duration-200 transform ${getTileColor(cell)}`}
                style={{
                  boxShadow: cell > 0 ? '0 4px 12px rgba(0, 0, 0, 0.15), inset 0 1px 3px rgba(255, 255, 255, 0.3)' : 'inset 0 1px 3px rgba(255, 255, 255, 0.1)',
                  // Animations uniquement pour les tuiles avec des nombres (cell > 0)
                  animation: cell > 0 && mergedTiles.some(([row, col]) => row === i && col === j) 
                    ? 'tileAppear 0.2s ease, tilePulse 0.3s ease 0.1s' 
                    : cell > 0 && movedTiles.some(([row, , to]) => row === i && to === j)
                    ? `tileSlide${currentDirection.charAt(0).toUpperCase() + currentDirection.slice(1)} 0.2s ease`
                    : cell > 0 && newTile && newTile[0] === i && newTile[1] === j
                    ? 'tileNew 0.3s ease'
                    : '',
                  zIndex: (cell > 0 && mergedTiles.some(([row, col]) => row === i && col === j)) || 
                          (cell > 0 && newTile && newTile[0] === i && newTile[1] === j) 
                          ? 10 : 'auto',
                }}
              >
                {cell !== 0 && (
                  <span 
                    className={`transform transition-all duration-100 select-none ${
                      mergedTiles.some(([row, col]) => row === i && col === j) ? 'scale-110' : ''
                    }`} 
                    style={{ 
                      textShadow: cell >= 128 ? '0 1px 2px rgba(0, 0, 0, 0.2)' : 'none'
                    }}
                  >
                    {cell}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-4 text-center text-amber-100/70 bg-black/20 backdrop-blur-sm rounded-lg p-2 border border-amber-500/20 relative z-10 max-w-md">
        <p>Use <span className="text-yellow-300 font-bold">arrow keys</span> or <span className="text-yellow-300 font-bold">swipe</span> on screen to move tiles and merge them!</p>
      </div>
    </div>
  );
};

export default Game2048;