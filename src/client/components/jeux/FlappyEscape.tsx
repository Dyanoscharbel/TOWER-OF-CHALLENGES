import { useState, useEffect, useCallback, useRef } from 'react';

interface FlappyEscapeProps {
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

interface Obstacle {
  id: number;
  x: number;
  topHeight: number;
  bottomHeight: number;
  passed: boolean;
}

interface Bonus {
  id: number;
  x: number;
  y: number;
  type: 'points' | 'heart';
  collected: boolean;
  value: number;
}

interface Cloud {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
}

interface GameState {
  isPlaying: boolean;
  isGameOver: boolean;
  score: number;
  time: number;
  birdY: number;
  birdVelocity: number;
  obstacles: Obstacle[];
  bonuses: Bonus[];
  clouds: Cloud[];
  gameSpeed: number;
  showMenu: boolean;
  showScoreScreen: boolean;
  hearts: number;
  maxHearts: number;
  countdown: number;
  showCountdown: boolean;
}

// Interface pour l'animation de perte de cœur
interface HeartLossAnimation {
  id: number;
  x: number;
  y: number;
  opacity: number;
  scale: number;
  createdAt: number;
}

const BASE_GAME_CONFIG = {
  BIRD_SIZE: 30,
  BIRD_JUMP_FORCE: -6, // Reduced from -8 to make jumps less aggressive
  GRAVITY: 0.3, // Reduced from 0.5 to make bird fall slower
  OBSTACLE_WIDTH: 60,
  OBSTACLE_GAP: 200, // Increased from 150 to make gap bigger
  OBSTACLE_SPEED: 2, // Reduced from 3 to make game less fast
  OBSTACLE_SPAWN_DISTANCE: 300,
  GAME_WIDTH: 500, // Increased from 400 for PC
  GAME_HEIGHT: 700, // Increased from 600 for PC
  GROUND_HEIGHT: 50,
  BONUS_SIZE: 20,
  MAX_HEARTS: 10, // Increased from 5 to 10 hearts
};

// Cette fonction permettra d'ajuster les dimensions du jeu selon la taille d'écran
const getResponsiveGameConfig = () => {
  // Pour le calcul initial
  const config = {...BASE_GAME_CONFIG};
  
    // Si on est sur mobile ou tablette (moins de 768px de large)
  if (typeof window !== 'undefined' && window.innerWidth < 768) {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    // Adapter la taille du jeu en gardant le ratio mais en s'assurant qu'il tient sur l'écran
    const scale = Math.min(
      (screenWidth - 40) / config.GAME_WIDTH,
      (screenHeight - 200) / config.GAME_HEIGHT,
      0.8 // Maximum scale limit for mobile
    );
    
    // Ajuster les dimensions du jeu
    config.GAME_WIDTH = Math.floor(config.GAME_WIDTH * scale);
    config.GAME_HEIGHT = Math.floor(config.GAME_HEIGHT * scale);
    
    // Ajuster proportionnellement les autres valeurs
    config.BIRD_SIZE = Math.max(20, Math.floor(config.BIRD_SIZE * scale));
    config.OBSTACLE_WIDTH = Math.floor(config.OBSTACLE_WIDTH * scale);
    config.OBSTACLE_GAP = Math.floor(config.OBSTACLE_GAP * scale);
    config.GROUND_HEIGHT = Math.floor(config.GROUND_HEIGHT * scale);
    config.BONUS_SIZE = Math.floor(config.BONUS_SIZE * scale);
    
    // Adjust physics for mobile - slower and more forgiving
    config.BIRD_JUMP_FORCE = -4; // Even less aggressive for mobile
    config.GRAVITY = 0.2; // Much slower falling for mobile
    config.OBSTACLE_SPEED = 1.2; // Much slower obstacles for mobile
  } else {
    // PC settings - keep the larger size and gap
    // No scaling needed, keep original larger dimensions
  }
  
  return config;
};

const GAME_CONFIG = getResponsiveGameConfig();

// Composant oiseau simplifié avec emoji pour plus de fluidité
const AnimatedBird = ({ rotation }: { rotation: number }) => {
  return (
    <div 
      className="w-full h-full flex items-center justify-center"
      style={{ transform: `scaleX(-1) rotate(${rotation}deg)` }} // Flip bird horizontally
    >
      <div className="text-3xl">🐦</div>
    </div>
  );
};

// Composant nuage
const CloudComponent = ({ cloud }: { cloud: Cloud }) => (
  <div
    className="absolute text-white/30 transition-all duration-1000"
    style={{
      left: cloud.x,
      top: cloud.y,
      fontSize: `${cloud.size}px`,
      transform: 'scaleX(-1)',
    }}
  >
    ☁️
  </div>
);

export const FlappyEscape = ({ onBack }: FlappyEscapeProps) => {
  const [gameState, setGameState] = useState<GameState>({
    isPlaying: false,
    isGameOver: false,
    score: 0,
    time: 0,
    birdY: GAME_CONFIG.GAME_HEIGHT / 2,
    birdVelocity: 0,
    obstacles: [],
    bonuses: [],
    clouds: [],
    gameSpeed: GAME_CONFIG.OBSTACLE_SPEED,
    showMenu: true,
    showScoreScreen: false,
    hearts: GAME_CONFIG.MAX_HEARTS,
    maxHearts: GAME_CONFIG.MAX_HEARTS,
    countdown: 3,
    showCountdown: false,
  });
  
  const [stageData, setStageData] = useState<Stage | null>(null);
  const [loadingStage, setLoadingStage] = useState(true);
  const [playerData, setPlayerData] = useState<any>(null);
  const [progressionSaved, setProgressionSaved] = useState(false);
  
  // État pour les animations de perte de cœur
  const [heartLossAnimations, setHeartLossAnimations] = useState<HeartLossAnimation[]>([]);
  const lastHeartAnimIdRef = useRef(0);

  const gameLoopRef = useRef<number | undefined>(undefined);
  const lastObstacleIdRef = useRef(0);
  const lastBonusIdRef = useRef(0);
  const lastCloudIdRef = useRef(0);
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const countdownRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const lastFrameTimeRef = useRef(0);
  
  // Sound effects
  const clickSfxRef = useRef<HTMLAudioElement | null>(null);
  const loseHeartSfxRef = useRef<HTMLAudioElement | null>(null);
  const successSfxRef = useRef<HTMLAudioElement | null>(null);
  const loseGameSfxRef = useRef<HTMLAudioElement | null>(null);

  // Initialiser les nuages
  const initializeClouds = useCallback(() => {
    const clouds: Cloud[] = [];
    for (let i = 0; i < 8; i++) {
      clouds.push({
        id: lastCloudIdRef.current++,
        x: Math.random() * (GAME_CONFIG.GAME_WIDTH + 200),
        y: Math.random() * (GAME_CONFIG.GAME_HEIGHT - 100),
        size: 20 + Math.random() * 15,
        speed: 0.5 + Math.random() * 1,
      });
    }
    return clouds;
  }, []);

  const jump = useCallback(() => {
    if (!gameState.isPlaying || gameState.isGameOver) return;
    
    // Play click sound
    try {
      if (clickSfxRef.current) {
        clickSfxRef.current.currentTime = 0;
        clickSfxRef.current.play().catch(() => {});
      }
    } catch (_) {}
    
    // Appliquer une force vers le haut (valeur négative pour monter)
    // Force de saut constante pour un comportement prévisible
    setGameState(prev => ({
      ...prev,
      birdVelocity: GAME_CONFIG.BIRD_JUMP_FORCE,
    }));
  }, [gameState.isPlaying, gameState.isGameOver]);

  // Fonction pour créer une animation de perte de cœur
  const createHeartLossAnimation = useCallback(() => {
    const newAnimation: HeartLossAnimation = {
      id: lastHeartAnimIdRef.current++,
      x: GAME_CONFIG.GAME_WIDTH / 2, // Centre horizontalement
      y: GAME_CONFIG.GAME_HEIGHT - 100, // Bas de l'écran mais pas tout en bas
      opacity: 1,
      scale: 1,
      createdAt: Date.now()
    };
    
    setHeartLossAnimations(prev => [...prev, newAnimation]);
  }, []);

  // Nous avons supprimé la logique d'appui long qui causait des problèmes
  // avec le mouvement de l'oiseau

  // Gestion des interactions sur la zone de jeu (clics ou touches)
  const handleGameAreaInteraction = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Simple clic ou toucher = un seul saut
    jump();
  }, [jump]);

  // Load stage data from database
  const loadStageData = useCallback(async () => {
    try {
      setLoadingStage(true);
      const response = await fetch('/api/stages');
      const result = await response.json();
      
      if (result.status === 'success') {
        // Find the "Flappy Escape" stage
        const flappyEscapeStage = result.data.find((stage: Stage) => 
          stage.nom.toLowerCase().includes('flappy escape') || 
          stage.nom.toLowerCase().includes('flappy')
        );
        
        if (flappyEscapeStage) {
          setStageData(flappyEscapeStage);
        } else {
          console.warn('Flappy Escape stage not found in database');
        }
      } else {
        console.error('Failed to load stages:', result.message);
      }
    } catch (error) {
      console.error('Error loading stage data:', error);
    } finally {
      setLoadingStage(false);
    }
  }, []);

  // Load player data
  const loadPlayerData = useCallback(async () => {
    try {
      const response = await fetch('/api/player/init');
      const result = await response.json();
      
      if (result.status === 'success') {
        setPlayerData(result.data);
      } else {
        console.error('Failed to load player data:', result.message);
      }
    } catch (error) {
      console.error('Error loading player data:', error);
    }
  }, []);

  const startGame = useCallback(() => {
    // Start countdown
    setGameState(prev => ({
      ...prev,
      showCountdown: true,
      countdown: 3,
      showMenu: false,
    }));

    // Countdown logic
    let count = 3;
    const countdownInterval = setInterval(() => {
      count--;
      setGameState(prev => ({
        ...prev,
        countdown: count,
      }));

      if (count <= 0) {
        clearInterval(countdownInterval);
        setGameState(prev => ({
          ...prev,
          showCountdown: false,
          isPlaying: true,
        }));
      }
    }, 1000);

    countdownRef.current = countdownInterval as NodeJS.Timeout;
  }, []);

  const startActualGame = useCallback(() => {
    // Arrêter le game loop existant s'il y en a un
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = undefined;
    }
    
    // S'assurer que tous les intervalles sont nettoyés
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = undefined;
    }
    
    setGameState(prev => ({
      ...prev,
      isPlaying: true,
      isGameOver: false,
      score: 0,
      time: 0,
      birdY: GAME_CONFIG.GAME_HEIGHT / 2,
      birdVelocity: 0, // Vélocité initiale à 0
      obstacles: [],
      bonuses: [],
      clouds: initializeClouds(),
      gameSpeed: GAME_CONFIG.OBSTACLE_SPEED,
      showMenu: false,
      showScoreScreen: false,
      hearts: GAME_CONFIG.MAX_HEARTS,
      maxHearts: GAME_CONFIG.MAX_HEARTS,
      countdown: 3,
      showCountdown: false,
    }));
    lastObstacleIdRef.current = 0;
    lastBonusIdRef.current = 0;
  }, [initializeClouds]);

  const resetGame = useCallback(() => {
    // Arrêter le game loop existant
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = undefined;
    }
    
    setGameState(prev => ({
      ...prev,
      isPlaying: false,
      isGameOver: false,
      score: 0,
      time: 0,
      birdY: GAME_CONFIG.GAME_HEIGHT / 2,
      birdVelocity: 0,
      obstacles: [],
      bonuses: [],
      clouds: initializeClouds(),
      gameSpeed: GAME_CONFIG.OBSTACLE_SPEED,
      showMenu: true,
      showScoreScreen: false,
      hearts: GAME_CONFIG.MAX_HEARTS,
      maxHearts: GAME_CONFIG.MAX_HEARTS,
      countdown: 3,
      showCountdown: false,
    }));
  }, [initializeClouds]);

  // Game loop
  useEffect(() => {
    if (!gameState.isPlaying || gameState.isGameOver) {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = undefined;
      }
      return;
    }

    const gameLoop = () => {
      // Use requestAnimationFrame with throttling for mobile performance
      const now = performance.now();
      if (now - lastFrameTimeRef.current < 16) { // ~60fps max
        gameLoopRef.current = requestAnimationFrame(gameLoop);
        return;
      }
      lastFrameTimeRef.current = now;
      
      setGameState(prev => {
        // Update bird physics - La gravité fait toujours tomber l'oiseau
        // Valeur positive = descente, négative = montée
        const newVelocity = prev.birdVelocity + GAME_CONFIG.GRAVITY;
        const newBirdY = prev.birdY + newVelocity;

        // Check ground collision - GAME OVER immédiat si l'oiseau touche le sol
        if (newBirdY + GAME_CONFIG.BIRD_SIZE > GAME_CONFIG.GAME_HEIGHT - GAME_CONFIG.GROUND_HEIGHT) {
          return {
            ...prev,
            isGameOver: true,
            isPlaying: false,
            showScoreScreen: true,
            hearts: 0,
          };
        }

        // Check ceiling collision - GAME OVER immédiat si l'oiseau sort par le haut
        if (newBirdY < 0) {
          return {
            ...prev,
            isGameOver: true,
            isPlaying: false,
            showScoreScreen: true,
            hearts: 0,
          };
        }

        // Update clouds
        let newClouds = prev.clouds.map(cloud => ({
          ...cloud,
          x: cloud.x - cloud.speed,
        }));

        // Respawn clouds that went off screen
        newClouds = newClouds.map(cloud => {
          if (cloud.x < -50) {
            return {
              ...cloud,
              x: GAME_CONFIG.GAME_WIDTH + Math.random() * 100,
              y: Math.random() * (GAME_CONFIG.GAME_HEIGHT - 100),
            };
          }
          return cloud;
        });

        // Update obstacles
        let newObstacles = prev.obstacles.map(obstacle => ({
          ...obstacle,
          x: obstacle.x - prev.gameSpeed,
        })).filter(obstacle => obstacle.x > -GAME_CONFIG.OBSTACLE_WIDTH);

        // Update bonuses
        let newBonuses = prev.bonuses.map(bonus => ({
          ...bonus,
          x: bonus.x - prev.gameSpeed,
        })).filter(bonus => bonus.x > -GAME_CONFIG.BONUS_SIZE && !bonus.collected);

        // Spawn new obstacles
        const lastObstacle = newObstacles[newObstacles.length - 1];
        if (!lastObstacle || lastObstacle.x < GAME_CONFIG.GAME_WIDTH - GAME_CONFIG.OBSTACLE_SPAWN_DISTANCE) {
          const obstacleHeight = Math.random() * (GAME_CONFIG.GAME_HEIGHT - GAME_CONFIG.OBSTACLE_GAP - GAME_CONFIG.GROUND_HEIGHT - 150) + 75;
          newObstacles.push({
            id: lastObstacleIdRef.current++,
            x: GAME_CONFIG.GAME_WIDTH,
            topHeight: obstacleHeight,
            bottomHeight: GAME_CONFIG.GAME_HEIGHT - obstacleHeight - GAME_CONFIG.OBSTACLE_GAP - GAME_CONFIG.GROUND_HEIGHT,
            passed: false,
          });

          // Spawn bonus randomly
          if (Math.random() < 0.7) {
            const bonusType = Math.random() < 0.7 ? 'points' : 'heart';
            const bonusValue = bonusType === 'points' ? 50 : 1; // Diamonds give 50 points
            newBonuses.push({
              id: lastBonusIdRef.current++,
              x: GAME_CONFIG.GAME_WIDTH + GAME_CONFIG.OBSTACLE_WIDTH + 50,
              y: obstacleHeight + GAME_CONFIG.OBSTACLE_GAP / 2 - GAME_CONFIG.BONUS_SIZE / 2,
              type: bonusType,
              collected: false,
              value: bonusValue,
            });
          }
        }

        // Check collisions with obstacles
        const birdLeft = GAME_CONFIG.GAME_WIDTH / 2 - GAME_CONFIG.BIRD_SIZE / 2;
        const birdRight = GAME_CONFIG.GAME_WIDTH / 2 + GAME_CONFIG.BIRD_SIZE / 2;
        const birdTop = newBirdY;
        const birdBottom = newBirdY + GAME_CONFIG.BIRD_SIZE;

        let newHearts = prev.hearts;
        let newScore = prev.score;

        // Check bonus collection
        newBonuses = newBonuses.map(bonus => {
          if (!bonus.collected) {
            const bonusLeft = bonus.x;
            const bonusRight = bonus.x + GAME_CONFIG.BONUS_SIZE;
            const bonusTop = bonus.y;
            const bonusBottom = bonus.y + GAME_CONFIG.BONUS_SIZE;

            if (birdRight > bonusLeft && birdLeft < bonusRight && 
                birdBottom > bonusTop && birdTop < bonusBottom) {
                if (bonus.type === 'points') {
                  newScore += bonus.value;
                } else if (bonus.type === 'heart' && newHearts < prev.maxHearts) {
                  newHearts += bonus.value;
                }
                
                // Play success sound
                try {
                  if (successSfxRef.current) {
                    successSfxRef.current.currentTime = 0;
                    successSfxRef.current.play().catch(() => {});
                  }
                } catch (_) {}
                
                return { ...bonus, collected: true };
            }
          }
          return bonus;
        });

        // Vérification des collisions avec les obstacles
        for (let i = 0; i < newObstacles.length; i++) {
          const obstacle = newObstacles[i];
          if (!obstacle) continue;
          const obstacleLeft = obstacle.x;
          const obstacleRight = obstacle.x + GAME_CONFIG.OBSTACLE_WIDTH;
          
          // Check if bird is in horizontal range of obstacle
          if (birdRight > obstacleLeft && birdLeft < obstacleRight) {
            // Check vertical collision
            if (birdTop < obstacle.topHeight || birdBottom > GAME_CONFIG.GAME_HEIGHT - GAME_CONFIG.GROUND_HEIGHT - obstacle.bottomHeight) {
              // Retirer l'obstacle heurté
              newObstacles.splice(i, 1);
              
              // Perdre un cœur
              newHearts -= 1;
              
              // Play lose heart sound
              try {
                if (loseHeartSfxRef.current) {
                  loseHeartSfxRef.current.currentTime = 0;
                  loseHeartSfxRef.current.play().catch(() => {});
                }
              } catch (_) {}
              
              // Créer une animation de perte de cœur
              createHeartLossAnimation();
              
              // Check for game over
              if (newHearts <= 0) {
                // Play lose game sound immediately when game ends
                try {
                  if (loseGameSfxRef.current) {
                    loseGameSfxRef.current.currentTime = 0;
                    loseGameSfxRef.current.play().catch(() => {});
                  }
                } catch (_) {}
                
                return {
                  ...prev,
                  isGameOver: true,
                  isPlaying: false,
                  showScoreScreen: true,
                  hearts: 0,
                };
              }
              return {
                ...prev,
                hearts: newHearts,
                birdY: newBirdY,         // Garder la position actuelle de l'oiseau
                birdVelocity: newVelocity, // Garder la vélocité actuelle de l'oiseau
                obstacles: newObstacles,
                bonuses: newBonuses,
                clouds: newClouds,
                score: newScore,
              };
            }
          }
          
          // Check if obstacle was passed
          if (!obstacle.passed && obstacle.x + GAME_CONFIG.OBSTACLE_WIDTH < birdLeft) {
            obstacle.passed = true;
            newScore += 1;
          }
        }

        return {
          ...prev,
          birdY: newBirdY,
          birdVelocity: newVelocity,
          obstacles: newObstacles,
          bonuses: newBonuses,
          clouds: newClouds,
          time: prev.time + 1,
          hearts: newHearts,
          score: newScore,
        };
      });

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = undefined;
      }
    };
  }, [gameState.isPlaying, gameState.isGameOver]);

  // Slightly increase game speed every minute of active play
  useEffect(() => {
    if (!gameState.isPlaying || gameState.isGameOver) return;
    const minutes = Math.floor((gameState.time / 60));
    // Base speed plus a tiny increment per minute (e.g., 3% per minute)
    const newSpeed = GAME_CONFIG.OBSTACLE_SPEED * (1 + minutes * 0.03);
    if (newSpeed !== gameState.gameSpeed) {
      setGameState(prev => ({ ...prev, gameSpeed: newSpeed }));
    }
  }, [gameState.isPlaying, gameState.isGameOver, gameState.time, gameState.gameSpeed]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        jump();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [jump]);

  // Effet pour animer et nettoyer les animations de perte de cœur
  useEffect(() => {
    if (heartLossAnimations.length === 0) return;
    
    const interval = setInterval(() => {
      const now = Date.now();
      setHeartLossAnimations(animations => 
        animations
          .map(anim => ({
            ...anim,
            y: anim.y - 1.5, // Monte progressivement
            opacity: Math.max(0, 1 - (now - anim.createdAt) / 1500), // Devient transparent
            scale: anim.scale + 0.01 // Grossit légèrement
          }))
          .filter(anim => now - anim.createdAt < 1500) // Supprime après 1.5 secondes
      );
    }, 16);
    
    return () => clearInterval(interval);
  }, [heartLossAnimations]);

  // Effet pour recalculer les dimensions lors du redimensionnement de la fenêtre
  useEffect(() => {
    const handleResize = () => {
      // Force restart du jeu si on est en train de jouer
      if (gameState.isPlaying) {
        startActualGame();
      }
    };
    
    // Débounce pour éviter trop d'appels - increased timeout for mobile
    let resizeTimeout: NodeJS.Timeout;
    const debouncedResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(handleResize, 500); // Increased from 250ms
    };
    
    window.addEventListener('resize', debouncedResize);
    return () => {
      window.removeEventListener('resize', debouncedResize);
      clearTimeout(resizeTimeout);
    };
  }, [gameState.isPlaying, startActualGame]);

  // Nettoyage à la destruction du composant et à chaque changement d'état de jeu
  useEffect(() => {
    // Nettoyage à la destruction du composant
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = undefined;
      }
    };
  }, [gameState.isPlaying, gameState.isGameOver]);

  // Load stage data and player data on component mount
  useEffect(() => {
    loadStageData();
    loadPlayerData();
  }, [loadStageData, loadPlayerData]);

  // Initialize sound effects
  useEffect(() => {
    const sfxVolume = parseFloat(localStorage.getItem('sfxVolume') || '0.8');
    clickSfxRef.current = new Audio('/click_reaction_dash.mp3');
    clickSfxRef.current.volume = sfxVolume * 0.6;
    loseHeartSfxRef.current = new Audio('/Lose_heart.mp3');
    loseHeartSfxRef.current.volume = sfxVolume * 0.8;
    successSfxRef.current = new Audio('/success.mp3');
    successSfxRef.current.volume = sfxVolume;
    loseGameSfxRef.current = new Audio('/lose.mp3');
    loseGameSfxRef.current.volume = sfxVolume;
  }, []);

  // Handle progression saving when game ends
  useEffect(() => {
    if (!gameState.isGameOver || !playerData || !stageData || progressionSaved) {
      return;
    }

    const saveProgression = async () => {
      try {
        // Play lose game sound
        try {
          if (loseGameSfxRef.current) {
            loseGameSfxRef.current.currentTime = 0;
            loseGameSfxRef.current.play().catch(() => {});
          }
        } catch (_) {}

        const success = gameState.score >= stageData.target_score;
        
        // Check if progression exists and update only if score is better
        try {
          const getProgressionResponse = await fetch(`/api/progression?joueur_id=${playerData.reddit_id}&etage_id=${stageData.id}`);
          
          if (getProgressionResponse.ok) {
            const progressionResult = await getProgressionResponse.json();
            
            if (progressionResult.status === 'success' && progressionResult.data) {
              const existingProgression = progressionResult.data;
              
              // Update only if the new score is better
              if (gameState.score > existingProgression.score) {
                const updateProgressionResponse = await fetch('/api/progression/update', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    joueur_id: playerData.reddit_id,
                    etage_id: stageData.id,
                    score: gameState.score,
                    completed: success
                  })
                });

                if (updateProgressionResponse.ok) {
                  console.log('Progression updated successfully');
                  setProgressionSaved(true);
                } else {
                  console.error('Failed to update progression');
                }
              } else {
                console.log('Score not improved, keeping existing progression');
                setProgressionSaved(true);
              }
            } else {
              // No existing progression, create new one
              const createProgressionResponse = await fetch('/api/progression/create', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  joueur_id: playerData.reddit_id,
                  etage_id: stageData.id,
                  score: gameState.score,
                  completed: success
                })
              });

              if (createProgressionResponse.ok) {
                console.log('New progression created successfully');
                setProgressionSaved(true);
              } else {
                console.error('Failed to create progression');
              }
            }
          } else {
            // Failed to fetch existing progression, create new one
            const createProgressionResponse = await fetch('/api/progression/create', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                joueur_id: playerData.reddit_id,
                etage_id: stageData.id,
                score: gameState.score,
                completed: success
              })
            });

            if (createProgressionResponse.ok) {
              console.log('New progression created successfully');
              setProgressionSaved(true);
            } else {
              console.error('Failed to create progression');
            }
          }
        } catch (progressionError) {
          console.error('Error handling progression:', progressionError);
        }
        
        // Handle level unlocking if stage completed AND player is currently on this stage
        if (success && playerData && typeof playerData.etage_actuel === 'number' && stageData && typeof stageData.niveau === 'number' && playerData.etage_actuel === stageData.niveau) {
          console.log('Stage completed! Unlocking next stage...');
          
          // Update player level
          try {
            const updateResponse = await fetch('/api/player/update', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                etage_actuel: stageData.niveau + 1
              }),
            });

            if (updateResponse.ok) {
              console.log('Player level updated successfully');
            } else {
              console.error('Error updating player level');
            }
          } catch (updateError) {
            console.error('Error updating player level:', updateError);
          }
        }
      } catch (error) {
        console.error('Error handling progression:', error);
      }
    };

    saveProgression();
  }, [gameState.isGameOver, gameState.score, playerData, stageData, progressionSaved]);

  // Écran de menu principal
  if (gameState.showMenu) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4 relative"
        style={{
          backgroundImage: 'url(/flappy.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <button
          onClick={onBack}
          className="absolute top-4 left-4 bg-black/30 hover:bg-black/40 text-cyan-100 px-4 py-2 rounded-lg transition-colors z-10 border border-cyan-500/30"
        >
          ← Back to menu
        </button>
        
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
          <h1 className="text-3xl font-bold text-amber-100 mb-6 drop-shadow-lg">🐦 Flappy Escape</h1>
          
          {loadingStage ? (
            <div className="bg-black/20 rounded-lg p-4 mb-6 border border-amber-700/20">
              <div className="text-amber-200 text-center">Loading game data...</div>
            </div>
          ) : (
            <>
              {stageData && (
                <div className="bg-black/20 rounded-lg p-4 mb-6 border border-amber-700/20">
                  <h2 className="text-lg font-semibold text-amber-200 mb-3">Description:</h2>
                  <div className="text-amber-100/80 text-sm leading-relaxed mb-4">
                    {stageData.description}
                  </div>
                  <h2 className="text-lg font-semibold text-amber-200 mb-3">Game Rules:</h2>
                  <div className="text-amber-100/80 text-sm leading-relaxed space-y-2">
                    {stageData.regles.split('\n').map((rule, index) => (
                      <p key={index}>{rule}</p>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <button
            onClick={startGame}
            disabled={loadingStage}
            className="w-full bg-gradient-to-r from-amber-600/80 to-yellow-600/80 text-white py-3 px-6 rounded-lg 
                    font-semibold hover:from-amber-700/90 hover:to-yellow-700/90 transition-all duration-300 
                    transform hover:scale-105 shadow-lg border border-amber-500/30 relative z-20 cursor-pointer
                    disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingStage ? 'Loading...' : 'Start the adventure'}
          </button>
        </div>
      </div>
    );
  }
  
  // Écran de résultats
  if (gameState.showScoreScreen && gameState.isGameOver) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4 relative"
        style={{
          backgroundImage: 'url(/flappy.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <button
          onClick={onBack}
          className="absolute top-4 left-4 bg-black/30 hover:bg-black/40 text-cyan-100 px-4 py-2 rounded-lg transition-colors z-10 border border-cyan-500/30"
        >
          ← Back to menu
        </button>

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
            Game Over!
          </h1>
          
          <div className="mb-6 space-y-4">
            <div className="text-amber-100">
              <p className="text-xl">Final Score:</p>
              <p className="text-4xl font-bold text-yellow-300">{gameState.score}</p>
            </div>
            
            <div className="text-amber-100">
              <p className="text-lg">Flight time: <span className="font-bold text-green-300">{Math.floor(gameState.time / 60)}s</span></p>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={startActualGame}
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
  
  // Écran de jeu
  return (
    <div 
      className="flex flex-col items-center justify-center min-h-screen p-2 sm:p-4 overflow-hidden relative"
      style={{
        backgroundImage: 'url(/flappy.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Overlay de fond sombre */}
      <div className="absolute inset-0 bg-black/40"></div>
      
      {/* Background particles disabled */}
      
      {/* Header */}
      <div className="mb-6 text-center relative z-10">
        <button
          onClick={onBack}
          className="mb-4 px-4 py-2 bg-black/30 hover:bg-black/40 text-cyan-100 rounded-lg transition-colors border border-cyan-500/30"
        >
          ← Back to menu
        </button>
        <h1 className="text-4xl font-bold text-cyan-100 mb-2 drop-shadow-lg">🐦 Flappy Escape</h1>
        <div className="flex gap-4 justify-center items-center text-cyan-100 bg-black/30 backdrop-blur-sm rounded-lg p-3 border border-cyan-500/20">
          <div className="font-semibold">Score: <span className="font-bold text-yellow-300">{gameState.score}</span></div>
          <div className="font-semibold">Time: <span className="font-bold text-green-300">{Math.floor(gameState.time / 60)}s</span></div>
          <div className="flex items-center gap-1">
            <span className="font-semibold text-red-300">❤️</span>
            <span className="font-bold text-red-300">{gameState.hearts}</span>
          </div>
        </div>
      </div>

      {/* Game Area */}
      <div 
        ref={gameAreaRef}
        className="relative bg-black/30 backdrop-blur-sm border-2 border-cyan-500/30 rounded-lg overflow-hidden shadow-lg shadow-cyan-500/20 cursor-pointer"
        style={{ 
          width: GAME_CONFIG.GAME_WIDTH, 
          height: GAME_CONFIG.GAME_HEIGHT,
          touchAction: 'none', // Prevent default touch behaviors
          userSelect: 'none' // Prevent text selection
        }}
        onClick={handleGameAreaInteraction}
        onTouchStart={handleGameAreaInteraction}
        onTouchEnd={(e) => e.preventDefault()}
      >
        {/* Nuages d'arrière-plan */}
        {gameState.clouds.map(cloud => (
          <CloudComponent key={cloud.id} cloud={cloud} />
        ))}
        
        {/* Game area background particles disabled */}
        
        {/* Bird with animation - sans cercle de fond */}
        <div
          className="absolute"
          style={{
            left: GAME_CONFIG.GAME_WIDTH / 2 - GAME_CONFIG.BIRD_SIZE / 2,
            top: gameState.birdY,
            width: GAME_CONFIG.BIRD_SIZE,
            height: GAME_CONFIG.BIRD_SIZE,
          }}
        >
          <AnimatedBird rotation={gameState.birdVelocity * 3} />
        </div>

        {/* Bonuses */}
        {gameState.bonuses.map(bonus => (
          !bonus.collected && (
            <div
              key={bonus.id}
              className="absolute flex items-center justify-center animate-bounce"
              style={{
                left: bonus.x,
                top: bonus.y,
                width: GAME_CONFIG.BONUS_SIZE,
                height: GAME_CONFIG.BONUS_SIZE,
              }}
            >
              {bonus.type === 'points' ? (
                <span className="text-yellow-400 text-lg drop-shadow-lg">💎</span>
              ) : (
                <span className="text-red-400 text-lg drop-shadow-lg">❤️</span>
              )}
            </div>
          )
        ))}

        {/* Obstacles améliorés */}
        {gameState.obstacles.map(obstacle => (
          <div key={obstacle.id}>
            {/* Top obstacle */}
            <div
              className="absolute bg-gradient-to-b from-cyan-400/90 to-cyan-600/90 border-2 border-cyan-300/70 shadow-lg shadow-cyan-500/30"
              style={{
                left: obstacle.x,
                top: 0,
                width: GAME_CONFIG.OBSTACLE_WIDTH,
                height: obstacle.topHeight,
                background: 'linear-gradient(to bottom, rgba(34, 197, 244, 0.9), rgba(8, 145, 178, 0.9))',
                boxShadow: 'inset 0 2px 4px rgba(255, 255, 255, 0.3), 0 4px 8px rgba(6, 182, 212, 0.3)',
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            </div>
            {/* Bottom obstacle */}
            <div
              className="absolute bg-gradient-to-t from-cyan-400/90 to-cyan-600/90 border-2 border-cyan-300/70 shadow-lg shadow-cyan-500/30"
              style={{
                left: obstacle.x,
                top: GAME_CONFIG.GAME_HEIGHT - obstacle.bottomHeight - GAME_CONFIG.GROUND_HEIGHT,
                width: GAME_CONFIG.OBSTACLE_WIDTH,
                height: obstacle.bottomHeight,
                background: 'linear-gradient(to top, rgba(34, 197, 244, 0.9), rgba(8, 145, 178, 0.9))',
                boxShadow: 'inset 0 -2px 4px rgba(255, 255, 255, 0.3), 0 4px 8px rgba(6, 182, 212, 0.3)',
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            </div>
          </div>
        ))}

        {/* Ground */}
        <div
          className="absolute bg-gradient-to-t from-cyan-700/60 to-cyan-600/40 border-t-2 border-cyan-400/50"
          style={{
            left: 0,
            top: GAME_CONFIG.GAME_HEIGHT - GAME_CONFIG.GROUND_HEIGHT,
            width: '100%',
            height: GAME_CONFIG.GROUND_HEIGHT,
          }}
        />
        
        {/* Animations de perte de cœur */}
        {heartLossAnimations.map((anim) => (
          <div
            key={anim.id}
            className="absolute pointer-events-none font-bold text-red-500 drop-shadow-md"
            style={{
              left: anim.x,
              top: anim.y,
              transform: `translate(-50%, -50%) scale(${anim.scale})`,
              opacity: anim.opacity,
              textShadow: '0 0 5px rgba(255,255,255,0.5)',
              zIndex: 50,
              fontSize: '20px',
              transition: 'all 0.1s ease-out',
            }}
          >
            -1 ❤️
          </div>
        ))}

        {/* Pause info screen pendant le jeu */}
        {!gameState.isPlaying && !gameState.isGameOver && !gameState.showMenu && !gameState.showScoreScreen && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-black/40 backdrop-blur-sm rounded-lg p-8 text-center border border-cyan-500/30 max-w-xs w-full">
              <h2 className="text-3xl font-bold text-cyan-100 mb-4 drop-shadow-lg">Paused</h2>
              <div className="bg-black/20 rounded-lg p-4 mb-6 border border-cyan-700/20">
                <p className="text-cyan-100/80 text-sm">Press <span className="text-yellow-300 font-bold">SPACE</span> or <span className="text-yellow-300 font-bold">TAP</span></p>
                <p className="text-cyan-100/80 text-sm mt-2">Collect 💎 and ❤️ on your way!</p>
              </div>
              <button
                onClick={startGame}
                className="w-full bg-gradient-to-r from-cyan-600/80 to-blue-600/80 text-white py-3 px-6 rounded-lg 
                        font-semibold hover:from-cyan-700/90 hover:to-blue-700/90 transition-all duration-300 
                        transform hover:scale-105 shadow-lg border border-cyan-500/30"
              >
                Continue
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Countdown Screen */}
      {gameState.showCountdown && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <div className="text-8xl font-bold text-cyan-100 mb-4 animate-pulse">
              {gameState.countdown > 0 ? gameState.countdown : 'GO!'}
            </div>
            <div className="text-2xl text-cyan-200">Get ready!</div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-4 text-center text-cyan-100/70 bg-black/20 backdrop-blur-sm rounded-lg p-2 border border-cyan-500/20 relative z-10">
        <p className="text-sm sm:text-base">Press <span className="text-yellow-300 font-bold">SPACE</span> or <span className="text-yellow-300 font-bold">TAP</span> to make your bird fly!</p>
      </div>
    </div>
  );
};