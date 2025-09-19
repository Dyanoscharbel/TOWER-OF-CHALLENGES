import { useState, useEffect } from 'react';
import { navigateTo } from '@devvit/web/client';
import { useCounter } from './hooks/useCounter';
import { LoadingScreen } from './components/LoadingScreen';
import { HomePage } from './components/HomePage';
import ProfilePage from './components/ProfilePage';
import MedievalGameSubmissionForm from './components/MedievalGameSubmissionForm';
import { TowerLevelsPage } from './components/TowerLevelsPage';
import { LeaderboardPage } from './components/LeaderboardPage';
import { AdminPage } from './components/AdminPag';
import ClickGame from './components/jeux/Reaction Dash';
import ColorsClickGame from './components/jeux/Color Click Game';
import WordExpressGame from './components/jeux/Word Express';
import MemoryCardsTwist from './components/jeux/Tiles Match';
import FallingLettersGame from './components/jeux/Falling Letters';
import { FlappyEscape } from './components/jeux/FlappyEscape';
import Game2048 from './components/jeux/2048 Challenge';
import Tetris from './components/jeux/Tetris';
import CheckersDuel from './components/jeux/Checkers Duel';
import SpaceBulletStorm from './components/jeux/Bulletstorm';

export const App = () => {
  const [showLoading, setShowLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<'loading' | 'home' | 'levels' | 'counter' | 'options' | 'leaderboard' | 'admin' | 'game' | 'profile' | 'medieval_form'>('loading');
  const [currentGame, setCurrentGame] = useState<string | null>(null);
  const { count, username, loading, increment, decrement } = useCounter();
  const [audioReady, setAudioReady] = useState(false);
  const audioRef = (window as any).__bgAudioRef || { current: null };
  (window as any).__bgAudioRef = audioRef;

  // Gestionnaire de raccourcis clavier pour l'admin
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl + Shift + A pour accéder à l'admin
      if (event.ctrlKey && event.shiftKey && event.key === 'A') {
        event.preventDefault();
        handleAdminAccess();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLoadingComplete = () => {
    setShowLoading(false);
    setCurrentPage('levels');
  };

  const handlePlayClick = () => {
    setCurrentPage('levels');
  };

  const handleOptionsClick = () => {
    setCurrentPage('profile');
  };

  const handleLeaderboardClick = () => {
    setCurrentPage('leaderboard');
  };

  // Fonction pour accéder à l'admin (peut être appelée depuis la console ou avec un raccourci clavier)
  const handleAdminAccess = () => {
    setCurrentPage('admin');
  };

  // Exposer la fonction admin globalement pour le debug
  useEffect(() => {
    (window as any).openAdmin = handleAdminAccess;
    (window as any).__setPage = (p: string) => setCurrentPage(p as any);
    return () => {
      delete (window as any).openAdmin;
      delete (window as any).__setPage;
    };
  }, []);

  // Initialize tower stages if missing
  useEffect(() => {
    const seedStagesIfMissing = async () => {
      try {
        const desired = [
          { id: 1, nom: 'Reaction Dash', description: 'You have 10 hearts. If you let an icon fall without clicking it, you lose a heart—except for bomb icons, which you should avoid. Losing all hearts ends the game.', regles: 'Click the icons to keep your hearts. Avoid letting icons fall, except bombs. If all hearts are lost, the game is over. Reach 4000 to clear the level', niveau: 1, target_score: 4000 },
          { id: 2, nom: 'Color Click Game', description: 'A word representing a color is displayed on the screen, but the text is shown in a different color. You must click the correct color, not the word itself.', regles: 'Select the actual color of the text, not the written word. Time is extremely limited, so react quickly!Reach 600 to clear the level', niveau: 2, target_score: 600 },
          { id: 3, nom: 'Word Express', description: 'A set of letters is provided. Your task is to form as many valid words as possible from those letters.', regles: 'Use the given letters to create different words. The more words you find, the higher your score. Reach 100 toclear the level', niveau: 3, target_score: 100 },
          { id: 4, nom: 'Tiles Match', description: 'All the cards are briefly revealed, then flipped over. You must match the pairs of identical cards.', regles: 'Memorize the positions of the cards before they are flipped. Match two identical cards to score points. Reach 2000 to clear the level', niveau: 4, target_score: 2000 },
          { id: 5, nom: 'Falling Letters', description: 'Random letters fall from the top of the screen. You must type them  target word.', regles: 'Type the falling letters . Completing the word gives bonus points. Reach 3500 to clear the level', niveau: 5, target_score: 3500 },
          { id: 6, nom: 'Flappy Escape', description: 'A bird must fly through a series of obstacles without crashing. The longer you survive, the higher your score.', regles: 'Tap to keep the bird flying and avoid hitting the obstacles. Passing through each gap gives points. Reach 1500 to clear the level', niveau: 6, target_score: 1500 },
          { id: 7, nom: '2048 Challenge', description: 'A sliding puzzle game where you combine tiles with the same number to reach higher values.', regles: 'Swipe to merge tiles. Reach 2048 to clear the level', niveau: 7, target_score: 1000 },
          { id: 8, nom: 'Tetris', description: 'Classic block puzzle game where different shapes fall, and you must arrange them to form complete rows.', regles: 'Rotate and move blocks to complete horizontal lines. Each cleared line gives points. Survive as long as possible! Reach 2000 to clear the level', niveau: 8, target_score: 2000 },
          { id: 9, nom: 'Checkers Duel', description: 'Play checkers against the AI. Both you and the machine have 3 hearts. Losing a match costs one heart.', regles: 'Defeat the AI in checkers before you lose all your hearts. The first to lose all hearts is defeated.', niveau: 9, target_score: 1000 },
          { id: 10, nom: 'Bulletstorm', description: 'A space shooter where you fight waves of enemy ships. After several waves, a boss appears and must be defeated.', regles: 'Dodge bullets, destroy enemy ships, and defeat the boss to complete the level. Surviving longer increases your score.', niveau: 10, target_score: 1000 },
        ];
        const res = await fetch('/api/stages');
        const json = await res.json();
        const existing = (json?.data || json) as Array<any>;
        const have = new Set((existing || []).map((s: any) => (s && typeof s.niveau === 'number') ? s.niveau : undefined));
        for (const st of desired) {
          if (!have.has(st.niveau)) {
            try {
              await fetch('/api/admin/stages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nom: st.nom, description: st.description, regles: st.regles, niveau: st.niveau, target_score: st.target_score })
              });
            } catch (_) {}
          }
        }
      } catch (_) {}
    };
    seedStagesIfMissing();
  }, []);

  // Musique de fond en boucle (avec reprise sur interaction si autoplay bloqué)
  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio('/Background.mp3');
      audio.loop = true;
      audio.preload = 'auto';
      // init from localStorage
      const storedVol = window.localStorage.getItem('bgmVolume');
      const storedMuted = window.localStorage.getItem('bgmMuted');
      const volNum = storedVol ? Math.max(0, Math.min(1, parseFloat(storedVol))) : 0.5;
      audio.volume = Number.isFinite(volNum) ? volNum : 0.5;
      audio.muted = storedMuted === 'true';
      audioRef.current = audio;
      
      const tryPlay = () => {
        audio.play().then(() => setAudioReady(true)).catch(() => setAudioReady(false));
      };
      
      // Try to play immediately
      tryPlay();
      
      // Add multiple event listeners for mobile compatibility
      const resume = () => {
        if (!audioReady && !audio.muted) {
          audio.play().then(() => setAudioReady(true)).catch(() => {});
        }
      };
      
      // Add listeners for various interaction types
      window.addEventListener('pointerdown', resume, { once: true });
      window.addEventListener('keydown', resume, { once: true });
      window.addEventListener('touchstart', resume, { once: true });
      window.addEventListener('click', resume, { once: true });
      
      // Also try to resume when the page becomes visible (mobile specific)
      const handleVisibilityChange = () => {
        if (!document.hidden && !audioReady && !audio.muted) {
          audio.play().then(() => setAudioReady(true)).catch(() => {});
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [audioReady]);

  // Diminuer/Restaurer le volume de la musique lors de l'entrée/sortie d'un niveau
  useEffect(() => {
    const audio: HTMLAudioElement | null = audioRef.current;
    if (!audio) return;
    const target = currentPage === 'game' ? 0.18 : 0.5;
    const durationMs = 400;
    const steps = 8;
    const stepTime = Math.max(16, Math.floor(durationMs / steps));
    const start = audio.volume;
    const delta = target - start;
    let i = 0;
    const id = window.setInterval(() => {
      i++;
      const v = start + (delta * i) / steps;
      audio.volume = Math.max(0, Math.min(1, v));
      if (i >= steps) window.clearInterval(id);
    }, stepTime);
    return () => window.clearInterval(id);
  }, [currentPage]);

  const handleLevelSelect = (levelId: number, stageName?: string) => {
    console.log('Level selected:', levelId, 'Stage:', stageName);
    
    if (stageName) {
      // Normaliser le nom de l'étage pour correspondre aux noms de fichiers
      const gameFileName = stageName.toLowerCase().replace(/\s+/g, ' ');
      setCurrentGame(gameFileName);
      setCurrentPage('game');
    } else {
      // Fallback vers le compteur si pas de nom d'étage
      setCurrentPage('counter');
    }
  };

  const handleHomeClick = () => {
    setCurrentPage('home');
  };

  // Afficher l'écran de chargement pendant 10 secondes
  if (showLoading || currentPage === 'loading') {
    return <LoadingScreen onLoadingComplete={handleLoadingComplete} />;
  }

  // Afficher la page d'accueil
  if (currentPage === 'home') {
    return (
      <HomePage 
        onPlayClick={handlePlayClick}
        onOptionsClick={handleOptionsClick}
        onLeaderboardClick={handleLeaderboardClick}
        // onAdminClick={handleAdminAccess}

      />
    );
  }

  // Afficher la page des niveaux de la tour
  if (currentPage === 'levels') {
    return (
      <TowerLevelsPage 
        onLevelSelect={handleLevelSelect}
        onHomeClick={handleHomeClick}
      />
    );
  }

  if (currentPage === 'profile') {
    return <ProfilePage onBack={() => setCurrentPage('home')} />;
  }

  if (currentPage === 'medieval_form') {
    return <MedievalGameSubmissionForm onBack={() => setCurrentPage('home')} />;
  }

  // Afficher la page du leaderboard
  if (currentPage === 'leaderboard') {
    return (
      <LeaderboardPage 
        onHomeClick={handleHomeClick}
      />
    );
  }

  // Afficher la page d'administration
  if (currentPage === 'admin') {
    return (
      <AdminPage 
        onHomeClick={handleHomeClick}
      />
    );
  }

  // Afficher la page de jeu
  if (currentPage === 'game' && currentGame) {
    // Mapping des noms de jeux vers leurs composants
    const gameComponents: { [key: string]: React.ComponentType<any> } = {
      'reaction dash': ClickGame,
      'color click game': ColorsClickGame,
      'word express': WordExpressGame,
      'tiles match': MemoryCardsTwist,
      'falling letters': FallingLettersGame,
      'flappy escape': FlappyEscape,
      '2048 challenge': Game2048,
      'tetris': Tetris,
      'checkers duel': CheckersDuel,
      'bulletstorm': SpaceBulletStorm,
    };

    const GameComponent = gameComponents[currentGame];
    
    if (GameComponent) {
      return (
        <GameComponent 
          onBack={() => setCurrentPage('levels')}
        />
      );
    } else {
      // Jeu non trouvé, retourner vers les niveaux
      console.warn(`Jeu "${currentGame}" non trouvé`);
      setCurrentPage('levels');
      return null;
    }
  }

  // Afficher l'app compteur originale
  return (
    <div className="flex relative flex-col justify-center items-center min-h-screen gap-4">
      {/* Bouton retour vers l'accueil */}
      <button
        onClick={() => setCurrentPage('home')}
        className="absolute top-4 left-4 px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-800 text-white rounded-lg hover:from-gray-500 hover:to-gray-700 transition-all duration-300 flex items-center gap-2"
      >
        ← Back
      </button>

      <img className="object-contain w-1/2 max-w-[250px] mx-auto" src="/snoo.png" alt="Snoo" />
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-2xl font-bold text-center text-gray-900 ">
          {username ? `Hey ${username} 👋` : ''}
        </h1>
        <p className="text-base text-center text-gray-600 ">
          Compteur de test - Retournez aux niveaux avec le bouton ci-dessus
        </p>
      </div>
      <div className="flex items-center justify-center mt-5">
        <button
          className="flex items-center justify-center bg-[#d93900] text-white w-14 h-14 text-[2.5em] rounded-full cursor-pointer font-mono leading-none transition-colors"
          onClick={decrement}
          disabled={loading}
        >
          -
        </button>
        <span className="text-[1.8em] font-medium mx-5 min-w-[50px] text-center leading-none text-gray-900">
          {loading ? '...' : count}
        </span>
        <button
          className="flex items-center justify-center bg-[#d93900] text-white w-14 h-14 text-[2.5em] rounded-full cursor-pointer font-mono leading-none transition-colors"
          onClick={increment}
          disabled={loading}
        >
          +
        </button>
      </div>
      <footer className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3 text-[0.8em] text-gray-600">
        <button
          className="cursor-pointer"
          onClick={() => navigateTo('https://developers.reddit.com/docs')}
        >
          Docs
        </button>
        <span className="text-gray-300">|</span>
        <button
          className="cursor-pointer"
          onClick={() => navigateTo('https://www.reddit.com/r/Devvit')}
        >
          r/Devvit
        </button>
        <span className="text-gray-300">|</span>
        <button
          className="cursor-pointer"
          onClick={() => navigateTo('https://discord.com/invite/R7yu2wh9Qz')}
        >
          Discord
        </button>
      </footer>
    </div>
  );
};
