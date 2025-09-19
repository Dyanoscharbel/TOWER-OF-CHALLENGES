import React, { useRef, useEffect, useState, useCallback } from 'react';

// Ajouter des styles pour les animations
const styles = `
  @keyframes floatUp {
    0% { transform: translate(-50%, 0); opacity: 1; filter: blur(0px); }
    50% { transform: translate(-50%, -30px); opacity: 0.8; filter: blur(1px); }
    100% { transform: translate(-50%, -60px); opacity: 0; filter: blur(3px); }
  }
  
  @keyframes heartbeat {
    0% { transform: scale(1); }
    25% { transform: scale(1.3); }
    50% { transform: scale(1); }
    75% { transform: scale(1.3); }
    100% { transform: scale(1); }
  }
  
  @keyframes fadeOut {
    0% { opacity: 1; }
    70% { opacity: 0.9; }
    100% { opacity: 0; }
  }

  @keyframes wave-announce {
    0% { transform: scale(0.5); opacity: 0; }
    50% { transform: scale(1.2); opacity: 1; }
    80% { transform: scale(1); opacity: 1; }
    100% { transform: scale(1); opacity: 0; }
  }
`;

interface SpaceBulletStormProps {
  onBack?: () => void;
}

// Interfaces pour les classes
interface BulletProps {
  x: number;
  y: number;
  dx: number;
  dy: number;
  color: string;
  size: number;
}

interface EnemyProps {
  x: number;
  y: number;
  type: string;
  width: number;
  height: number;
  speed: number;
  shootCooldown: number;
  health: number;
  dodgeDirection: number;
  dodgeCooldown: number;
}

interface BossProps {
  x: number;
  y: number;
  width: number;
  height: number;
  maxHealth: number;
  health: number;
  speed: number;
  direction: number;
  shootCooldown: number;
  specialAttackCooldown: number;
}

interface BonusProps {
  x: number;
  y: number;
  type: string;
  width: number;
  height: number;
  speed: number;
  rotation: number;
}

interface ParticleProps {
  x: number;
  y: number;
  dx: number;
  dy: number;
  life: number;
  maxLife: number;
  color: string;
}

// Interfaces pour les objets de jeu et l'état
interface PlayerProps {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  shootCooldown: number;
}

interface GameObjectsProps {
  player: PlayerProps;
  playerBullets: any[]; // Temporairement any[] pour éviter les erreurs de référence circulaire
  enemies: any[];
  enemyBullets: any[];
  bonuses: any[];
  particles: any[];
  boss: any | null;
  isWaveProgressing?: boolean; // Flag pour suivre la progression des vagues
  lastEnemyCount?: number; // Pour le debug
  waveEnemyQueue?: any[]; // File d'attente des ennemis à faire apparaître
  spawnTimer?: number; // Timer pour le spawn des ennemis
  initialEnemyCount?: number; // Nombre initial d'ennemis pour calculer le 3/4
  tanksSpawned?: boolean; // Flag pour savoir si les tanks ont été générés
  tanksToSpawn?: any[]; // Tanks à faire apparaître plus tard
}

interface GameStateProps {
  health: number;
  score: number;
  wave: number;
  bulletType: string;
  gameRunning: boolean;
  invulnerable: number;
  showGameOver: boolean;
  showVictory: boolean;
  showWelcomeScreen: boolean; // Nouvel état pour l'écran d'accueil
  showHeartLoss: boolean; // Animation de perte de cœur
  damageFlash: number; // Compteur pour l'effet flash rouge (en frames)
  waveAnnouncement: string; // Texte pour l'annonce de vague
  // Contrôles tactiles
  touchJoystick: { x: number; y: number; active: boolean };
  touchShoot: boolean;
  // Bouclier
  shieldActive: boolean;
  shieldHits: number;
}

