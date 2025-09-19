import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Stage } from '../../../shared/types/stage';

// ===================================================================================
// 1. LOGIQUE DU JEU (CUSTOM HOOK)
// ===================================================================================
const useGameLogic = () => {
  const [gameState, setGameState] = useState('menu');
  const [lives, setLives] = useState(10); // Augmentation à 10 vies (5 coeurs pleins)
  const [wordsFound, setWordsFound] = useState<string[]>([]);
  const [collectedLetters, setCollectedLetters] = useState<Record<string, number>>({});
  const [score, setScore] = useState(0);
  const [showMessage, setShowMessage] = useState<{ text: string; type: string }>({ text: '', type: '' });
  const [celebratingWord, setCelebratingWord] = useState<string | null>(null);
  // Liste de 100 mots variés pour le jeu
  const allWords = [
    'REACT', 'FLUID', 'STYLE', 'GAME', 'PLAY', 'WORD', 'LETTER', 'SCORE', 'LEVEL', 'CHALLENGE',
    'SPEED', 'QUICK', 'FAST', 'SLOW', 'JUMP', 'RUN', 'WALK', 'FLY', 'SWIM', 'DIVE',
    'MUSIC', 'SOUND', 'BEAT', 'RHYTHM', 'DANCE', 'SING', 'LAUGH', 'SMILE', 'HAPPY', 'JOY',
    'LIGHT', 'DARK', 'BRIGHT', 'SHINE', 'GLOW', 'SPARK', 'FLAME', 'FIRE', 'HEAT', 'WARM',
    'COLD', 'ICE', 'SNOW', 'RAIN', 'STORM', 'WIND', 'CLOUD', 'SKY', 'SUN', 'MOON',
    'STAR', 'PLANET', 'SPACE', 'EARTH', 'WATER', 'OCEAN', 'RIVER', 'LAKE', 'MOUNTAIN', 'FOREST',
    'TREE', 'FLOWER', 'GRASS', 'LEAF', 'BIRD', 'FISH', 'CAT', 'DOG', 'HORSE', 'LION',
    'TIGER', 'BEAR', 'WOLF', 'EAGLE', 'SHARK', 'WHALE', 'DOLPHIN', 'BUTTERFLY', 'BEE', 'SPIDER',
    'HOUSE', 'HOME', 'ROOM', 'DOOR', 'WINDOW', 'TABLE', 'CHAIR', 'BED', 'BOOK', 'PEN',
    'PAPER', 'PHONE', 'COMPUTER', 'SCREEN', 'KEYBOARD', 'MOUSE', 'CAMERA', 'PHOTO', 'VIDEO', 'MOVIE'
  ];

  const [targetWords, setTargetWords] = useState<string[]>([]);
  const [gameSpeed, setGameSpeed] = useState(1500);
  const [bestScore, setBestScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [comboMultiplier, setComboMultiplier] = useState(1);
  const [lastCollectTime, setLastCollectTime] = useState(0);
  const [gamePaused, setGamePaused] = useState(false);
  const [stageData, setStageData] = useState<Stage | null>(null);
  const [loadingStage, setLoadingStage] = useState(true);
  // SFX refs (hook scope)
  const clickSfxRef = useRef<HTMLAudioElement | null>(null);
  const loseHeartSfxRef = useRef<HTMLAudioElement | null>(null);
  const successSfxRef = useRef<HTMLAudioElement | null>(null);
  const loseGameSfxRef = useRef<HTMLAudioElement | null>(null);

  // Fonction pour sélectionner une liste aléatoire (100 mots)
  const selectRandomWords = useCallback(() => {
    const shuffled = [...allWords].sort(() => Math.random() - 0.5);
    return shuffled;
  }, [allWords]);

  const getCurrentTargetWord = useCallback(() => {
    return targetWords[wordsFound.length] || null;
  }, [targetWords, wordsFound.length]);

  // Load stage data from database
  const loadStageData = useCallback(async () => {
    try {
      setLoadingStage(true);
      const response = await fetch('/api/stages');
      const result = await response.json();
      
      if (result.status === 'success') {
        // Find the "Falling Letters" stage
        const fallingLettersStage = result.data.find((stage: Stage) => 
          stage.nom.toLowerCase().includes('falling letters') || 
          stage.nom.toLowerCase().includes('falling')
        );
        
        if (fallingLettersStage) {
          setStageData(fallingLettersStage);
        } else {
          console.warn('Falling Letters stage not found in database');
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

  const getRequiredLetters = useCallback(() => {
    const currentTarget = getCurrentTargetWord();
    if (!currentTarget) return {};
    const required: Record<string, number> = {};
    currentTarget.split('').forEach(letter => {
      required[letter] = (required[letter] || 0) + 1;
    });
    return required;
  }, [getCurrentTargetWord]);

  // Init SFX (once)
  useEffect(() => {
    if (!clickSfxRef.current) {
      clickSfxRef.current = new Audio('/click_reaction_dash.mp3');
      clickSfxRef.current.volume = 0.6;
    }
    if (!loseHeartSfxRef.current) {
      loseHeartSfxRef.current = new Audio('/Lose_heart.mp3');
      loseHeartSfxRef.current.volume = 0.8;
    }
    if (!successSfxRef.current) {
      successSfxRef.current = new Audio('/success.mp3');
      successSfxRef.current.volume = 0.9;
    }
    if (!loseGameSfxRef.current) {
      loseGameSfxRef.current = new Audio('/lose.mp3');
      loseGameSfxRef.current.volume = 0.9;
    }
  }, []);

  const safePlay = (audio: HTMLAudioElement | null) => {
    if (!audio) return;
    try { audio.currentTime = 0; audio.play().catch(() => {}); } catch (_) {}
  };

  const startNewGame = useCallback(() => {
    setGameState('playing');
    setLives(10);
    setWordsFound([]);
    setCollectedLetters({});
    setScore(0);
    setShowMessage({ text: '', type: '' });
    setGameSpeed(1500);
    setCelebratingWord(null);
    setCombo(0);
    setComboMultiplier(1);
    setLastCollectTime(0);
    setGamePaused(false);
    // Sélectionner 100 mots aléatoires
    setTargetWords(selectRandomWords());
  }, [selectRandomWords]);

  const handleWordCompletion = useCallback(() => {
    const currentTarget = getCurrentTargetWord();
    setCelebratingWord(currentTarget);
    setGamePaused(true); // Pause le jeu pendant la célébration

    setTimeout(() => {
      setWordsFound(prev => [...prev, currentTarget!]);
      setScore(prev => prev + 200);
      setShowMessage({ text: `"${currentTarget}" completed! +200pts`, type: 'success' });
      setCollectedLetters({});
      setCelebratingWord(null);
      setGamePaused(false); // Reprend le jeu
      setTimeout(() => setShowMessage({ text: '', type: '' }), 2500);
      setGameSpeed(prev => Math.max(600, prev - 250));
    }, 2000);
  }, [getCurrentTargetWord]);

  const calculatePoints = useCallback((letterY: number, gameHeight: number, isNeeded: boolean) => {
    // Plus la lettre est proche du bas, plus on gagne de points
    const distanceFromBottom = gameHeight - letterY;
    const proximityRatio = 1 - (distanceFromBottom / gameHeight);
    const basePoints = isNeeded ? 15 : 5;
    const proximityBonus = Math.floor(proximityRatio * 25); // Bonus jusqu'à 25 points
    return basePoints + proximityBonus;
  }, []);

  const updateCombo = useCallback(() => {
    const now = Date.now();
    const timeSinceLastCollect = now - lastCollectTime;
    
    if (timeSinceLastCollect < 1000) { // Moins d'1 seconde = combo
      setCombo(prev => prev + 1);
      if (combo >= 2) {
        setComboMultiplier(prev => Math.min(prev + 0.5, 3)); // Max 3x
      }
    } else {
      setCombo(0);
      setComboMultiplier(1);
    }
    setLastCollectTime(now);
  }, [combo, lastCollectTime]);

  const handleLetterCollected = useCallback((letter: string, letterType: string, letterY: number, gameHeight: number, randomPoints = 0) => {
    if (letterType === 'needed') {
      const required = getRequiredLetters();
      const currentCollected = collectedLetters[letter] || 0;
      
      if (currentCollected < (required[letter] || 0)) {
        const basePoints = calculatePoints(letterY, gameHeight, true);
        const finalPoints = Math.floor(basePoints * comboMultiplier);
        
        setCollectedLetters(prev => ({...prev, [letter]: currentCollected + 1}));
        setScore(prev => prev + finalPoints);
        updateCombo();
        // SFX correct
        safePlay(clickSfxRef.current);

        // Messages avec détails des points
        let message = `+${finalPoints}pts`;
        if (comboMultiplier > 1) {
          message += ` (x${comboMultiplier.toFixed(1)} combo!)`;
        }
        if (letterY > gameHeight * 0.7) {
          message += ` 🎯 Précision!`;
        }
        
        setShowMessage({ text: message, type: 'success' });
        setTimeout(() => setShowMessage({ text: '', type: '' }), 1500);

        const newCollected = { ...collectedLetters, [letter]: currentCollected + 1 };
        const isComplete = Object.entries(required).every(([reqLetter, reqCount]) => 
          (newCollected[reqLetter] || 0) >= (reqCount as number)
        );
        if (isComplete) {
            handleWordCompletion();
        }
        return true;
      } else {
        setShowMessage({ text: `Enough "${letter}"!`, type: 'info' });
        setTimeout(() => setShowMessage({ text: '', type: '' }), 1000);
        return false;
      }
    } else if (letterType === 'mystery') {
      // Gestion des points d'interrogation (mystery)
      if (randomPoints >= 0) {
        // C'est un bonus
        setScore(prev => prev + randomPoints);
        setShowMessage({ text: `Mystery revealed! +${randomPoints}pts`, type: 'success' });
        safePlay(successSfxRef.current);
        // Si c'est un bon bonus, on peut aussi mettre à jour le combo
        if (randomPoints > 20) {
          updateCombo();
        }
      } else {
        // C'est un malus
        setScore(prev => Math.max(0, prev + randomPoints)); // Pour ne pas descendre en dessous de 0
        setShowMessage({ text: `Hidden trap! ${randomPoints}pts`, type: 'error' });
        safePlay(loseHeartSfxRef.current);
        // Reset du combo sur un malus
        setCombo(0);
        setComboMultiplier(1);
      }
      setTimeout(() => setShowMessage({ text: '', type: '' }), 1500);
      return true;
    } else if (letterType === 'powerup') {
      // Gestion des power-ups
      setScore(prev => prev + 50);
      setShowMessage({ text: `Power-up! +50pts`, type: 'success' });
      safePlay(successSfxRef.current);
      setTimeout(() => setShowMessage({ text: '', type: '' }), 1500);
      return true;
    } else if (letterType === 'bad-violet') {
      // Lettres violettes -5 points
      setScore(prev => Math.max(0, prev - 5));
      setCombo(0);
      setComboMultiplier(1);
      setShowMessage({ text: `Purple letter! -5pts`, type: 'warning' });
      safePlay(loseHeartSfxRef.current);
      setTimeout(() => setShowMessage({ text: '', type: '' }), 1000);
      return false;
    } else if (letterType === 'bad-red') {
      // Lettres rouges -15 points
      setScore(prev => Math.max(0, prev - 15));
      setCombo(0);
      setComboMultiplier(1);
      setShowMessage({ text: `Red letter! -15pts`, type: 'error' });
      safePlay(loseHeartSfxRef.current);
      setTimeout(() => setShowMessage({ text: '', type: '' }), 1000);
      return false;
    } else {
      // Lettres grises normales
      const points = Math.floor(calculatePoints(letterY, gameHeight, false) * comboMultiplier);
      setScore(prev => Math.max(0, prev - points));
      setCombo(0);
      setComboMultiplier(1);
      setShowMessage({ text: `Wrong letter! -${points}pts`, type: 'error' });
      safePlay(loseHeartSfxRef.current);
      setTimeout(() => setShowMessage({ text: '', type: '' }), 1000);
      return false;
    }
  }, [collectedLetters, getRequiredLetters, handleWordCompletion, calculatePoints, comboMultiplier, updateCombo]);

  const handleLetterLost = useCallback(() => {
    setLives(currentLives => {
        const newLives = currentLives - 1;
        if (newLives <= 0) {
          setGameState('gameOver');
          return 0;
        }
        return newLives;
      });
      setShowMessage({ text: `Letter lost! -1 life`, type: 'error' });
    safePlay(loseHeartSfxRef.current);
      // Suppression de l'effet de clignotement/secousse (screenShake)
      setTimeout(() => setShowMessage({ text: '', type: '' }), 1500);
  }, []);

  // Play lose sound at end of game
  useEffect(() => {
    if (gameState === 'gameOver') {
      safePlay(loseGameSfxRef.current);
    }
  }, [gameState]);

  // Quand on atteint la fin de la liste des mots, en rajouter 100 de plus pour continuer à l'infini
  useEffect(() => {
    if (wordsFound.length > 0 && wordsFound.length === targetWords.length) {
      setTargetWords((prev) => [...prev, ...selectRandomWords()]);
      }
  }, [wordsFound.length, targetWords.length, selectRandomWords]);
  
  return {
    gameState, setGameState, lives, score, wordsFound, collectedLetters,
    showMessage, celebratingWord, targetWords, gameSpeed, bestScore,
    startNewGame, handleLetterCollected, handleLetterLost, getCurrentTargetWord, combo, comboMultiplier, gamePaused,
    stageData, loadingStage, loadStageData, setTargetWords, selectRandomWords
  };
}

// ===================================================================================
// 2. COMPOSANT PRINCIPAL DU JEU
// ===================================================================================
interface FallingLettersGameProps {
  onBack?: () => void;
}

const FallingLettersGame: React.FC<FallingLettersGameProps> = ({ onBack }) => {
  const {
    gameState, setGameState, lives, score, wordsFound, collectedLetters,
    showMessage, celebratingWord, targetWords, gameSpeed, bestScore,
    startNewGame, handleLetterCollected, handleLetterLost, getCurrentTargetWord, combo, comboMultiplier, gamePaused,
    stageData, loadingStage, loadStageData, setTargetWords, selectRandomWords
  } = useGameLogic();

  const gameAreaRef = useRef<HTMLDivElement>(null);
  const animationFrameId = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const spawnAccumulatorRef = useRef<number>(0);
  const lettersOnScreen = useRef<Map<number, any>>(new Map());
  const lastLaneRef = useRef<number | null>(null);
  const beatCounterRef = useRef<number>(0);
  const spawnCounterRef = useRef<number>(0);
  const [, setRenderTrigger] = useState(false);
  const clickSfxRef = useRef<HTMLAudioElement | null>(null);
  const loseHeartSfxRef = useRef<HTMLAudioElement | null>(null);
  const successSfxRef = useRef<HTMLAudioElement | null>(null);
  const loseGameSfxRef = useRef<HTMLAudioElement | null>(null);
  const playerRedditIdRef = useRef<string | null>(null);
  const submittedProgressRef = useRef<boolean>(false);
  const submittedUnlockRef = useRef<boolean>(false);
  const [unlockedNext, setUnlockedNext] = useState(false);

  // Dimensions dynamiques basées sur la taille de l'écran
  const getGameDimensions = useCallback(() => {
    const maxWidth = Math.min(600, window.innerWidth * 0.9);
    const maxHeight = Math.min(450, window.innerHeight * 0.6);
    return {
      width: maxWidth,
      height: maxHeight,
      letterSize: Math.max(30, Math.min(40, maxWidth / 15))
    };
  }, []);

  const [gameDimensions, setGameDimensions] = useState(getGameDimensions());
  const availableLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  // Mettre à jour les dimensions lors du redimensionnement
  useEffect(() => {
    const handleResize = () => {
      setGameDimensions(getGameDimensions());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getGameDimensions]);

  const createFallingLetter = useCallback(() => {
    const currentTarget = getCurrentTargetWord();
    if (!currentTarget) return;

    const required: Record<string, number> = {};
    currentTarget.split('').forEach(l => required[l] = (required[l] || 0) + 1);
    const needed = Object.keys(required).filter(l => (collectedLetters[l] || 0) < (required[l] || 0));
    
    let letterChar: string = 'A';
    let letterType = 'normal';
    // Variable pour les points aléatoires du point d'interrogation
    let randomPoints = 0;
    // Équilibrage par pattern (tous les 4 spawns: needed, normal, normal, special)
    const spawnIndex = spawnCounterRef.current++ % 4;
    if (spawnIndex === 0 && needed.length > 0) {
      letterChar = needed[Math.floor(Math.random() * needed.length)]!;
      letterType = 'needed';
    } else if (spawnIndex === 3) {
      // 50/50 mystery vs powerup
      if (Math.random() < 0.5) {
        letterChar = '?';
        letterType = 'mystery';
        randomPoints = Math.floor(Math.random() * 151) - 50; // -50..+100
      } else {
      letterChar = '⭐';
      letterType = 'powerup';
    }
    } else {
      // Choisir une lettre normale qui n'est PAS encore requise, pour éviter les malus injustes sur clic
      let attemptsPick = 0;
      do {
        letterChar = availableLetters.charAt(Math.floor(Math.random() * availableLetters.length));
        attemptsPick++;
        if (!needed.includes(letterChar)) break;
      } while (attemptsPick < 10);
      letterType = 'normal';
    }
    
    const id = Date.now() + Math.random();
    // Placement harmonisé: répartir en colonnes (lanes) et éviter le spam dans la même lane
    const lanesCount = Math.max(5, Math.floor(gameDimensions.width / (gameDimensions.letterSize * 1.5)));
    const laneWidth = (gameDimensions.width - gameDimensions.letterSize);
    const laneStep = lanesCount > 1 ? laneWidth / (lanesCount - 1) : 0;
    // Construire la liste des lanes disponibles (pas déjà occupées trop près du haut)
    const occupiedLaneSet = new Set<number>();
      lettersOnScreen.current.forEach(existingLetter => {
      const laneIndex = Math.round(existingLetter.x / (laneStep || 1));
      if (existingLetter.y < gameDimensions.letterSize * 2) {
        occupiedLaneSet.add(laneIndex);
      }
    });
    // Choisir une lane différente de la dernière utilisée si possible
    const candidateLanes: number[] = [];
    for (let i = 0; i < lanesCount; i++) {
      if (!occupiedLaneSet.has(i)) candidateLanes.push(i);
    }
    let chosenLane: number = 0;
    if (candidateLanes.length === 0) {
      // Toutes occupées proche du haut: utiliser une lane suivante par défaut
      const lastLaneSafe = lastLaneRef.current ?? 0;
      chosenLane = (lastLaneSafe + 1) % lanesCount;
    } else {
      // Éviter la même lane consécutive si possible
      const filtered = candidateLanes.filter(l => l !== lastLaneRef.current);
      if (filtered.length > 0) {
        chosenLane = filtered[Math.floor(Math.random() * filtered.length)]!;
      } else {
        chosenLane = candidateLanes[Math.floor(Math.random() * candidateLanes.length)]!;
      }
    }
    lastLaneRef.current = chosenLane;
    const newX = Math.max(0, Math.min(gameDimensions.width - gameDimensions.letterSize, chosenLane * laneStep));
    
    lettersOnScreen.current.set(id, {
        id, 
        letter: letterChar, 
        x: newX,
        y: -gameDimensions.letterSize, 
        speed: 80 + Math.random() * 40, 
        letterType, 
        element: null,
        // Ajouter les points aléatoires pour le type mystère
        randomPoints: letterType === 'mystery' ? randomPoints : 0
    });
  }, [getCurrentTargetWord, collectedLetters, gameDimensions]);

  useEffect(() => {
    if (gameState !== 'playing') {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      lettersOnScreen.current.clear();
      return;
    }

    const animate = (timestamp: number) => {
        if (!lastTimeRef.current) lastTimeRef.current = timestamp;
        let deltaMs = (timestamp - lastTimeRef.current);
        lastTimeRef.current = timestamp;
        // Clamp pour lisser les gros sauts (onglet inactif)
        deltaMs = Math.min(deltaMs, 50);
        const deltaTime = deltaMs / 1000;

        let shouldRerender = false;
        
        // Ne fait bouger les lettres que si le jeu n'est pas en pause
        if (!gamePaused) {
          // Gestion du rythme de spawn dans la même boucle rAF (plus fluide)
          const beatMs = Math.max(350, gameSpeed);
          spawnAccumulatorRef.current += deltaMs;
          while (spawnAccumulatorRef.current >= beatMs && lettersOnScreen.current.size < 8) {
            beatCounterRef.current = (beatCounterRef.current + 1) % 8;
            const spawnsThisBeat = beatCounterRef.current % 4 === 0 ? 2 : 1;
            for (let i = 0; i < spawnsThisBeat; i++) {
              if (lettersOnScreen.current.size >= 8) break;
              createFallingLetter();
              shouldRerender = true;
            }
            spawnAccumulatorRef.current -= beatMs;
          }

          lettersOnScreen.current.forEach((letter) => {
              letter.y += letter.speed * deltaTime;
              if (letter.element) {
                  letter.element.style.transform = `translate3d(0, ${letter.y}px, 0)`;
              }
              if (letter.y > gameDimensions.height) {
                  // Ne pénaliser que si la lettre est ENCORE requise maintenant
                  let stillNeeded = false;
                  const currentTargetNow = getCurrentTargetWord();
                  if (currentTargetNow) {
                    const reqNow: Record<string, number> = {};
                    currentTargetNow.split('').forEach(l => reqNow[l] = (reqNow[l] || 0) + 1);
                    const alreadyNow = (collectedLetters[letter.letter] || 0);
                    if ((reqNow[letter.letter] || 0) > alreadyNow) {
                      stillNeeded = true;
                    }
                  }
                  if (stillNeeded) {
                      handleLetterLost();
                  }
                  lettersOnScreen.current.delete(letter.id);
                  shouldRerender = true;
              }
          });
        }
        
        if (shouldRerender) {
            setRenderTrigger(val => !val);
        }

        animationFrameId.current = requestAnimationFrame(animate);
    };

    animationFrameId.current = requestAnimationFrame(animate);

    return () => {
        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        lastTimeRef.current = 0;
    };
  }, [gameState, handleLetterLost, gamePaused, gameDimensions.height]);

  useEffect(() => {
    // Le spawn est désormais géré dans requestAnimationFrame via spawnAccumulatorRef
    spawnAccumulatorRef.current = 0;
  }, [gameState, gameSpeed, celebratingWord, gamePaused]);

  const collectLetter = useCallback((id: number) => {
    const letter = lettersOnScreen.current.get(id);
    if (!letter || celebratingWord || gamePaused) return;

    // Reclasser dynamiquement comme "needed" si cette lettre est encore requise pour le mot courant
    const currentTarget = getCurrentTargetWord();
    let effectiveType = letter.letterType;
    if (currentTarget) {
      const required: Record<string, number> = {};
      currentTarget.split('').forEach(l => required[l] = (required[l] || 0) + 1);
      const already = collectedLetters[letter.letter] || 0;
      if ((required[letter.letter] || 0) > already) {
        effectiveType = 'needed';
      }
    }

    const success = handleLetterCollected(
      letter.letter, 
      effectiveType,
      letter.y, 
      gameDimensions.height, 
      letter.randomPoints
    );
    
    if (letter.element && (success || letter.letterType === 'powerup' || letter.letterType === 'mystery')) {
      letter.element.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
      letter.element.style.transform = 'scale(0)';
      letter.element.style.opacity = '0';
      setTimeout(() => {
        lettersOnScreen.current.delete(id);
        setRenderTrigger(val => !val);
      }, 300);
    } else {
        lettersOnScreen.current.delete(id);
        setRenderTrigger(val => !val);
    }
  }, [handleLetterCollected, celebratingWord, gamePaused, gameDimensions.height]);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (gameState !== 'playing' || celebratingWord || gamePaused) return;
      const keyLetter = event.key.toUpperCase();
      if (keyLetter.length === 1 && keyLetter >= 'A' && keyLetter <= 'Z') {
        let foundLetterId: number | null = null;
        let lowestY = -1;
        lettersOnScreen.current.forEach(letter => {
            if (letter.letter === keyLetter && letter.letterType === 'needed' && letter.y > lowestY) {
                lowestY = letter.y;
                foundLetterId = letter.id;
            }
        });
        if (foundLetterId) {
            collectLetter(foundLetterId);
        }
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameState, collectLetter, celebratingWord, gamePaused]);

  // Load stage data on component mount
  useEffect(() => {
    loadStageData();
  }, [loadStageData]);

  // Initialize random words on component mount
  useEffect(() => {
    if (targetWords.length === 0) {
      setTargetWords(selectRandomWords());
    }
  }, [targetWords.length, selectRandomWords]);

  // Init SFX
  useEffect(() => {
    if (!clickSfxRef.current) {
      clickSfxRef.current = new Audio('/click_reaction_dash.mp3');
      clickSfxRef.current.volume = 0.6;
    }
    if (!loseHeartSfxRef.current) {
      loseHeartSfxRef.current = new Audio('/Lose_heart.mp3');
      loseHeartSfxRef.current.volume = 0.8;
    }
    if (!successSfxRef.current) {
      successSfxRef.current = new Audio('/success.mp3');
      successSfxRef.current.volume = 0.9;
    }
    if (!loseGameSfxRef.current) {
      loseGameSfxRef.current = new Audio('/lose.mp3');
      loseGameSfxRef.current.volume = 0.9;
    }
  }, []);

  const safePlay = (audio: HTMLAudioElement | null) => {
    if (!audio) return;
    try { audio.currentTime = 0; audio.play().catch(() => {}); } catch (_) {}
  };

  // Fetch current player reddit id
  useEffect(() => {
    const fetchPlayer = async () => {
      try {
        const res = await fetch('/api/player/init');
        const data = await res.json();
        if (data && data.status === 'success' && data.data?.reddit_id) {
          playerRedditIdRef.current = data.data.reddit_id as string;
        }
      } catch (_) {
        // ignore
      }
    };
    fetchPlayer();
  }, []);

  // Submit progression on game over (once): create if not exists, else update only if score improved
  useEffect(() => {
    const submitProgression = async () => {
      if (submittedProgressRef.current) return;
      if (!stageData || !playerRedditIdRef.current) return;
      submittedProgressRef.current = true;

      const joueur_id = playerRedditIdRef.current;
      const etage_id = stageData.id;

      try {
        // 1) Try to fetch existing progression
        const getRes = await fetch(`/api/progression?joueur_id=${encodeURIComponent(joueur_id)}&etage_id=${encodeURIComponent(String(etage_id))}`);
        if (getRes.ok) {
          const getJson = await getRes.json();
          const existing = getJson?.data;
          const existingScore = typeof existing?.score === 'number' ? existing.score : 0;
          if (score > existingScore) {
            // 2) Update only if improved
            await fetch('/api/progression/update', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ joueur_id, etage_id, score, completed: true }),
            }).catch(() => void 0);
          }
        } else if (getRes.status === 404) {
          // 3) Create if not found
          await fetch('/api/progression/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ joueur_id, etage_id, score, completed: true }),
          }).catch(() => void 0);
        }
      } catch (_) {
        // ignore network errors
      }
    };

    if (gameState === 'gameOver') {
      submitProgression();
    } else {
      submittedProgressRef.current = false; // reset for next run
    }
  }, [gameState, stageData, score]);

  // Unlock next stage if target score reached
  useEffect(() => {
    const unlockIfQualified = async () => {
      if (submittedUnlockRef.current) return;
      if (!stageData || !playerRedditIdRef.current) return;
      if (gameState !== 'gameOver') return;
      if (typeof stageData.target_score !== 'number') return;
      if (score < stageData.target_score) return;

      submittedUnlockRef.current = true;
      const nextStageLevel = (stageData.niveau ?? 0) + 1;
      try {
        const res = await fetch(`/api/player/${encodeURIComponent(playerRedditIdRef.current)}/update-stage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage: nextStageLevel }),
        });
        if (res.ok) {
          setUnlockedNext(true);
        }
      } catch (_) {
        // ignore network errors
      }
    };

    if (gameState === 'gameOver') {
      unlockIfQualified();
    } else {
      submittedUnlockRef.current = false;
      setUnlockedNext(false);
    }
  }, [gameState, stageData, score]);

  const currentWord = getCurrentTargetWord();

  if (gameState === 'menu') {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4 relative"
        style={{
          backgroundImage: 'url(/letter.png)',
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
            ← Back to menu
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
          <h1 className="text-3xl font-bold text-amber-100 mb-2 drop-shadow-lg">Falling Letters</h1>
          <p className="text-sm text-amber-200/80 mb-6">🎲 Random words from 100+ options!</p>
          
          <div className="bg-black/20 rounded-lg p-4 mb-6 border border-amber-700/20">
            <h2 className="text-lg font-semibold text-amber-200 mb-3">Challenge Rules:</h2>
            {loadingStage ? (
              <div className="text-amber-100/80 text-sm text-center">
                Loading rules...
              </div>
            ) : stageData ? (
            <div className="text-amber-100/80 text-sm leading-relaxed space-y-2">
                <p className="font-semibold text-amber-200 mb-2">{stageData.description}</p>
                <div className="text-xs space-y-1">
                  {stageData.regles.split('\n').map((rule, index) => (
                    <p key={index}>• {rule}</p>
                  ))}
            </div>
              </div>
            ) : (
              <div className="text-amber-100/80 text-sm leading-relaxed space-y-2">
                <p>• <span className="text-blue-300">Blue letters</span>: Collect to form target words</p>
                <p>• <span className="text-yellow-300">⭐ Golden</span>: Power-ups that give +50 points</p>
                <p>• <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-1 rounded">?</span> <span className="text-purple-300">Question marks</span>: Mystery! Random bonus or penalty</p>
                <p>• <span className="text-purple-300">Purple letters</span>: Watch out! -5 points</p>
                <p>• <span className="text-red-300">Red letters</span>: Danger! -15 points</p>
                <p>• The closer you collect to the bottom, the more points you get!</p>
                <p>• Chain collections for multiplier combos</p>
              </div>
            )}
          </div>

          {bestScore > 0 && (
            <div className="mb-6 text-amber-100/90">
              <p className="text-lg">Record: <span className="font-bold text-yellow-300">{bestScore}</span></p>
            </div>
          )}

          <button
            onClick={startNewGame}
            className="w-full bg-gradient-to-r from-amber-600/80 to-yellow-600/80 text-white py-3 px-6 rounded-lg 
                    font-semibold hover:from-amber-700/90 hover:to-yellow-700/90 transition-all duration-300 
                    transform hover:scale-105 shadow-lg border border-amber-500/30 relative z-20 cursor-pointer"
          >
            Start Challenge
          </button>
        </div>
      </div>
    );
  }

  if (gameState === 'gameOver' || gameState === 'victory') {
    const isVictory = gameState === 'victory';
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4 relative"
        style={{
          backgroundImage: 'url(/letter.png)',
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
            ← Back to menu
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
            {isVictory ? 'Victory! 🎉' : 'Challenge Over'}
          </h1>
          
          <div className="mb-6 space-y-4">
            <div className="text-amber-100">
              <p className="text-xl">Final Score:</p>
              <p className="text-4xl font-bold text-yellow-300">{score}</p>
            </div>
            
            <div className="text-amber-100">
              <p className="text-lg">Words completed: <span className="font-bold text-green-300">{wordsFound.join(', ') || 'None'}</span></p>
            </div>

            {(score === bestScore && score > 0) && (
              <div className="text-yellow-300 text-lg font-bold animate-pulse">
                🏆 New Record! 🏆
              </div>
            )}
            {unlockedNext && (
              <div className="text-green-300 text-lg font-bold animate-pulse">
                🔓 Next stage unlocked!
              </div>
            )}
          </div>

          <div className="space-y-3">
            <button
              onClick={startNewGame}
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
    );
  }
  
  // Écran de jeu
  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-4 relative"
      style={{
        backgroundImage: 'url(/letter.png)',
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
        {/* HUD */}
        <div className="flex justify-between items-center mb-4 bg-black/30 backdrop-blur-sm rounded-lg p-4 border border-amber-500/20 flex-wrap gap-2">
          <div className="text-amber-100">
            <span className="text-lg font-semibold">Lives: </span>
            <span className="text-xl font-bold">
              ❤️ × {lives}
            </span>
          </div>
          <div className="text-amber-100">
            <span className="text-lg font-semibold">Score: </span>
            <span className="text-2xl font-bold text-yellow-300">{score}</span>
            {combo > 0 && (
              <div className="text-sm text-orange-300">
                Combo: {combo} (x{comboMultiplier.toFixed(1)})
              </div>
            )}
          </div>
          <div className="text-amber-100">
            <span className="text-lg font-semibold">Progress: </span>
            <span className="text-xl font-bold text-green-300">{wordsFound.length} / {targetWords.length}</span>
          </div>
        </div>

        

        {/* Target word */}
        <div className="flex justify-center gap-2 mb-4">
          {currentWord && currentWord.split('').map((letter, index) => {
              const myInstance = currentWord.slice(0, index + 1).split('').filter(l => l === letter).length;
              const isThisInstanceCollected = (collectedLetters[letter] || 0) >= myInstance;
              return (
                <div 
                  key={index} 
                  className={`w-12 h-12 flex items-center justify-center text-2xl font-bold rounded-lg border-2 transition-all duration-300 ${
                    isThisInstanceCollected 
                      ? 'bg-green-500 border-green-400 text-white shadow-lg shadow-green-500/50' 
                      : 'bg-black/20 border-amber-500/30 text-amber-200'
                  }`}
                >
                  {letter}
                </div>
              );
          })}
        </div>
        
        {/* Game area */}
        <div 
          ref={gameAreaRef} 
          className="relative bg-black/30 backdrop-blur-sm border-2 border-amber-500/30 rounded-lg overflow-hidden mx-auto"
          style={{ width: gameDimensions.width, height: gameDimensions.height }}
        >
          {Array.from(lettersOnScreen.current.values()).map((letter) => {
            let letterClass = '';
            switch(letter.letterType) {
              case 'powerup':
                letterClass = 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-2 border-yellow-300 animate-pulse';
                break;
              case 'mystery':
                letterClass = 'bg-gradient-to-r from-purple-500 to-pink-500 text-white border-2 border-purple-300 animate-pulse';
                break;
              case 'needed':
              case 'bad-violet':
              case 'bad-red':
              case 'normal':
              default:
                // Toutes les lettres ont maintenant la même apparence bleue
                letterClass = 'bg-blue-500 text-white border-2 border-blue-300';
            }
            
            return (
              <div
                key={letter.id}
                ref={el => {
                    const l = lettersOnScreen.current.get(letter.id);
                    if (l) l.element = el;
                }}
                className={`absolute flex items-center justify-center font-bold rounded-full cursor-pointer user-select-none shadow-lg transition-all duration-200 hover:scale-110 ${letterClass}`}
                style={{ 
                  left: letter.x, 
                  top: 0, 
                  width: gameDimensions.letterSize, 
                  height: gameDimensions.letterSize,
                  fontSize: `${gameDimensions.letterSize * 0.6}px`,
                  willChange: 'transform'
                }}
                onClick={() => collectLetter(letter.id)}
              >
                {letter.letter}
              </div>
            );
          })}

          {/* Celebration animation */}
          {celebratingWord && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-10">
              <div className="flex gap-2">
                {celebratingWord.split('').map((char, index) => (
                  <div
                    key={index}
                    className="text-6xl font-bold text-yellow-300 animate-bounce"
                    style={{ 
                      animationDelay: `${index * 0.1}s`,
                      textShadow: '0 0 20px #ffc107, 0 0 40px #ffc107'
                    }}
                  >
                    {char}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Messages */}
        {showMessage.text && (
          <div className={`fixed bottom-8 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg font-bold text-center z-20 ${
            showMessage.type === 'success' ? 'bg-green-500 text-white' :
            showMessage.type === 'error' ? 'bg-red-500 text-white' :
            showMessage.type === 'warning' ? 'bg-purple-500 text-white' :
            'bg-blue-500 text-white'
          }`}>
            {showMessage.text}
          </div>
        )}
      </div>
    </div>
  );
};

export default FallingLettersGame;
