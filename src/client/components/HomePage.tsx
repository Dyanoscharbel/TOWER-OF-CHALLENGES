import { useDeviceDetection } from '../hooks/useDeviceDetection';

interface HomePageProps {
  onPlayClick: () => void;
  onOptionsClick: () => void;
  onLeaderboardClick: () => void;
  onAdminClick?: () => void;
}

export const HomePage = ({ onPlayClick, onOptionsClick, onLeaderboardClick, onAdminClick }: HomePageProps) => {
  const { isMobile } = useDeviceDetection();

  // Même logique d'image que l'écran de chargement
  const imageSrc = isMobile ? '/tour_phone.jpg' : '/tour_pas_phone.jpg';

  return (
    <div className="fixed inset-0 w-full h-full relative">
      {/* Image de fond en tant qu'élément img (comme l'écran de chargement) */}
      <img 
        src={imageSrc}
        alt="Home background"
        className="absolute inset-0 w-full h-full object-cover"
        onError={(e) => {
          console.error('Failed to load image:', imageSrc);
          // En cas d'erreur, essayons avec snoo.png
          e.currentTarget.src = '/snoo.png';
        }}
      />
      
      {/* Icône de coupe en haut à gauche */}
      <button
        onClick={onLeaderboardClick}
        className="absolute top-6 left-6 z-20 p-3 bg-gradient-to-r from-yellow-600 to-orange-600 text-white rounded-full shadow-2xl transform transition-all duration-300 hover:scale-110 hover:from-yellow-500 hover:to-orange-500 border-2 border-yellow-400"
        title="Leaderboard"
      >
        <div className="text-2xl">🏆</div>
      </button>

      {/* Globe icon top-right to open MedievalGameSubmissionForm */}
      <button
        onClick={() => (window as any).__setPage && (window as any).__setPage('medieval_form')}
        className="absolute top-6 right-6 z-20 p-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-full shadow-2xl transform transition-all duration-300 hover:scale-110 hover:from-blue-500 hover:to-cyan-500 border-2 border-blue-400"
        title="World / Submit"
      >
        <div className="text-2xl">🌍</div>
      </button>

      {/* Contenu de la page d'accueil */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative z-10 flex flex-col items-center justify-center text-white">
          {/* Logo TOWER OF CHALLENGES */}
          <div className="mb-16" style={{ animation: 'title-glow 2s ease-in-out infinite' }}>
            <h1 className="text-6xl md:text-8xl font-bold text-center mb-4 bg-gradient-to-r from-purple-400 via-pink-500 to-orange-500 bg-clip-text text-transparent">
              TOWER
            </h1>
            <h2 className="text-4xl md:text-6xl font-bold text-center bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              OF CHALLENGES
            </h2>
          </div>
          
          {/* Boutons du menu principal */}
          <div className="flex flex-col gap-6 items-center">
            {/* Bouton Play */}
            <button
              onClick={onPlayClick}
              className="group relative px-12 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xl font-bold rounded-2xl shadow-2xl transform transition-all duration-300 hover:scale-110 hover:from-purple-500 hover:to-blue-500 border-2 border-purple-300"
              style={{ minWidth: '200px' }}
            >
              <div className="flex items-center justify-center">
                <span>PLAY</span>
              </div>
              {/* Effet de brillance au hover */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </button>

            {/* Bouton Options */}
            <button
              onClick={onOptionsClick}
              className="group relative px-12 py-4 bg-gradient-to-r from-gray-600 to-gray-800 text-white text-xl font-bold rounded-2xl shadow-2xl transform transition-all duration-300 hover:scale-110 hover:from-gray-500 hover:to-gray-700 border-2 border-gray-400"
              style={{ minWidth: '200px' }}
            >
              <div className="flex items-center justify-center gap-3">
                <span>OPTIONS</span>
              </div>
              {/* Effet de brillance au hover */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </button>

            {/* Bouton Administration (affiché seulement si fourni) */}
            {onAdminClick && (
              <button
                onClick={onAdminClick}
                className="group relative px-12 py-4 bg-gradient-to-r from-red-600 to-pink-600 text-white text-xl font-bold rounded-2xl shadow-2xl transform transition-all duration-300 hover:scale-110 hover:from-red-500 hover:to-pink-500 border-2 border-red-400"
                style={{ minWidth: '200px' }}
              >
                <div className="flex items-center justify-center gap-3">
                  <span>⚙️</span>
                  <span>ADMIN</span>
                </div>
                {/* Effet de brillance au hover */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </button>
            )}
          </div>
          
          {/* Particules flottantes décoratives */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="absolute w-3 h-3 bg-purple-400 rounded-full opacity-60"
                style={{
                  left: `${15 + i * 10}%`,
                  animation: `float-particles ${4 + i}s linear infinite`,
                  animationDelay: `${i * 0.7}s`
                }}
              />
            ))}
          </div>
        </div>
      </div>
      
      {/* CSS pour les animations */}
      <style>{`
        /* Animation de pulsation pour le titre */
        @keyframes title-glow {
          0%, 100% {
            filter: drop-shadow(0 0 10px rgba(168, 85, 247, 0.5));
          }
          50% {
            filter: drop-shadow(0 0 20px rgba(168, 85, 247, 0.8));
          }
        }
        
        /* Animation de particules flottantes */
        @keyframes float-particles {
          0% {
            transform: translateY(100vh) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(-100px) rotate(360deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};