const SpaceBulletStorm: React.FC<SpaceBulletStormProps> = ({ onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const imageRefs = useRef<Record<string, HTMLImageElement>>({});
  const currentWaveRef = useRef<number>(1); // Ref pour la vague actuelle
  const touchControlsRef = useRef({ joystick: { x: 0, y: 0, active: false, centerX: 0, centerY: 0 }, shoot: false }); // Ref pour les contrôles tactiles
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const bulletTypeRef = useRef('simple'); // Ref pour le type de balle
  // Particles toggle (disabled per user request)
  const ENABLE_PARTICLES = false;
  // Stage / player for rules + progression
  type StageData = { id: number; nom?: string; description?: string; regles?: string; niveau?: number; target_score?: number } | null;
  type PlayerData = { reddit_id: string; etage_actuel?: number } | null;
  const [stageData, setStageData] = useState<StageData>(null);
  const [loadingStage, setLoadingStage] = useState<boolean>(true);
  const [playerData, setPlayerData] = useState<PlayerData>(null);
  const [progressionSaved, setProgressionSaved] = useState<boolean>(false);
  const loseHeartSfxRef = useRef<HTMLAudioElement | null>(null);
  const bonusSfxRef = useRef<HTMLAudioElement | null>(null);
  const explosionSfxRef = useRef<HTMLAudioElement | null>(null);
  const loseGameSfxRef = useRef<HTMLAudioElement | null>(null);

  const IS_MOBILE = typeof window !== 'undefined' ? window.innerWidth <= 768 : false;
  const SIZE_MULT = IS_MOBILE ? 1.5 : 1.0;
  const TOUCH_SENSITIVITY = IS_MOBILE ? 1.6 : 1.0;
  
  // État du jeu
  const [gameState, setGameState] = useState<GameStateProps>({
    health: 5,
    score: 0,
    wave: 1,
    bulletType: 'simple',
    gameRunning: false, // On commence par l'écran d'accueil, donc pas de jeu en cours
    invulnerable: 0,
    showGameOver: false,
    showVictory: false,
    showWelcomeScreen: true, // On affiche l'écran d'accueil au début
    showHeartLoss: false, // Animation de perte de cœur désactivée par défaut
    damageFlash: 0, // Compteur pour l'effet flash (0 = pas de flash)
    waveAnnouncement: '',
    // Contrôles tactiles
    touchJoystick: { x: 0, y: 0, active: false },
    touchShoot: false,
    // Bouclier
    shieldActive: false,
    shieldHits: 0
  });
  
  // Objets du jeu
  const gameObjectsRef = useRef<GameObjectsProps>({
    player: {
      x: 450, // canvas.width / 2
      y: 620, // canvas.height - 80
      width: Math.round(40 * SIZE_MULT),
      height: Math.round(40 * SIZE_MULT),
      speed: 5,
      shootCooldown: 0
    },
    playerBullets: [],
    enemies: [],
    enemyBullets: [],
    bonuses: [],
    particles: [],
    boss: null,
    isWaveProgressing: false, // Initialiser le flag de progression des vagues
    lastEnemyCount: 0, // Pour le debug
    waveEnemyQueue: [],
    spawnTimer: 0,
    initialEnemyCount: 0,
    tanksSpawned: false,
    tanksToSpawn: []
  });

  // Classes
  class Bullet implements BulletProps {
    x: number;
    y: number;
    dx: number;
    dy: number;
    color: string;
    size: number;
    
    constructor(x: number, y: number, dx: number, dy: number, color: string = '#00ffff', size: number = 3) {
      this.x = x;
      this.y = y;
      this.dx = dx;
      this.dy = dy;
      this.color = color;
      this.size = Math.max(2, Math.round(size * SIZE_MULT));
    }
    
    update(): void {
      this.x += this.dx;
      this.y += this.dy;
    }
    
    draw(ctx: CanvasRenderingContext2D): void {
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 10;
      ctx.fillRect(this.x - this.size/2, this.y - this.size/2, this.size, this.size);
      ctx.shadowBlur = 0;
    }
  }
  
  class Enemy implements EnemyProps {
    x: number;
    y: number;
    type: string;
    width: number;
    height: number;
    speed: number;
    shootCooldown: number;
    health: number;
    dodgeDirection: number; // Pour l'IA d'évitement
    dodgeCooldown: number; // Cooldown entre les esquives
    
    constructor(x: number, y: number, type: string = 'basic') {
      this.x = x;
      this.y = y;
      this.type = type;
      this.width = Math.round(30 * SIZE_MULT);
      this.height = Math.round(30 * SIZE_MULT);
      this.speed = 2;
      this.shootCooldown = 0;
      this.health = 1;
      this.dodgeDirection = 0;
      this.dodgeCooldown = 0;
      
      if (type === 'fast') {
        this.speed = 6; // Plus rapides
        this.width = Math.round(25 * SIZE_MULT);
        this.height = Math.round(25 * SIZE_MULT);
        this.health = 1;
      } else if (type === 'tank') {
        this.health = 5; // Boss intermédiaires plus résistants
        this.width = Math.round(50 * SIZE_MULT);
        this.height = Math.round(50 * SIZE_MULT);
        this.speed = 0; // Ne descendent pas
      } else if (type === 'shooter') {
        this.health = 3;
        this.width = Math.round(35 * SIZE_MULT);
        this.height = Math.round(35 * SIZE_MULT);
        this.speed = 2;
        this.shootCooldown = 10; // Cadence ultra élevée
      }
    }
    
    update(enemyBullets: Bullet[], playerBullets: Bullet[], playerX: number, playerY: number): void {
      this.dodgeCooldown = Math.max(0, this.dodgeCooldown - 1);
      
      // Comportements spécifiques par type
      if (this.type === 'basic') {
        // Basic : descendent normalement, tirent en ligne droite
        this.y += this.speed;
        this.x += Math.sin(this.y * 0.01) * 0.5;
        
        this.shootCooldown--;
        if (this.shootCooldown <= 0 && Math.random() < 0.015) {
          enemyBullets.push(new Bullet(this.x, this.y + this.height/2, 0, 4, '#ff4444', 4));
          this.shootCooldown = 90;
        }
        
      } else if (this.type === 'fast') {
        // Fast : très rapides, descendent en zigzag
        this.y += this.speed;
        this.x += Math.sin(this.y * 0.02) * 2;
        
        // Tirent moins souvent car ils infligent des dégâts au contact
        this.shootCooldown--;
        if (this.shootCooldown <= 0 && Math.random() < 0.01) {
          enemyBullets.push(new Bullet(this.x, this.y + this.height/2, 0, 5, '#ffff44', 4));
          this.shootCooldown = 120;
        }
        
      } else if (this.type === 'tank') {
        // Tank : restent en haut, bougent latéralement, évitent les balles
        this.handleDodging(playerBullets);
        
        // Mouvement latéral lent
        if (this.dodgeDirection === 0) {
          this.x += Math.sin(Date.now() * 0.001) * 0.5;
        } else {
          this.x += this.dodgeDirection * 3;
        }
        
        // Maintenir en haut de l'écran
        this.y = Math.max(50, Math.min(150, this.y));
        this.x = Math.max(this.width/2, Math.min(900 - this.width/2, this.x));
        
        // Tir éparpillé
        this.shootCooldown--;
        if (this.shootCooldown <= 0) {
          // Tir en éventail
          for (let angle = -45; angle <= 45; angle += 15) {
            const rad = (angle * Math.PI) / 180;
            enemyBullets.push(new Bullet(
              this.x, this.y + this.height/2,
              Math.sin(rad) * 3, Math.cos(rad) * 4,
              '#ff8844', 5
            ));
          }
          this.shootCooldown = 120;
        }
        
      } else if (this.type === 'shooter') {
        // Shooter : descendent, évitent les balles, tir ultra rapide
        this.handleDodging(playerBullets);
        
        if (this.dodgeDirection === 0) {
          this.y += this.speed;
          this.x += Math.sin(this.y * 0.015) * 1;
        } else {
          this.x += this.dodgeDirection * 4;
          this.y += this.speed * 0.5; // Ralentit en esquivant
        }
        
        // Tir ultra rapide
        this.shootCooldown--;
        if (this.shootCooldown <= 0) {
          enemyBullets.push(new Bullet(this.x, this.y + this.height/2, 0, 6, '#ff00ff', 4));
          this.shootCooldown = 15; // Très rapide
        }
      }
    }
    
    // IA d'évitement pour tanks et shooters
    handleDodging(playerBullets: Bullet[]): void {
      if (this.dodgeCooldown > 0) return;
      
      // Chercher les balles dangereuses
      for (const bullet of playerBullets) {
        const dx = bullet.x - this.x;
        const dy = bullet.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Si une balle est proche et se dirige vers l'ennemi
        if (distance < 80 && bullet.dy < 0) {
          // Esquiver dans la direction opposée à la balle
          this.dodgeDirection = dx > 0 ? -1 : 1;
          this.dodgeCooldown = 30; // Esquive pendant 30 frames
          break;
        }
      }
      
      // Arrêter l'esquive
      if (this.dodgeCooldown === 0) {
        this.dodgeDirection = 0;
      }
    }
    
    draw(ctx: CanvasRenderingContext2D): void {
      let enemyImg;
      if (this.type === 'fast') {
        enemyImg = imageRefs.current.enemy2;
      } else if (this.type === 'tank') {
        enemyImg = imageRefs.current.enemy3;
      } else if (this.type === 'shooter') {
        enemyImg = imageRefs.current.enemy4;
      } else {
        enemyImg = imageRefs.current.enemy1;
      }

      if (enemyImg) {
        ctx.drawImage(enemyImg, this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);
      } else {
        // Fallback si l'image n'est pas chargée
        let color = '#ff4444';
        if (this.type === 'fast') color = '#ffff44';
        if (this.type === 'tank') color = '#ff8844';
        ctx.fillStyle = color;
        ctx.fillRect(this.x - this.width/2, this.y - this.height/2, this.width, this.height);
      }
    }
  }
  
  class Boss implements BossProps {
    x: number;
    y: number;
    width: number;
    height: number;
    maxHealth: number;
    health: number;
    speed: number;
    direction: number;
    shootCooldown: number;
    specialAttackCooldown: number;
    
    constructor() {
      this.x = 450; // canvas.width / 2
      this.y = 100;
      this.width = Math.round(120 * SIZE_MULT);
      this.height = Math.round(80 * SIZE_MULT);
      this.maxHealth = 50;
      this.health = 50;
      this.speed = 2;
      this.direction = 1;
      this.shootCooldown = 0;
      this.specialAttackCooldown = 0;
    }
    
    update(enemyBullets: Bullet[]): void {
      this.x += this.speed * this.direction;
      if (this.x <= this.width/2 || this.x >= 900 - this.width/2) {
        this.direction *= -1;
      }
      
      this.shootCooldown--;
      this.specialAttackCooldown--;
      
      if (this.shootCooldown <= 0) {
        for (let i = -2; i <= 2; i++) {
          enemyBullets.push(new Bullet(this.x + i * 20, this.y + this.height/2, i * 2, 5, '#ff0000', 6));
        }
        this.shootCooldown = 30;
      }
      
      if (this.specialAttackCooldown <= 0) {
        for (let angle = 0; angle < 360; angle += 20) {
          const rad = angle * Math.PI / 180;
          enemyBullets.push(new Bullet(this.x, this.y, 
            Math.cos(rad) * 3, Math.sin(rad) * 3, '#ff8800', 8));
        }
        this.specialAttackCooldown = 180;
      }
    }
    
    draw(ctx: CanvasRenderingContext2D): void {
      const bossImg = imageRefs.current.boss;

      if (bossImg) {
        ctx.drawImage(bossImg, this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);
      } else {
        // Fallback si l'image n'est pas chargée
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(this.x - this.width/2, this.y - this.height/2, this.width, this.height);
      }

      // Barre de vie du boss
      const barWidth = 100;
      const barHeight = 8;
      const barX = this.x - barWidth/2;
      const barY = this.y - this.height/2 - 20;
      
      ctx.fillStyle = '#333';
      ctx.fillRect(barX, barY, barWidth, barHeight);
      
      ctx.fillStyle = this.health > this.maxHealth * 0.3 ? '#00ff00' : '#ff0000';
      ctx.fillRect(barX, barY, (this.health / this.maxHealth) * barWidth, barHeight);
    }
  }
  
  class Bonus implements BonusProps {
    x: number;
    y: number;
    type: string;
    width: number;
    height: number;
    speed: number;
    rotation: number;
    
    constructor(x: number, y: number, type: string) {
      this.x = x;
      this.y = y;
      this.type = type;
      this.width = Math.round(25 * SIZE_MULT);
      this.height = Math.round(25 * SIZE_MULT);
      this.speed = 2;
      this.rotation = 0;
    }
    
    update(): void {
      this.y += this.speed;
      this.rotation += 0.1;
    }
    
    draw(ctx: CanvasRenderingContext2D): void {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      
      let color = '#00ff00';
      if (this.type === 'multishot') color = '#0088ff';
      if (this.type === 'rapidfire') color = '#ff8800';
      if (this.type === 'scatter') color = '#ff44ff';
      if (this.type === 'power') color = '#ff4444';
      if (this.type === 'shield') color = '#00ffff';
      
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
      
      ctx.fillStyle = '#000';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      if (this.type === 'health') ctx.fillText('+', 0, 4);
      if (this.type === 'multishot') ctx.fillText('M', 0, 4);
      if (this.type === 'rapidfire') ctx.fillText('R', 0, 4);
      if (this.type === 'scatter') ctx.fillText('S', 0, 4);
      if (this.type === 'power') ctx.fillText('P', 0, 4);
      if (this.type === 'shield') ctx.fillText('⚡', 0, 4);
      
      ctx.restore();
      ctx.shadowBlur = 0;
    }
  }
  
  class Particle implements ParticleProps {
    x: number;
    y: number;
    dx: number;
    dy: number;
    life: number;
    maxLife: number;
    color: string;
    
    constructor(x: number, y: number, color: string = '#ffff00') {
      this.x = x;
      this.y = y;
      this.dx = (Math.random() - 0.5) * 6;
      this.dy = (Math.random() - 0.5) * 6;
      this.life = 30;
      this.maxLife = 30;
      this.color = color;
    }
    
    update(): void {
      this.x += this.dx;
      this.y += this.dy;
      this.life--;
    }
    
    draw(ctx: CanvasRenderingContext2D): void {
      const alpha = this.life / this.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.color;
      ctx.fillRect(this.x - 2, this.y - 2, 4, 4);
      ctx.globalAlpha = 1;
    }
  }

  const spawnEnemyWave = useCallback((waveNumber?: number) => {
    const gameObjects = gameObjectsRef.current;
    gameObjects.enemies = [];
    
    // Utiliser le paramètre waveNumber s'il est fourni, sinon utiliser gameState.wave
    const currentWave = waveNumber || gameState.wave;

    const waveConfigs = {
      1: { basic: 25, fast: 8, tank: 1, shooter: 0 }, // 34 ennemis, 1 tank à éliminer
      2: { basic: 20, fast: 12, tank: 2, shooter: 3 }, // 37 ennemis, 2 tanks à éliminer
      3: { basic: 18, fast: 15, tank: 3, shooter: 6 }, // 42 ennemis, 3 tanks à éliminer
      4: { basic: 15, fast: 18, tank: 4, shooter: 8 }, // 45 ennemis, 4 tanks à éliminer
    };

    const config = waveConfigs[currentWave];
    if (!config) return;

    // Créer la file d'attente des ennemis (sans les tanks)
    const enemiesToQueue = [];
    for (let i = 0; i < config.basic; i++) enemiesToQueue.push('basic');
    for (let i = 0; i < config.fast; i++) enemiesToQueue.push('fast');
    for (let i = 0; i < config.shooter; i++) enemiesToQueue.push('shooter');

    // Mélanger pour une apparition aléatoire
    enemiesToQueue.sort(() => Math.random() - 0.5);

    // Stocker les tanks séparément (ils apparaîtront plus tard)
    const tanksToSpawn = [];
    for (let i = 0; i < config.tank; i++) {
      tanksToSpawn.push({
        type: 'tank',
        x: Math.random() * 700 + 100,
        y: Math.random() * 50 + 80
      });
    }

    // Spawn immédiat du premier groupe pour commencer l'action
    const initialSpawnCount = Math.min(10, enemiesToQueue.length);
    for (let i = 0; i < initialSpawnCount; i++) {
      const enemyType = enemiesToQueue.shift();
      if (enemyType) {
        const x = Math.random() * 840 + 30;
        const y = -50 - i * 30;
        gameObjects.enemies.push(new Enemy(x, y, enemyType));
      }
    }

    // Initialiser le système de spawn pour le reste
    gameObjects.waveEnemyQueue = enemiesToQueue;
    gameObjects.spawnTimer = 0;
    gameObjects.initialEnemyCount = enemiesToQueue.length + initialSpawnCount; // Total incluant le spawn initial
    gameObjects.tanksSpawned = false;
    gameObjects.tanksToSpawn = tanksToSpawn; // Stocker les tanks à faire apparaître

    console.log(`Vague ${currentWave} démarrée: ${initialSpawnCount} ennemis spawés immédiatement, ${enemiesToQueue.length} en attente, ${tanksToSpawn.length} tanks à 3/4.`);
  }, [gameState.wave]);

  const spawnBoss = useCallback(() => {
    gameObjectsRef.current.boss = new Boss();
  }, []);

  const updatePlayer = useCallback(() => {
    const gameObjects = gameObjectsRef.current;
    const player = gameObjects.player;
    const keys = keysRef.current;
    
    // Contrôles clavier
    let moveX = 0, moveY = 0;
    if (keys['a'] || keys['arrowleft']) moveX -= 1;
    if (keys['d'] || keys['arrowright']) moveX += 1;
    if (keys['w'] || keys['arrowup']) moveY -= 1;
    if (keys['s'] || keys['arrowdown']) moveY += 1;
    
    // Contrôles tactiles (joystick) - utiliser la ref pour avoir la valeur actuelle
    const touchControls = touchControlsRef.current;
    if (touchControls.joystick.active) {
      moveX += touchControls.joystick.x;
      moveY += touchControls.joystick.y;
    }
    
    // Appliquer le mouvement
    player.x = Math.max(20, Math.min(880, player.x + moveX * player.speed));
    player.y = Math.max(20, Math.min(680, player.y + moveY * player.speed));
    
    player.shootCooldown = Math.max(0, player.shootCooldown - 1);
    // Tir automatique - plus besoin de touche ou bouton
    if (player.shootCooldown === 0) {
      const currentBulletType = bulletTypeRef.current;
      console.log('Firing with bullet type:', currentBulletType);
      if (currentBulletType === 'multishot') {
        gameObjects.playerBullets.push(new Bullet(player.x - 15, player.y - 20, 0, -8));
        gameObjects.playerBullets.push(new Bullet(player.x, player.y - 20, 0, -8));
        gameObjects.playerBullets.push(new Bullet(player.x + 15, player.y - 20, 0, -8));
        player.shootCooldown = 15;
      } else if (currentBulletType === 'rapidfire') {
        gameObjects.playerBullets.push(new Bullet(player.x, player.y - 20, 0, -10));
        player.shootCooldown = 5;
      } else if (currentBulletType === 'scatter') {
        // Tir éparpillé - 5 balles en éventail
        gameObjects.playerBullets.push(new Bullet(player.x, player.y - 20, -3, -8));
        gameObjects.playerBullets.push(new Bullet(player.x, player.y - 20, -1.5, -8));
        gameObjects.playerBullets.push(new Bullet(player.x, player.y - 20, 0, -8));
        gameObjects.playerBullets.push(new Bullet(player.x, player.y - 20, 1.5, -8));
        gameObjects.playerBullets.push(new Bullet(player.x, player.y - 20, 3, -8));
        player.shootCooldown = 20;
      } else if (currentBulletType === 'power') {
        // Tir puissant - balles plus grosses et rapides
        const powerBullet = new Bullet(player.x, player.y - 20, 0, -12);
        powerBullet.size = 8; // Plus grosse
        powerBullet.color = '#ff4444'; // Rouge pour indiquer la puissance
        gameObjects.playerBullets.push(powerBullet);
        player.shootCooldown = 8;
      } else {
        gameObjects.playerBullets.push(new Bullet(player.x, player.y - 20, 0, -8));
        player.shootCooldown = 10;
      }
    }
  }, []);

  // Fonction helper pour gérer les dégâts avec bouclier
  const takeDamage = useCallback(() => {
    setGameState(prev => {
      if (prev.shieldActive && prev.shieldHits > 0) {
        // Le bouclier absorbe le dégât
        const newShieldHits = prev.shieldHits - 1;
        return {
          ...prev,
          shieldHits: newShieldHits,
          shieldActive: newShieldHits > 0,
          invulnerable: 60 // Invulnérabilité courte avec bouclier
        };
      } else {
        // Dégâts normaux
        const newHealth = Math.max(0, prev.health - 1);
        try { if (loseHeartSfxRef.current) { loseHeartSfxRef.current.currentTime = 0; loseHeartSfxRef.current.play().catch(() => {}); } } catch (_) {}
        return {
          ...prev,
          health: newHealth,
          invulnerable: 120,
          gameRunning: newHealth > 0,
          showGameOver: newHealth <= 0,
          showHeartLoss: true
        };
      }
    });
    
    // Animation de perte de cœur si pas de bouclier
    if (!gameState.shieldActive || gameState.shieldHits <= 0) {
      setTimeout(() => {
        setGameState(prev => ({ ...prev, showHeartLoss: false }));
      }, 1200);
    }
    // Si la vie est tombée à 0, jouer le son de défaite
    if (gameState.health - 1 <= 0) {
      try { if (loseGameSfxRef.current) { loseGameSfxRef.current.currentTime = 0; loseGameSfxRef.current.play().catch(() => {}); } } catch (_) {}
    }
  }, [gameState.shieldActive, gameState.shieldHits]);

  const drawPlayer = useCallback((ctx: CanvasRenderingContext2D) => {
    const player = gameObjectsRef.current.player;
    const playerImg = imageRefs.current.player;

    if (playerImg) {
      ctx.drawImage(playerImg, player.x - player.width / 2, player.y - player.height / 2, player.width, player.height);
    } else {
      // Fallback si l'image n'est pas chargée
      ctx.fillStyle = '#00ffff';
      ctx.fillRect(player.x - player.width/2, player.y - player.height/2, player.width, player.height);
    }
    
    // Dessiner le bouclier électromagnétique
    if (gameState.shieldActive && gameState.shieldHits > 0) {
      const shieldRadius = 35;
      const time = Date.now() * 0.01;
      
      // Effet électromagnétique avec plusieurs cercles
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(player.x, player.y, shieldRadius + i * 3, 0, Math.PI * 2);
        
        // Couleur qui change selon les hits restants
        const alpha = 0.3 + Math.sin(time + i) * 0.2;
        if (gameState.shieldHits === 3) {
          ctx.strokeStyle = `rgba(0, 255, 255, ${alpha})`; // Cyan plein
        } else if (gameState.shieldHits === 2) {
          ctx.strokeStyle = `rgba(255, 255, 0, ${alpha})`; // Jaune
        } else {
          ctx.strokeStyle = `rgba(255, 100, 0, ${alpha})`; // Orange (critique)
        }
        
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      
      // Particules électriques
      for (let i = 0; i < 8; i++) {
        const angle = (time + i * 0.8) % (Math.PI * 2);
        const sparkX = player.x + Math.cos(angle) * shieldRadius;
        const sparkY = player.y + Math.sin(angle) * shieldRadius;
        
        ctx.beginPath();
        ctx.arc(sparkX, sparkY, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + Math.sin(time * 2 + i) * 0.3})`;
        ctx.fill();
      }
    }
    
    // Ajouter un effet de bouclier pendant l'invulnérabilité
    if (gameState.invulnerable > 0) {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(0, 255, 255, ${gameState.invulnerable / 120})`;
      ctx.lineWidth = 2;
      ctx.arc(player.x, player.y, player.width/2 + 10, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, [gameState.invulnerable, gameState.shieldActive, gameState.shieldHits]);

  const checkCollisions = useCallback(() => {
    const gameObjects = gameObjectsRef.current;
    const player = gameObjects.player;
    
    // Balles joueur vs ennemis
    for (let i = gameObjects.playerBullets.length - 1; i >= 0; i--) {
      const bullet = gameObjects.playerBullets[i];
      let bulletHit = false; // Flag pour éviter les collisions multiples
      
      // Vs ennemis normaux
      for (let j = gameObjects.enemies.length - 1; j >= 0; j--) {
        const enemy = gameObjects.enemies[j];
        if (!bulletHit && bullet.x > enemy.x - enemy.width/2 && bullet.x < enemy.x + enemy.width/2 &&
            bullet.y > enemy.y - enemy.height/2 && bullet.y < enemy.y + enemy.height/2) {
          
          enemy.health--;
          gameObjects.playerBullets.splice(i, 1);
          bulletHit = true; // Marquer la balle comme ayant touché
          
          if (enemy.health <= 0) {
            if (ENABLE_PARTICLES) {
              for (let k = 0; k < 8; k++) {
                gameObjects.particles.push(new Particle(enemy.x, enemy.y, '#ffaa00'));
              }
            }
            try { if (explosionSfxRef.current) { explosionSfxRef.current.currentTime = 0; explosionSfxRef.current.play().catch(() => {}); } } catch (_) {}
            
            if (Math.random() < 0.3) {
              const bonusTypes = ['health', 'multishot', 'rapidfire', 'shield', 'power', 'scatter'];
              gameObjects.bonuses.push(new Bonus(enemy.x, enemy.y, bonusTypes[Math.floor(Math.random() * bonusTypes.length)]));
            }
            
            gameObjects.enemies.splice(j, 1);
            setGameState(prev => ({ ...prev, score: prev.score + 50 }));
          }
          break; // Sortir de la boucle des ennemis
        }
      }
      
      // Vs boss (seulement si la balle n'a pas déjà touché un ennemi)
      if (!bulletHit && gameObjects.boss && bullet.x > gameObjects.boss.x - gameObjects.boss.width/2 && 
          bullet.x < gameObjects.boss.x + gameObjects.boss.width/2 &&
          bullet.y > gameObjects.boss.y - gameObjects.boss.height/2 && 
          bullet.y < gameObjects.boss.y + gameObjects.boss.height/2) {
        gameObjects.boss.health--;
        gameObjects.playerBullets.splice(i, 1);
        bulletHit = true;
        
        for (let k = 0; k < 3; k++) {
          gameObjects.particles.push(new Particle(bullet.x, bullet.y, '#ff0000'));
        }
        
        if (gameObjects.boss.health <= 0) {
          if (ENABLE_PARTICLES) {
            for (let k = 0; k < 20; k++) {
              gameObjects.particles.push(new Particle(gameObjects.boss.x, gameObjects.boss.y, '#ffaa00'));
            }
          }
          gameObjects.boss = null;
          setGameState(prev => ({ ...prev, score: prev.score + 500 }));
          
          setTimeout(() => {
            setGameState(prev => ({ ...prev, gameRunning: false, showVictory: true }));
            const finalScore = gameObjectsRef.current ? gameObjectsRef.current.playerBullets.length + gameObjectsRef.current.enemyBullets.length + gameObjectsRef.current.enemies.length + gameObjectsRef.current.bonuses.length + gameObjectsRef.current.particles.length : 0; // placeholder not used
            submitProgression(gameState.score + 500, true);
          }, 1000);
        }
      }
    }
    
    // Balles ennemies vs joueur
    if (gameState.invulnerable === 0) {
      for (let i = gameObjects.enemyBullets.length - 1; i >= 0; i--) {
        const bullet = gameObjects.enemyBullets[i];
        if (bullet.x > player.x - player.width/2 && bullet.x < player.x + player.width/2 &&
            bullet.y > player.y - player.height/2 && bullet.y < player.y + player.height/2) {
          
          takeDamage();
          
          gameObjects.enemyBullets.splice(i, 1);
          
          if (ENABLE_PARTICLES) {
            for (let k = 0; k < 5; k++) {
              gameObjects.particles.push(new Particle(player.x, player.y, '#ff0000'));
            }
          }
          break;
        }
      }
    }
    
    // Joueur vs ennemis fast (dégâts au contact)
    if (gameState.invulnerable === 0) {
      for (let i = gameObjects.enemies.length - 1; i >= 0; i--) {
        const enemy = gameObjects.enemies[i];
        if (enemy.type === 'fast') {
          const dx = enemy.x - player.x;
          const dy = enemy.y - player.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < (enemy.width + player.width) / 2) {
            // Contact avec un ennemi fast = dégâts
            takeDamage();
            
            // Détruire l'ennemi fast au contact
            gameObjects.enemies.splice(i, 1);
            
            // Particules d'explosion
            if (ENABLE_PARTICLES) {
              for (let k = 0; k < 8; k++) {
                gameObjects.particles.push(new Particle(enemy.x, enemy.y, '#ffff44'));
              }
            }
            break;
          }
        }
      }
    }
    
    // Joueur vs bonus
    for (let i = gameObjects.bonuses.length - 1; i >= 0; i--) {
      const bonus = gameObjects.bonuses[i];
      if (Math.abs(bonus.x - player.x) < 30 && Math.abs(bonus.y - player.y) < 30) {
        if (bonus.type === 'health') {
          setGameState(prev => ({ ...prev, health: Math.min(5, prev.health + 1) }));
        } else if (bonus.type === 'multishot') {
          console.log('Multi-shot bonus activated!');
          setGameState(prev => ({ ...prev, bulletType: 'multishot' }));
        } else if (bonus.type === 'rapidfire') {
          console.log('Rapid fire bonus activated!');
          setGameState(prev => ({ ...prev, bulletType: 'rapidfire' }));
        } else if (bonus.type === 'scatter') {
          console.log('Scatter shot bonus activated!');
          setGameState(prev => ({ ...prev, bulletType: 'scatter' }));
        } else if (bonus.type === 'power') {
          console.log('Power shot bonus activated!');
          setGameState(prev => ({ ...prev, bulletType: 'power' }));
        } else if (bonus.type === 'shield') {
          console.log('Shield bonus activated!');
          setGameState(prev => ({ ...prev, shieldActive: true, shieldHits: 3 }));
        }
        try { if (bonusSfxRef.current) { bonusSfxRef.current.currentTime = 0; bonusSfxRef.current.play().catch(() => {}); } } catch (_) {}
        
        gameObjects.bonuses.splice(i, 1);
        setGameState(prev => ({ ...prev, score: prev.score + 5 }));
      }
    }
  }, [gameState.invulnerable]);

  const drawStars = useCallback((ctx: CanvasRenderingContext2D) => {
    for (let i = 0; i < 50; i++) {
      const x = (i * 137.5) % 900;
      const y = (i * 234.7 + Date.now() * 0.05) % 700;
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.3;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;
  }, []);

  // Je ne modifie pas cette fonction de boucle de jeu, juste son appel dans les hooks
  const gameLoop = useCallback(() => {
    if (!gameState.gameRunning) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const gameObjects = gameObjectsRef.current;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawStars(ctx);
    updatePlayer();
    
    // Gestion du spawn progressif des ennemis
    if (gameObjects.waveEnemyQueue && gameObjects.waveEnemyQueue.length > 0) {
      gameObjects.spawnTimer = (gameObjects.spawnTimer || 0) + 1;
      
      // Spawn toutes les 300 frames (5 secondes à 60fps) et max 10 ennemis à la fois
      if (gameObjects.spawnTimer >= 300) {
        const spawnCount = Math.min(10, gameObjects.waveEnemyQueue.length);
        
        for (let i = 0; i < spawnCount; i++) {
          const enemyType = gameObjects.waveEnemyQueue.shift();
          if (enemyType) {
            const x = Math.random() * 840 + 30;
            const y = -50 - i * 30;
            gameObjects.enemies.push(new Enemy(x, y, enemyType));
          }
        }
        
        gameObjects.spawnTimer = 0;
        console.log(`Spawn de ${spawnCount} ennemis. Restants en file: ${gameObjects.waveEnemyQueue.length}`);
      }
    }
    
    // Gestion de l'apparition des tanks à 3/4 des ennemis éliminés
    if (!gameObjects.tanksSpawned && gameObjects.initialEnemyCount && gameObjects.tanksToSpawn) {
      const enemiesKilled = gameObjects.initialEnemyCount - (gameObjects.waveEnemyQueue?.length || 0) - gameObjects.enemies.filter(e => e.type !== 'tank').length;
      const killRatio = enemiesKilled / gameObjects.initialEnemyCount;
      
      if (killRatio >= 0.75) { // 3/4 des ennemis éliminés
        console.log(`75% des ennemis éliminés (${enemiesKilled}/${gameObjects.initialEnemyCount}). Apparition des tanks!`);
        
        gameObjects.tanksToSpawn.forEach(tankData => {
          gameObjects.enemies.push(new Enemy(tankData.x, tankData.y, tankData.type));
        });
        
        gameObjects.tanksSpawned = true;
      }
    }

    // Mise à jour
    gameObjects.playerBullets.forEach(bullet => bullet.update());
    gameObjects.enemyBullets.forEach(bullet => bullet.update());
    gameObjects.enemies.forEach(enemy => enemy.update(
      gameObjects.enemyBullets, 
      gameObjects.playerBullets, 
      gameObjects.player.x, 
      gameObjects.player.y
    ));
    gameObjects.bonuses.forEach(bonus => bonus.update());
    gameObjects.particles.forEach(particle => particle.update());
    
    if (gameObjects.boss) gameObjects.boss.update(gameObjects.enemyBullets);
    
    // Nettoyage
    gameObjects.playerBullets = gameObjects.playerBullets.filter(bullet => bullet.y > -10);
    gameObjects.enemyBullets = gameObjects.enemyBullets.filter(bullet => bullet.y < 710);
    gameObjects.enemies = gameObjects.enemies.filter(enemy => 
      enemy.type === 'tank' || enemy.y < 750 // Les tanks ne sont jamais supprimés par position
    );
    gameObjects.bonuses = gameObjects.bonuses.filter(bonus => bonus.y < 730);
    gameObjects.particles = gameObjects.particles.filter(particle => particle.life > 0);
    
    checkCollisions();
    
    // Nouvelle logique de fin de vague : basée sur l'élimination des tanks
    const tanksRemaining = gameObjects.enemies.filter(enemy => enemy.type === 'tank').length;
    const totalEnemies = gameObjects.enemies.length;
    
    // Debug : afficher l'état des ennemis (seulement quand ça change)
    if (totalEnemies !== gameObjectsRef.current.lastEnemyCount) {
      console.log(`Vague ${currentWaveRef.current}: ${totalEnemies} ennemis restants, ${tanksRemaining} tanks restants`);
      gameObjectsRef.current.lastEnemyCount = totalEnemies;
    }
    
    // Condition de fin de vague : tous les tanks éliminés ET tous les ennemis de la file d'attente spawés
    const allEnemiesSpawned = !gameObjects.waveEnemyQueue || gameObjects.waveEnemyQueue.length === 0;
    const allTanksSpawned = gameObjects.tanksSpawned || false;
    
    if (tanksRemaining === 0 && !gameObjects.boss && allEnemiesSpawned && allTanksSpawned) {
      // Utiliser une variable locale pour éviter des appels multiples dans le même cycle
      const isWaveProgressing = gameObjectsRef.current.isWaveProgressing;
      
      if (!isWaveProgressing) {
        // Marquer que nous sommes en train de passer à la vague suivante
        gameObjectsRef.current.isWaveProgressing = true;
        
        if (currentWaveRef.current < 4) {
          // Passe à la vague suivante
          const nextWave = currentWaveRef.current + 1;
          currentWaveRef.current = nextWave; // Mettre à jour la ref
          console.log(`Progression à la vague ${nextWave} - Tous les tanks éliminés!`);

          setGameState(prev => ({ ...prev, wave: nextWave, waveAnnouncement: `WAVE ${nextWave}` }));

          setTimeout(() => {
            setGameState(prev => ({ ...prev, waveAnnouncement: '' }));
            spawnEnemyWave(nextWave); // Passer explicitement le numéro de vague
            gameObjectsRef.current.isWaveProgressing = false;
          }, 2500);
        } else if (currentWaveRef.current === 4) {
          // Passe au boss final (vague 5)
          currentWaveRef.current = 5; // Mettre à jour la ref
          console.log('Progression au boss final - Tous les tanks éliminés!');

          setGameState(prev => ({ ...prev, wave: 5, waveAnnouncement: 'FINAL BOSS' }));

          setTimeout(() => {
            setGameState(prev => ({ ...prev, waveAnnouncement: '' }));
            spawnBoss();
            gameObjectsRef.current.isWaveProgressing = false;
          }, 3000);
        }
      }
    }
    
    // Dessin
    drawPlayer(ctx);
    gameObjects.playerBullets.forEach(bullet => bullet.draw(ctx));
    gameObjects.enemyBullets.forEach(bullet => bullet.draw(ctx));
    gameObjects.enemies.forEach(enemy => enemy.draw(ctx));
    gameObjects.bonuses.forEach(bonus => bonus.draw(ctx));
    gameObjects.particles.forEach(particle => particle.draw(ctx));
    
    if (gameObjects.boss) gameObjects.boss.draw(ctx);
    
    // Mise à jour de l'invulnérabilité
    if (gameState.invulnerable > 0) {
      setGameState(prev => ({ ...prev, invulnerable: Math.max(0, prev.invulnerable - 1) }));
    }
    
    animationRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, updatePlayer, drawPlayer, drawStars, checkCollisions, spawnEnemyWave, spawnBoss]);

  const restartGame = useCallback(() => {
    console.log("Redémarrage du jeu");
    
    // Annuler toute animation en cours
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    // Réinitialiser la ref de vague
    currentWaveRef.current = 1;
    
    setGameState({
      health: 5,
      score: 0,
      wave: 1, // Garantit qu'on redémarre à la vague 1
      bulletType: 'simple',
      gameRunning: true,
      invulnerable: 0,
      showGameOver: false,
      showVictory: false,
      showWelcomeScreen: false, // Ne pas montrer l'écran d'accueil après un redémarrage
      showHeartLoss: false, // Pas d'animation de perte de cœur au démarrage
      damageFlash: 0, // Pas d'effet flash au démarrage
      waveAnnouncement: '',
      touchJoystick: { x: 0, y: 0, active: false },
      touchShoot: false,
      shieldActive: false,
      shieldHits: 0
    });
    
    gameObjectsRef.current = {
      player: {
        x: 450,
        y: 620,
        width: 40,
        height: 40,
        speed: 5,
        shootCooldown: 0
      },
      playerBullets: [],
      enemies: [],
      enemyBullets: [],
      bonuses: [],
      particles: [],
      boss: null
    };
    
    // Générer la première vague après un délai suffisant pour que l'état soit mis à jour
    setTimeout(() => {
      console.log("Génération de la première vague lors du redémarrage");
      spawnEnemyWave(1); // Passer explicitement la vague 1
    }, 1000);
  }, [spawnEnemyWave]);

  const startNewGame = useCallback(() => {
    console.log("Démarrage d'une nouvelle partie");
    
    // Réinitialiser la ref de vague
    currentWaveRef.current = 1;
    
    // Réinitialiser complètement l'état du jeu avec l'annonce de la vague 1
    setGameState({
      health: 5,
      score: 0,
      wave: 1,  // Garantit que le jeu commence à la vague 1
      bulletType: 'simple',
      gameRunning: true,
      invulnerable: 0,
      showGameOver: false,
      showVictory: false,
      showWelcomeScreen: false,
      showHeartLoss: false,
      damageFlash: 0,
      waveAnnouncement: 'WAVE 1', // Afficher l'annonce de la première vague
      touchJoystick: { x: 0, y: 0, active: false },
      touchShoot: false,
      shieldActive: false,
      shieldHits: 0
    });
    
    // Réinitialiser tous les objets du jeu
    gameObjectsRef.current = {
      player: {
        x: 450,
        y: 620,
        width: 40,
        height: 40,
        speed: 5,
        shootCooldown: 0
      },
      playerBullets: [],
      enemies: [],
      enemyBullets: [],
      bonuses: [],
      particles: [],
      boss: null,
      isWaveProgressing: true, // IMPORTANT : Bloquer la logique de fin de vague pendant l'initialisation
      lastEnemyCount: 0,
      waveEnemyQueue: [],
      spawnTimer: 0,
      initialEnemyCount: 0,
      tanksSpawned: false,
      tanksToSpawn: []
    };
    
    // Afficher l'annonce puis générer la première vague
    setTimeout(() => {
      setGameState(prev => ({ ...prev, waveAnnouncement: '' }));
      spawnEnemyWave(1); // Passer explicitement la vague 1
      gameObjectsRef.current.isWaveProgressing = false; // Débloquer après génération
    }, 2500); // Même délai que pour les autres vagues
  }, [spawnEnemyWave]);

  // Progression submit helper
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
              body: JSON.stringify({ joueur_id: playerData.reddit_id, etage_id: stageData.id, score: finalScore, completed })
            });
          }
        } else {
          await fetch('/api/progression/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ joueur_id: playerData.reddit_id, etage_id: stageData.id, score: finalScore, completed })
          });
        }
      } else if (getRes.status === 404) {
        await fetch('/api/progression/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ joueur_id: playerData.reddit_id, etage_id: stageData.id, score: finalScore, completed })
        });
      }

      // Update player level only if victory and player is on this stage level
      if (completed && stageData?.niveau !== undefined && playerData?.etage_actuel === stageData.niveau) {
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

  // Préchargement des images
  useEffect(() => {
    const imagesToLoad = {
      player: '/icoplayer1.png',
      enemy1: '/icoenemie1.png',
      enemy2: '/icoenemi2.png',
      enemy3: '/Icoenemi3.png',
      enemy4: '/icoenemi4.png',
      boss: '/icoboss2.png',
    };

    Object.entries(imagesToLoad).forEach(([name, src]) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        imageRefs.current[name] = img;
      };
    });
  }, []);

  // Sons SFX
  useEffect(() => {
    try {
      const sfxVolume = parseFloat(window.localStorage.getItem('sfxVolume') || '0.8');
      loseHeartSfxRef.current = new Audio('/Lose_heart.mp3');
      loseHeartSfxRef.current.volume = Math.min(Math.max(sfxVolume, 0), 1);
      bonusSfxRef.current = new Audio('/success.mp3');
      bonusSfxRef.current.volume = Math.min(Math.max(sfxVolume, 0), 1);
      explosionSfxRef.current = new Audio('/short-explosion.mp3');
      explosionSfxRef.current.volume = Math.min(Math.max(sfxVolume, 0), 1);
      loseGameSfxRef.current = new Audio('/lose.mp3');
      loseGameSfxRef.current.volume = Math.min(Math.max(sfxVolume, 0), 1);
    } catch (_) {}
  }, []);

  // Injecter les styles CSS pour les animations
  useEffect(() => {
    // Créer un élément style
    const styleElement = document.createElement('style');
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
    
    // Nettoyer lors du démontage
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);
  
  // Fonction de debug pour passer à la vague suivante
  const skipToNextWave = useCallback(() => {
    const gameObjects = gameObjectsRef.current;
    
    // Vider tous les ennemis et la file d'attente
    gameObjects.enemies = [];
    gameObjects.waveEnemyQueue = [];
    gameObjects.tanksSpawned = true; // Marquer les tanks comme spawés pour éviter les bugs
    
    console.log(`[DEBUG] Passage forcé à la vague suivante depuis la vague ${currentWaveRef.current}`);
    
    // Déclencher la progression normale
    if (!gameObjects.isWaveProgressing) {
      gameObjects.isWaveProgressing = true;
      
      if (currentWaveRef.current < 4) {
        const nextWave = currentWaveRef.current + 1;
        currentWaveRef.current = nextWave;
        
        setGameState(prev => ({ ...prev, wave: nextWave, waveAnnouncement: `WAVE ${nextWave}` }));
        
        setTimeout(() => {
          setGameState(prev => ({ ...prev, waveAnnouncement: '' }));
          spawnEnemyWave(nextWave);
          gameObjects.isWaveProgressing = false;
        }, 2500);
      } else if (currentWaveRef.current === 4) {
        currentWaveRef.current = 5;
        
        setGameState(prev => ({ ...prev, wave: 5, waveAnnouncement: 'FINAL BOSS' }));
        
        setTimeout(() => {
          setGameState(prev => ({ ...prev, waveAnnouncement: '' }));
          spawnBoss();
          gameObjects.isWaveProgressing = false;
        }, 3000);
      }
    }
  }, [spawnEnemyWave, spawnBoss]);

  // Gestion des événements clavier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = true;
      if (e.key.toLowerCase() === 'r') restartGame();
      if (e.key.toLowerCase() === 'v' && gameState.gameRunning) {
        skipToNextWave(); // Debug : passer à la vague suivante
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [restartGame]);

  // Effet de nettoyage au démontage du composant
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Démarrage de la boucle quand gameRunning change
  useEffect(() => {
    if (gameState.gameRunning && !animationRef.current) {
      // Lancer la boucle de jeu quand gameRunning devient true
      gameLoop();
    }
  }, [gameState.gameRunning, gameLoop]);

  // Synchroniser la ref avec l'état du type de balle
  useEffect(() => {
    bulletTypeRef.current = gameState.bulletType;
  }, [gameState.bulletType]);

  const getBulletTypeText = () => {
    switch(gameState.bulletType) {
      case 'multishot': return 'Multi-Shot';
      case 'rapidfire': return 'Rapid Fire';
      case 'scatter': return 'Scatter Shot';
      case 'power': return 'Power Shot';
      default: return 'Simple';
    }
  };

  // Load stage rules/description from API
  useEffect(() => {
    const loadStage = async () => {
      try {
        setLoadingStage(true);
        const res = await fetch('/api/stages');
        if (res.ok) {
          const json = await res.json();
          const stages = json?.data || json;
          if (Array.isArray(stages)) {
            let found = stages.find((s: any) => (s.nom || '').toLowerCase().includes('bulletstorm'))
              || stages.find((s: any) => (s.nom || '').toLowerCase().includes('space bullet'))
              || stages.find((s: any) => (s.nom || '').toLowerCase().includes('space'))
              || null;
            if (found) setStageData(found);
          }
        }
      } catch (_) {}
      finally { setLoadingStage(false); }
    };
    const loadPlayer = async () => {
      try {
        const res = await fetch('/api/player/init');
        if (res.ok) {
          const json = await res.json();
          if (json?.status === 'success' && json.data?.reddit_id) {
            setPlayerData({ reddit_id: json.data.reddit_id, etage_actuel: json.data.etage_actuel });
          }
        }
      } catch (_) {}
    };
    loadStage();
    loadPlayer();
  }, []);

  // Écran d'accueil avec les règles
  if (gameState.showWelcomeScreen) {
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
        {onBack && (
          <button
            onClick={onBack}
            className="absolute top-2 left-2 bg-black/30 hover:bg-black/40 text-cyan-100 px-3 py-1 rounded-lg transition-colors z-10 border border-cyan-500/30"
          >
            ← Retour au menu
          </button>
        )}
        
        <div className="absolute inset-0 bg-black/50"></div>
        
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-cyan-200 rounded-full animate-pulse opacity-60"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${2 + Math.random() * 2}s`
              }}
            />
          ))}
        </div>

        <div className="bg-black/40 backdrop-blur-sm rounded-lg p-6 max-w-md w-full text-center border border-cyan-500/30 relative z-10">
          <h1 className="text-2xl font-bold text-cyan-100 mb-4">Space Bullet Storm</h1>
          
          <div className="bg-black/20 rounded-lg p-4 mb-4 border border-cyan-700/20">
            <h2 className="text-lg font-semibold text-cyan-200 mb-2">Game Rules:</h2>
            {loadingStage ? (
              <div className="text-cyan-100/70 text-sm">Loading rules...</div>
            ) : stageData?.regles ? (
              <div className="text-cyan-100/80 text-sm space-y-1" dangerouslySetInnerHTML={{ __html: stageData.regles }} />
            ) : (
              <div className="text-cyan-100/80 text-sm space-y-1">
                <p>• Eliminate waves of alien invaders</p>
                <div className="text-xs text-cyan-100/70 space-y-1">
                <p>• <span className="text-green-300">Green bonus (+)</span> : Restore 1 life (max 5)</p>
                <p>• <span className="text-blue-300">Blue bonus (M)</span> : Multi-shot</p>
                <p>• <span className="text-orange-300">Orange bonus (R)</span> : Rapid fire</p>
                <p>• <span className="text-purple-300">Pink bonus (S)</span> : Scatter shot</p>
                <p>• <span className="text-red-300">Red bonus (P)</span> : Power shot</p>
                <p>• <span className="text-cyan-300">Cyan bonus (⚡)</span> : Shield (3 hits)</p>
                <p>• Survive 4 waves and defeat the Final Boss!</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-black/20 rounded-lg p-3 mb-4 border border-cyan-700/20">
            <h2 className="text-md font-semibold text-cyan-200 mb-1">Controls:</h2>
            <p className="text-cyan-100/80 text-xs">WASD or Arrows: Movement</p>
            <p className="text-green-300/80 text-xs">Auto-fire: No need to press anything!</p>
            <p className="text-cyan-100/80 text-xs">R: Restart (when stopped)</p>
            <p className="text-purple-300/80 text-xs">V: Skip to next wave (debug)</p>
            <p className="text-cyan-100/80 text-xs">Mobile: Touch joystick only</p>
          </div>

          <button
            onClick={startNewGame}
            className="w-full bg-gradient-to-r from-cyan-600/80 to-blue-600/80 text-white py-2 px-4 rounded-lg 
                   font-semibold hover:from-cyan-700/90 hover:to-blue-700/90 transition-all duration-300 
                   shadow-lg border border-cyan-500/30"
          >
            Start Mission
          </button>
        </div>
      </div>
    );
  }

  // Affichage du jeu en cours
  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-2 relative"
      style={{
        backgroundImage: 'url(/Faleter2.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        // Ajout d'un effet de vibration au lieu du clignotement quand on reçoit des dégâts
        transform: gameState.invulnerable > 90 ? `translate(${Math.random() * 6 - 3}px, ${Math.random() * 6 - 3}px)` : 'none',
        transition: 'transform 0.05s ease'
      }}
    >
      {onBack && (
        <button
          onClick={onBack}
          className="absolute top-2 left-2 bg-black/30 hover:bg-black/40 text-cyan-100 px-3 py-1 rounded-lg transition-colors z-10 border border-cyan-500/30 text-sm"
        >
          ← Retour
        </button>
      )}

     

      {/* Overlay principal - sans effet rouge */}
      <div 
        className="absolute inset-0" 
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.6)'
        }}
      ></div>

      {/* Annonce de vague */}
      {gameState.waveAnnouncement && (
        <div 
          key={gameState.wave} // Clé unique pour forcer la ré-animation
          className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none"
        >
          <h2 
            className="text-5xl font-bold text-cyan-300 drop-shadow-lg"
            style={{ animation: 'wave-announce 2.5s ease-out forwards' }}
          >
            {gameState.waveAnnouncement}
          </h2>
        </div>
      )}

      {/* Étoiles en arrière-plan */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-cyan-200 rounded-full animate-pulse opacity-50"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 2}s`
            }}
          />
        ))}
      </div>

      {/* Animation de perte de cœur - placée en bas de la zone de jeu et monte en s'effaçant */}

      <div className="relative z-10 w-full max-w-3xl">
        {/* HUD plus compact */}
        <div className="flex justify-between items-center mb-2 bg-black/30 backdrop-blur-sm rounded-lg p-2 border border-cyan-500/20 flex-wrap gap-1 text-sm">
          <div className="text-cyan-100">
            <span className="font-semibold">Lives: </span>
            <span>{'💙'.repeat(Math.max(0, gameState.health))}<span style={{opacity: 0.3}}>{'💙'.repeat(Math.max(0, 5-Math.max(0, gameState.health)))}</span></span>
          </div>
          <div className="text-cyan-100">
            <span className="font-semibold">Score: </span>
            <span className="font-bold text-yellow-300">{gameState.score}</span>
          </div>
          <div className="text-cyan-100">
            <span className="font-semibold">Wave: </span>
            <span className="font-bold text-green-300">{gameState.wave}</span>
          </div>
          <div className="text-cyan-100">
            <span className="font-semibold">Weapon: </span>
            <span className="text-orange-300">{getBulletTypeText()}</span>
          </div>
        </div>

        {/* Zone de jeu - taille réduite avec effet de vibration */}
        <div className="flex justify-center relative">
          <canvas
            ref={canvasRef}
            width={900}
            height={700}
            className="border-2 border-cyan-500/30 rounded-lg bg-black/30 backdrop-blur-sm shadow-lg shadow-cyan-500/20 w-full h-auto"
            style={{ 
              maxHeight: "95vh",
              maxWidth: "100vw"
            }} 
          />
          
          {/* Animation de perte de cœur placée en bas de la zone de jeu */}
          {gameState.showHeartLoss && (
            <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none">
              <div 
                className="bg-black/30 backdrop-blur-sm rounded-full px-3 py-1" 
                style={{ 
                  animation: 'floatUp 1.5s forwards',
                  opacity: 1
                }}
              >
                <div 
                  className="text-xl font-bold text-blue-400" 
                  style={{ 
                    animation: 'fadeOut 1.5s forwards' 
                  }}
                >
                  💙 -1
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Contrôles - plus discret */}
        <div className="mt-2 text-center text-cyan-100/80 text-xs bg-black/20 backdrop-blur-sm rounded-lg p-2 border border-cyan-500/20">
          <p>WASD or Arrows: Movement | Auto-fire | R: Restart (if stopped)</p>
        </div>
      </div>
      
      {gameState.showGameOver && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
          <div className="bg-black/50 backdrop-blur-sm rounded-lg p-6 max-w-md w-full text-center border border-red-500/30 relative z-10">
            <h1 className="text-2xl font-bold text-red-500 mb-4 drop-shadow-lg">Mission Failed</h1>
            
            <div className="mb-4 space-y-3">
              <div className="text-cyan-100">
                <p className="text-lg">Final Score:</p>
                <p className="text-3xl font-bold text-yellow-300">{gameState.score}</p>
              </div>
              
              <div className="text-cyan-100">
                <p className="text-sm">Wave reached: <span className="font-bold text-green-300">{gameState.wave}</span></p>
              </div>

              <p className="text-cyan-100 text-sm">The aliens have conquered space!</p>
            </div>

            <div className="space-y-2">
              {/* Save progression on defeat */}
              {(!progressionSaved && playerData && stageData) && (
                <div className="hidden">
                  {submitProgression(gameState.score, false)}
                </div>
              )}
              <button
                onClick={restartGame}
                className="w-full bg-gradient-to-r from-cyan-600/80 to-blue-600/80 text-white py-2 px-4 rounded-lg 
                        font-semibold hover:from-cyan-700/90 hover:to-blue-700/90 transition-all duration-300 
                        shadow-lg border border-cyan-500/30 cursor-pointer z-20 pointer-events-auto"
              >
                New Mission
              </button>
              
              <button
                onClick={() => setGameState(prev => ({ ...prev, showGameOver: false, showWelcomeScreen: true }))}
                className="w-full bg-gradient-to-r from-gray-600/80 to-gray-700/80 text-white py-2 px-4 rounded-lg 
                        font-semibold hover:from-gray-700/90 hover:to-gray-800/90 transition-all duration-300 
                        shadow-lg border border-gray-500/30 cursor-pointer z-20 pointer-events-auto mt-2"
              >
                Back to Menu
              </button>
            </div>
          </div>
        </div>
      )}
      
      {gameState.showVictory && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
          <div className="bg-black/50 backdrop-blur-sm rounded-lg p-6 max-w-md w-full text-center border border-green-500/30 relative z-10">
            <h1 className="text-2xl font-bold text-green-500 mb-4 drop-shadow-lg">Mission Accomplished!</h1>
            
            <div className="mb-4 space-y-3">
              <div className="text-cyan-100">
                <p className="text-lg">Final Score:</p>
                <p className="text-3xl font-bold text-yellow-300">{gameState.score}</p>
              </div>
              
              <div className="text-cyan-100">
                <p className="text-sm">Wave reached: <span className="font-bold text-green-300">{gameState.wave}</span></p>
              </div>

              <div className="py-2">
                <p className="text-cyan-100 text-sm">You have defeated the alien invasion!</p>
                <div className="mt-1 text-yellow-300 text-sm animate-pulse">Congratulations!</div>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={restartGame}
                className="w-full bg-gradient-to-r from-green-600/80 to-cyan-600/80 text-white py-2 px-4 rounded-lg 
                        font-semibold hover:from-green-700/90 hover:to-cyan-700/90 transition-all duration-300 
                        shadow-lg border border-green-500/30 cursor-pointer z-20 pointer-events-auto"
              >
                New Mission
              </button>
              
              <button
                onClick={() => setGameState(prev => ({ ...prev, showVictory: false, showWelcomeScreen: true }))}
                className="w-full bg-gradient-to-r from-gray-600/80 to-gray-700/80 text-white py-2 px-4 rounded-lg 
                        font-semibold hover:from-gray-700/90 hover:to-gray-800/90 transition-all duration-300 
                        shadow-lg border border-gray-500/30 cursor-pointer z-20 pointer-events-auto mt-2"
              >
                Back to Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contrôles tactiles pour mobile: toucher et glisser pour déplacer le vaisseau */}
      {gameState.gameRunning && (
        <div
          className="absolute inset-0 z-20 md:hidden"
          onTouchStart={(e) => {
            e.preventDefault();
            const t = e.touches[0];
            if (!t) return;
            lastTouchRef.current = { x: t.clientX, y: t.clientY };
          }}
          onTouchMove={(e) => {
            e.preventDefault();
            const t = e.touches[0];
            if (!t || !lastTouchRef.current) return;
            const dx = (t.clientX - lastTouchRef.current.x) * (typeof window !== 'undefined' && window.innerWidth <= 768 ? 1.6 : 1.0);
            const dy = (t.clientY - lastTouchRef.current.y) * (typeof window !== 'undefined' && window.innerWidth <= 768 ? 1.6 : 1.0);
            lastTouchRef.current = { x: t.clientX, y: t.clientY };
            const player = gameObjectsRef.current.player;
            player.x = Math.max(20, Math.min(880, player.x + dx));
            player.y = Math.max(20, Math.min(680, player.y + dy));
          }}
          onTouchEnd={() => { lastTouchRef.current = null; }}
        />
      )}
    </div>
  );
};

export default SpaceBulletStorm;