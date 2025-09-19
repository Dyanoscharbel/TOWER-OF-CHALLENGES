import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Star, Heart, Gem, Zap, Trophy, Bomb } from 'lucide-react';
import { Stage } from '../../../shared/types/stage';
import { Player } from '../../../shared/types/player';
import { Progression } from '../../../shared/types/progression';

// Types et interfaces
interface IconType {
  component: typeof Star;
  points: number;
  color: string;
  name: string;
  glowColor: string;
  weight: number;
}

interface GameIcon {
  id: number;
  type: IconType;
  x: number;
  y: number;
  speed: number;
  rotation: number;
  rotationSpeed: number;
  createdAt: number;
}

interface GameDimensions {
  width: number;
  height: number;
  iconSize: number;
}

interface ReactionDashProps {
  onBack?: () => void;
}

const WordExpress = ({ onBack }: ReactionDashProps) => {
  const [score, setScore] = useState<number>(0);
  const [gameActive, setGameActive] = useState<boolean>(false);
  const [hearts, setHearts] = useState<number>(10);
  const [icons, setIcons] = useState<GameIcon[]>([]);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [bestScore, setBestScore] = useState<number>(0);
  const [combo, setCombo] = useState<number>(0);
  const [maxCombo, setMaxCombo] = useState<number>(0);
  const [level, setLevel] = useState<number>(1);
  const [stageData, setStageData] = useState<Stage | null>(null);
  const [loadingStage, setLoadingStage] = useState<boolean>(true);
  const [clickedIcons, setClickedIcons] = useState<Set<number>>(new Set());
  const [playerData, setPlayerData] = useState<Player | null>(null);
  const [showLevelUp, setShowLevelUp] = useState<boolean>(false);
  const [nextStageUnlocked, setNextStageUnlocked] = useState<boolean>(false);
  
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const lastComboTimeRef = useRef<number>(0);
  const animationFrameId = useRef<number | null>(null);
  const lastFrameTime = useRef<number>(performance.now());
  const lastIconGenTime = useRef<number>(0);
  const clickSfxRef = useRef<HTMLAudioElement | null>(null);
  const bombSfxRef = useRef<HTMLAudioElement | null>(null);
  const comboSfxRef = useRef<HTMLAudioElement | null>(null);
  const loseHeartSfxRef = useRef<HTMLAudioElement | null>(null);
  const loseGameSfxRef = useRef<HTMLAudioElement | null>(null);

  // Translated icon names
  const iconTypes = useMemo<IconType[]>(() => [
    { component: Star, points: 10, color: 'text-yellow-400', name: 'Star', glowColor: '#fbbf24', weight: 30 },
    { component: Heart, points: 15, color: 'text-red-400', name: 'Heart', glowColor: '#ef4444', weight: 25 },
    { component: Gem, points: 25, color: 'text-blue-400', name: 'Gem', glowColor: '#3b82f6', weight: 20 },
    { component: Zap, points: 35, color: 'text-purple-400', name: 'Zap', glowColor: '#a855f7', weight: 10 },
    { component: Trophy, points: 50, color: 'text-green-400', name: 'Trophy', glowColor: '#22c55e', weight: 5 },
    { component: Bomb, points: -200, color: 'text-red-600', name: 'Bomb', glowColor: '#dc2626', weight: 15 }
  ], []);

  const getGameDimensions = useCallback((): GameDimensions => {
    const maxWidth = Math.min(600, window.innerWidth * 0.9);
    const maxHeight = Math.min(450, window.innerHeight * 0.6);
    return {
      width: maxWidth,
      height: maxHeight,
      iconSize: Math.max(40, Math.min(50, maxWidth / 12))
    };
  }, []);

  const [gameDimensions, setGameDimensions] = useState<GameDimensions>(getGameDimensions());

  useEffect(() => {
    if (!document.getElementById('custom-animation-styles')) {
      const style = document.createElement('style');
      style.id = 'custom-animation-styles';
      style.textContent = `
        @keyframes spin-slow { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 3s linear infinite; }
        @keyframes bounce-horizontal { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(8px); } }
        .animate-bounce-horizontal { animation: bounce-horizontal 1.5s ease-in-out infinite; }
        @keyframes bubblePop { 0% { transform: scale(0.5); opacity: 1; } 50% { transform: scale(1.2); opacity: 0.8; } 100% { transform: scale(2); opacity: 0; } }
      `;
      document.head.appendChild(style);
    }
    
    // Charger les données du stage depuis la base de données
    const loadStageData = async () => {
      try {
        setLoadingStage(true);
        const response = await fetch('/api/stages');
        const result = await response.json();
        
        if (result.status === 'success') {
          // Trouver le stage "reaction dash"
          const reactionDashStage = result.data.find((stage: Stage) => 
            stage.nom.toLowerCase() === 'reaction dash'
          );
          setStageData(reactionDashStage || null);
        } else {
          console.error('Failed to load stage data:', result.message);
          setStageData(null);
        }
      } catch (err) {
        console.error('Error loading stage data:', err);
        setStageData(null);
      } finally {
        setLoadingStage(false);
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

    loadStageData();
    loadPlayerData();
    return () => {
      const styleElement = document.getElementById('custom-animation-styles');
      if (styleElement) styleElement.remove();
    };
  }, []);

  useEffect(() => {
    const handleResize = () => setGameDimensions(getGameDimensions());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getGameDimensions]);

  // Init simple SFX (user-gesture friendly; triggered on clicks)
  useEffect(() => {
    if (!clickSfxRef.current) {
      clickSfxRef.current = new Audio('/click_reaction_dash.mp3');
      clickSfxRef.current.volume = 0.6;
    }
    if (!bombSfxRef.current) {
      bombSfxRef.current = new Audio('/Bombe.mp3');
      bombSfxRef.current.volume = 0.9;
    }
    if (!comboSfxRef.current) {
      comboSfxRef.current = new Audio('/click_reaction_dash.mp3');
      comboSfxRef.current.volume = 0.4;
      comboSfxRef.current.playbackRate = 1.5;
    }
    if (!loseHeartSfxRef.current) {
      loseHeartSfxRef.current = new Audio('/Lose_heart.mp3');
      loseHeartSfxRef.current.volume = 0.8;
    }
    if (!loseGameSfxRef.current) {
      loseGameSfxRef.current = new Audio('/lose.mp3');
      loseGameSfxRef.current.volume = 0.9;
    }
  }, []);

  // Play lose sound when game over triggers
  useEffect(() => {
    if (gameOver && loseGameSfxRef.current) {
      try {
        loseGameSfxRef.current.currentTime = 0;
        loseGameSfxRef.current.play().catch(() => {});
      } catch (_) {}
    }
  }, [gameOver]);

  const playSound = useCallback((type: 'click' | 'bomb' | 'combo') => {
    const safePlay = (el: HTMLAudioElement | null) => {
      if (!el) return;
      try {
        el.currentTime = 0;
        el.play().catch(() => {});
      } catch (_) {}
    };
    if ('vibrate' in navigator) {
      if (type === 'click') navigator.vibrate(20);
      else if (type === 'bomb') navigator.vibrate([120, 60, 120]);
      else if (type === 'combo') navigator.vibrate(30);
    }
    if (type === 'click') safePlay(clickSfxRef.current);
    else if (type === 'bomb') safePlay(bombSfxRef.current);
    else safePlay(comboSfxRef.current);
  }, []);

  const generateRandomIcon = useCallback((currentIcons: GameIcon[]): GameIcon => {
    const totalWeight = iconTypes.reduce((sum, icon) => sum + icon.weight, 0);
    let random = Math.random() * totalWeight;
    let selectedType: IconType | undefined = iconTypes[0];
    
    for (const icon of iconTypes) {
      if (random < icon.weight) {
        selectedType = icon;
        break;
      }
      random -= icon.weight;
    }
    
    if (!selectedType) selectedType = iconTypes[0]!;

    const numZones = 8;
    const margin = gameDimensions.iconSize / 2;
    const zoneWidth = (gameDimensions.width - (margin * 2)) / numZones;
    
    const now = Date.now();
    const recentZones = currentIcons
      .filter((icon: GameIcon) => now - icon.createdAt < 1500 && icon.y < gameDimensions.iconSize * 2)
      .map((icon: GameIcon) => Math.floor((icon.x - margin) / zoneWidth));
    
    let selectedZone = Math.floor(Math.random() * numZones);
    if (recentZones.includes(selectedZone) && recentZones.length < numZones) {
      for (let i = 0; i < numZones; i++) {
        if (!recentZones.includes(i)) {
          selectedZone = i;
          break;
        }
      }
    }
    
    const zoneX = margin + (selectedZone * zoneWidth);
    const randomX = zoneX + (Math.random() * 0.7 + 0.15) * zoneWidth;
    const startY = -gameDimensions.iconSize - Math.random() * gameDimensions.iconSize;
    const rotation = Math.random() * 20 - 10;
    
    const baseSpeed = 80 + (level * 4) + Math.random() * 20;
    let speedMultiplier = 1.0;

    if (selectedType && selectedType.points >= 35) {
      speedMultiplier = 0.9;
    } else if (selectedType && selectedType.component === Bomb) {
      speedMultiplier = 1.4;
    }

    return {
      id: Date.now() + Math.random(),
      type: selectedType,
      x: randomX,
      y: startY,
      speed: baseSpeed * speedMultiplier,
      rotation: rotation,
      rotationSpeed: (Math.random() - 0.5) * 2,
      createdAt: Date.now()
    };
  }, [iconTypes, gameDimensions, level]);

  const createBubblePop = useCallback((x: number, y: number, color: string) => {
    if (!gameAreaRef.current) return;
    
    const bubble = document.createElement('div');
    bubble.className = 'fixed pointer-events-none z-50';
    bubble.style.left = (x - 25) + 'px';
    bubble.style.top = (y - 25) + 'px';
    bubble.style.width = '50px';
    bubble.style.height = '50px';
    bubble.style.borderRadius = '50%';
    bubble.style.background = `radial-gradient(circle, ${color}66, ${color}33, transparent)`;
    bubble.style.border = `2px solid ${color}`;
    bubble.style.animation = 'bubblePop 0.6s ease-out forwards';
    
    document.body.appendChild(bubble);
    setTimeout(() => bubble.remove(), 600);
  }, []);

  const createFloatingText = useCallback((text: string, x: number, y: number, color: string = '#10B981') => {
    if (!gameAreaRef.current) return;
    const textDiv = document.createElement('div');
    textDiv.className = 'fixed text-2xl font-bold pointer-events-none z-50 transition-all duration-1000 drop-shadow-lg';
    textDiv.style.left = x + 'px';
    textDiv.style.top = y + 'px';
    textDiv.style.color = color;
    textDiv.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
    textDiv.textContent = text;
    
    document.body.appendChild(textDiv);
    
    requestAnimationFrame(() => {
      textDiv.style.transform = 'translateY(-80px) scale(1.3)';
      textDiv.style.opacity = '0';
    });
    
    setTimeout(() => textDiv.remove(), 1000);
  }, []);

  const handleIconClick = useCallback((clickedIcon: GameIcon, event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();
    event.stopPropagation();

    // Empêcher les clics multiples sur la même icône
    if (clickedIcons.has(clickedIcon.id)) {
      return;
    }

    // Marquer l'icône comme cliquée et la supprimer immédiatement
    setClickedIcons(prev => new Set(prev).add(clickedIcon.id));
    setIcons(prev => prev.filter((icon: GameIcon) => icon.id !== clickedIcon.id));

    const clickedElement = event.currentTarget as HTMLElement;
    const rect = clickedElement.getBoundingClientRect();

    const points = clickedIcon.type.points;
    const comboMultiplier = Math.floor(combo / 5) + 1;
    const finalPoints = points > 0 ? points * comboMultiplier : points;
    
    // Animations simplifiées et non-bloquantes
    createBubblePop(rect.left + rect.width / 2, rect.top + rect.height / 2, clickedIcon.type.glowColor);
    
    if (points > 0) {
      // Icône positive - ajouter les points
      setScore(prev => Math.max(0, prev + finalPoints));
      setCombo(prev => prev + 1);
      setMaxCombo(prev => Math.max(prev, combo + 1));
      lastComboTimeRef.current = Date.now();
      playSound('click');
      if (comboMultiplier > 1) {
        playSound('combo');
        createFloatingText(`x${comboMultiplier} COMBO!`, clickedIcon.x + 40, clickedIcon.y - 20, '#F59E0B');
      }
    } else {
      // C'est une bombe - retirer un cœur ET 200 points
      setCombo(0);
      setHearts(prev => Math.max(0, prev - 1));
      setScore(prev => Math.max(0, prev - 200));
      playSound('bomb');
      createFloatingText('BOOM! -1 ❤️', clickedIcon.x + 40, clickedIcon.y - 20, '#EF4444');
      createFloatingText('-200', clickedIcon.x + 30, clickedIcon.y + 30, '#EF4444');
      return; // Sortir early pour éviter l'affichage des points de la bombe
    }
    
    createFloatingText((finalPoints > 0 ? '+' : '') + finalPoints, clickedIcon.x + 30, clickedIcon.y + 30, points > 0 ? '#10B981' : '#EF4444');
    
    // Nettoyer l'icône de la liste des icônes cliquées immédiatement
    setTimeout(() => {
      setClickedIcons(prev => {
        const newSet = new Set(prev);
        newSet.delete(clickedIcon.id);
        return newSet;
      });
    }, 50);
  }, [combo, playSound, createFloatingText, createBubblePop, clickedIcons]);

  const startGame = useCallback(() => {
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setLevel(1);
    setHearts(10);
    setIcons([]);
    setGameOver(false);
    setGameActive(true);
    setClickedIcons(new Set()); // Nettoyer les icônes cliquées
    setShowLevelUp(false); // Réinitialiser les états de progression
    setNextStageUnlocked(false);
    lastComboTimeRef.current = 0;
  }, []);

  const endGame = useCallback(async () => {
    setGameActive(false);
    setGameOver(true);
    setIcons([]);
    
    if (score > bestScore) {
      setBestScore(score);
    }

    // Gérer la progression du joueur
    if (playerData && stageData) {
      try {
        const isPlayerAtStageLevel = playerData.etage_actuel === stageData.niveau;
        const hasReachedTargetScore = score >= stageData.target_score;

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
              etage_id: stageData.id,
              score: score,
              completed: true
            })
          });

          if (updatePlayerResponse.ok && createProgressionResponse.ok) {
            setNextStageUnlocked(true);
            setShowLevelUp(true);
            // Mettre à jour les données locales du joueur
            setPlayerData(prev => prev ? { ...prev, etage_actuel: prev.etage_actuel + 1 } : null);
          }

        } else if (playerData.etage_actuel > stageData.niveau) {
          // Cas 2: Joueur de niveau supérieur -> mettre à jour le score seulement si meilleur
          
          // D'abord récupérer la progression existante
          const getProgressionResponse = await fetch(`/api/progression?joueur_id=${playerData.reddit_id}&etage_id=${stageData.id}`);
          
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
                    etage_id: stageData.id,
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
  }, [score, bestScore, playerData, stageData]);

  const handleNextStage = useCallback(() => {
    console.log('Next Stage button clicked!', { onBack });
    if (onBack) {
      console.log('Calling onBack function');
      // Retourner à la page des niveaux pour que le joueur puisse voir le nouvel étage débloqué
      onBack();
    } else {
      console.log('onBack function not available');
    }
  }, [onBack]);

  // Surveiller les cœurs pour finir la partie
  useEffect(() => {
    if (gameActive && hearts <= 0) {
      endGame();
    }
  }, [hearts, gameActive, endGame]);

  useEffect(() => {
    if (!gameActive) return;
    
    // Décrémenter le combo si pas d'activité
    const comboTimer = setInterval(() => {
      if (Date.now() - lastComboTimeRef.current > 3000 && combo > 0) {
        setCombo(prev => Math.max(0, prev - 1));
      }
    }, 1000);
    
    return () => clearInterval(comboTimer);
  }, [gameActive, combo]);

  useEffect(() => {
    const newLevel = Math.floor(score / 200) + 1;
    if (newLevel !== level) {
      setLevel(newLevel);
      createFloatingText(`LEVEL ${newLevel}!`, gameDimensions.width / 2, gameDimensions.height / 2, '#8B5CF6'); // Translated
    }
  }, [score, level, createFloatingText, gameDimensions]);

  useEffect(() => {
    if (!gameActive) {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      return;
    }

    lastFrameTime.current = performance.now();

    const gameLoop = (timestamp: number) => {
      const deltaTime = (timestamp - lastFrameTime.current) / 1000;
      lastFrameTime.current = timestamp;

      setIcons(prevIcons => {
        let updatedIcons = prevIcons.map((icon: GameIcon) => ({
          ...icon,
          y: icon.y + icon.speed * deltaTime,
          rotation: icon.rotation + icon.rotationSpeed * deltaTime * 60,
        }));

        const generationInterval = Math.max(400, 1000 - level * 50);
        const maxIcons = Math.min(12, 6 + Math.floor(level / 2));

        if (timestamp - lastIconGenTime.current > generationInterval) {
          if (updatedIcons.length < maxIcons) {
            updatedIcons.push(generateRandomIcon(updatedIcons));
          }
          lastIconGenTime.current = timestamp;
        }

        // Filtrer les icônes qui sont tombées et retirer des cœurs
        const iconsInBounds = updatedIcons.filter(icon => {
          if (icon.y >= gameDimensions.height + 100) {
            // L'icône est tombée - retirer un cœur seulement si ce n'est pas une bombe
            if (icon.type.component !== Bomb) {
              setHearts(prev => Math.max(0, prev - 1));
              createFloatingText('-1 ❤️', gameDimensions.width / 2, gameDimensions.height - 50, '#EF4444');
              // Effet sonore de perte de cœur
              try {
                if (loseHeartSfxRef.current) {
                  loseHeartSfxRef.current.currentTime = 0;
                  loseHeartSfxRef.current.play().catch(() => {});
                }
              } catch (_) {}
            }
            return false; // Supprimer l'icône
          }
          return true; // Garder l'icône
        });

        return iconsInBounds;
      });

      animationFrameId.current = requestAnimationFrame(gameLoop);
    };

    animationFrameId.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [gameActive, gameDimensions.height, generateRandomIcon, level, createFloatingText]);

  if (!gameActive && !gameOver) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4 relative"
        style={{
          backgroundImage: 'url(/Reaction.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="absolute inset-0 bg-black/30"></div>
        <div className="bg-black/40 backdrop-blur-sm rounded-lg p-8 max-w-md w-full text-center border border-amber-500/30 relative z-10">
          <h1 className="text-3xl font-bold text-amber-100 mb-6 drop-shadow-lg">
            {stageData?.nom || "Reaction Dash"}
          </h1>
          
          {loadingStage ? (
            <div className="bg-black/20 rounded-lg p-4 mb-6 border border-amber-700/20">
              <div className="text-amber-200 mb-3">Loading...</div>
            </div>
          ) : (
            <div className="bg-black/20 rounded-lg p-4 mb-6 border border-amber-700/20">
              {stageData ? (
                <>
                  <h2 className="text-lg font-semibold text-amber-200 mb-3">Description:</h2>
                  <p className="text-amber-100/80 text-sm leading-relaxed mb-4">
                    {stageData.description} {stageData.regles}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-semibold text-amber-200 mb-3">Quest Rules:</h2>
                  <div className="space-y-3 text-amber-100/80 text-sm leading-relaxed">
                    <p className="text-center">
                      Collect the falling items! Chain combos!<br/>
                      <span className="text-red-300">You have 10 hearts ❤️</span><br/>
                      <span className="text-yellow-300">Don't let items fall or click bombs!</span>
                    </p>
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-2 mt-4">
                {iconTypes.map((type, index) => {
                  const IconComponent = type.component;
                  return (
                    <div key={index} className="flex items-center space-x-2">
                      <IconComponent className={`w-5 h-5 ${type.color}`} />
                      <span className="text-xs text-white">{type.name}: {type.points > 0 ? '+' : ''}{type.points}pts</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {bestScore > 0 && (
            <div className="mb-6 text-amber-100/90">
              <p className="text-lg">Best Haul: <span className="font-bold text-yellow-300">{bestScore}</span></p>
            </div>
          )}
          
          <div className="space-y-3">
            <button 
              onClick={startGame} 
              className="w-full bg-gradient-to-r from-amber-600/80 to-yellow-600/80 text-white py-3 px-6 rounded-lg font-semibold hover:from-amber-700/90 hover:to-yellow-700/90 transition-all duration-300 transform hover:scale-105 shadow-lg border border-amber-500/30 relative z-20 cursor-pointer"
            >
              Start
            </button>
            
            {onBack && (
              <button 
                onClick={onBack} 
                className="w-full bg-gradient-to-r from-gray-600/80 to-gray-700/80 text-white py-3 px-6 rounded-lg font-semibold hover:from-gray-700/90 hover:to-gray-800/90 transition-all duration-300 transform hover:scale-105 shadow-lg border border-gray-500/30 relative z-20 cursor-pointer"
              >
                Back
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (gameActive) {
    return (
      <div 
        ref={gameAreaRef}
        className="min-h-screen flex flex-col items-center justify-center p-4 relative"
        style={{
          backgroundImage: 'url(/Reaction.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="absolute inset-0 bg-black/40"></div>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div 
              key={i} 
              className="absolute w-1 h-1 bg-yellow-200 rounded-full opacity-50" 
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
          <div className="flex justify-between items-center mb-4 bg-black/30 backdrop-blur-sm rounded-lg p-4 border border-amber-500/20 flex-wrap gap-2">
            <div className="text-amber-100">
              <h1 className="text-2xl font-bold mb-2 drop-shadow-lg">Reaction Dash</h1>
              <div className="text-lg">
                Score: <span className="text-yellow-400 font-bold text-2xl">{score}</span>
              </div>
              {bestScore > 0 && (
                <div className="text-sm text-gray-300">
                  Best: <span className="text-green-400 font-semibold">{bestScore}</span>
                </div>
              )}
            </div>
            <div className="text-amber-100 text-right flex flex-col items-end gap-2">
              <div className="text-2xl font-bold">
                Hearts: <span className="text-red-400">
                  ❤️X{hearts}
                </span>
              </div>
              <div className="text-sm">Level: <span className="text-cyan-300 font-bold">{level}</span></div>
              {onBack && (
                <button 
                  onClick={onBack}
                  className="mt-2 px-3 py-1 bg-gray-600/80 hover:bg-gray-700/80 text-white rounded text-sm transition-colors border border-gray-500/30"
                >
                  ← Back
                </button>
              )}
            </div>
          </div>
          <div className="mb-4 bg-black/30 rounded-full h-4 overflow-hidden border-2 border-red-500/40">
            <div 
              className={`h-full transition-all duration-300 ease-linear ${
                hearts <= 3 ? 'bg-gradient-to-r from-red-600 to-red-700' : 
                'bg-gradient-to-r from-green-400 via-yellow-400 to-red-500'
              }`} 
              style={{ width: `${Math.max(0, (hearts / 10) * 100)}%` }}
            />
          </div>
          <div 
            className="relative bg-black/30 backdrop-blur-sm border-2 border-amber-500/30 rounded-lg overflow-hidden mx-auto" 
            style={{ width: gameDimensions.width, height: gameDimensions.height }}
          >
            {icons.map((icon) => {
              const IconComponent = icon.type.component;
              const isRare = icon.type.points >= 35;
              return (
                <div
                  key={icon.id}
                  className={`absolute cursor-pointer transform hover:scale-110`}
                  style={{ 
                    left: icon.x, 
                    top: icon.y, 
                    transform: `rotate(${icon.rotation}deg)`, 
                    zIndex: isRare ? 20 : 10 
                  }}
                  onClick={(e) => handleIconClick(icon, e)}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    handleIconClick(icon, e);
                  }}
                >
                  <div className="relative">
                    <div 
                      className="absolute inset-0 rounded-full blur-md opacity-60" 
                      style={{ 
                        width: gameDimensions.iconSize * 1.5, 
                        height: gameDimensions.iconSize * 1.5, 
                        left: -gameDimensions.iconSize * 0.25, 
                        top: -gameDimensions.iconSize * 0.25, 
                        background: `radial-gradient(circle, ${icon.type.glowColor}${isRare ? '44' : '33'}, transparent 70%)` 
                      }}
                    />
                    <div 
                      className={`relative rounded-full bg-black/20 backdrop-blur-sm border-2 flex items-center justify-center shadow-lg ${
                        isRare ? 'border-yellow-400/60' : 'border-amber-500/30'
                      }`} 
                      style={{ width: gameDimensions.iconSize, height: gameDimensions.iconSize }}
                    >
                      <IconComponent 
                        className={`${icon.type.color} drop-shadow-lg`} 
                        style={{ width: gameDimensions.iconSize * 0.6, height: gameDimensions.iconSize * 0.6 }}
                      />
                    </div>
                    {icon.type.component === Bomb && (
                      <div className="absolute inset-0 animate-ping">
                        <div 
                          className="rounded-full bg-red-500/20 border-2 border-red-400/50" 
                          style={{ width: gameDimensions.iconSize, height: gameDimensions.iconSize }}
                        ></div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (gameOver) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4 relative"
        style={{
          backgroundImage: 'url(/Reaction.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="absolute inset-0 bg-black/40"></div>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(25)].map((_, i) => (
            <div 
              key={i} 
              className="absolute w-1 h-1 bg-yellow-200 rounded-full opacity-70" 
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
          <h1 className="text-3xl font-bold text-amber-100 mb-6 drop-shadow-lg">Quest Complete</h1>
          
          {nextStageUnlocked && (
            <div className="mb-6 p-4 bg-gradient-to-r from-green-600/20 to-emerald-600/20 rounded-lg border border-green-500/30">
              <div className="text-green-300 text-xl font-bold mb-2">🎉 Stage Unlocked! 🎉</div>
              <div className="text-green-200 text-sm">
                You've reached the target score and unlocked the next stage!
              </div>
            </div>
          )}

          <div className="mb-6 space-y-4">
            <div className="text-amber-100">
              <p className="text-xl">Final Haul:</p>
              <p className="text-4xl font-bold text-yellow-300">{score}</p>
              {stageData && (
                <p className="text-sm text-gray-300 mt-2">
                  Target: {stageData.target_score} {score >= stageData.target_score ? "✅" : "❌"}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black/20 rounded-lg p-3 border border-amber-500/20">
                <p className="text-amber-200 text-sm">Max Combo</p>
                <p className="text-2xl font-bold text-orange-300">{maxCombo}x</p>
              </div>
              <div className="bg-black/20 rounded-lg p-3 border border-amber-500/20">
                <p className="text-amber-200 text-sm">Level</p>
                <p className="text-2xl font-bold text-cyan-300">{level}</p>
              </div>
            </div>
            <div className="text-amber-100">
              <p className="text-lg">
                {score >= 1000 ? "🏆 Treasure Legend!" : 
                 score >= 500 ? "⚔️ Master Hunter!" : 
                 score >= 200 ? "🎯 Skilled Hunter!" : 
                 "🌟 Apprentice Adventurer!"}
              </p>
            </div>
            {score === bestScore && score > 0 && (
              <div className="text-yellow-300 text-lg font-bold">
                🏆 New Record! 🏆
              </div>
            )}
          </div>
          <div className="space-y-3">
            {nextStageUnlocked && (
              <button 
                onClick={handleNextStage} 
                className="w-full bg-gradient-to-r from-green-600/80 to-emerald-600/80 text-white py-3 px-6 rounded-lg font-semibold hover:from-green-700/90 hover:to-emerald-700/90 transition-all duration-300 transform hover:scale-105 shadow-lg border border-green-500/30 cursor-pointer z-20 pointer-events-auto"
              >
                Next Stage 🚀
              </button>
            )}
            <button 
              onClick={startGame} 
              className="w-full bg-gradient-to-r from-amber-600/80 to-yellow-600/80 text-white py-3 px-6 rounded-lg font-semibold hover:from-amber-700/90 hover:to-yellow-700/90 transition-all duration-300 transform hover:scale-105 shadow-lg border border-amber-500/30 cursor-pointer z-20 pointer-events-auto"
            >
              New Quest
            </button>
            <button 
              onClick={() => setGameOver(false)} 
              className="w-full bg-gradient-to-r from-gray-600/80 to-gray-700/80 text-white py-3 px-6 rounded-lg font-semibold hover:from-gray-700/90 hover:to-gray-800/90 transition-all duration-300 transform hover:scale-105 shadow-lg border border-gray-500/30 cursor-pointer z-20 pointer-events-auto"
            >
              Back to Camp
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default WordExpress;


