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

  // Musique de fond en boucle (avec reprise sur interaction si autoplay bloqué)
  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio('/Background.mp3');
      audio.loop = true;
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
      tryPlay();
      const resume = () => {
        if (!audioReady) {
          audio.play().then(() => setAudioReady(true)).catch(() => {});
        }
      };
      window.addEventListener('pointerdown', resume, { once: true });
      window.addEventListener('keydown', resume, { once: true });
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
        onAdminClick={handleAdminAccess}
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
