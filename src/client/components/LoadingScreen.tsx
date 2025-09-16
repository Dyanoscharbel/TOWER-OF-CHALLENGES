import { useEffect, useState } from 'react';
import { useDeviceDetection } from '../hooks/useDeviceDetection';

interface LoadingScreenProps {
  onLoadingComplete: () => void;
}

export const LoadingScreen = ({ onLoadingComplete }: LoadingScreenProps) => {
  const { isMobile } = useDeviceDetection();
  const [progress, setProgress] = useState(0);
  
  // Démarrer le timer de 10 secondes avec progression
  useEffect(() => {
    const timer = setTimeout(() => {
      onLoadingComplete();
    }, 10000); // 10 secondes

    // Animation du pourcentage
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) return 100;
        return prev + 1;
      });
    }, 100); // Mise à jour toutes les 100ms pour arriver à 100% en 10s

    return () => {
      clearTimeout(timer);
      clearInterval(progressInterval);
    };
  }, [onLoadingComplete]);

  // Test simple : utilisons la même approche que snoo.png dans App.tsx
  const imageSrc = isMobile ? '/tour_phone.jpg' : '/tour_pas_phone.jpg';


  return (
    <div className="fixed inset-0 w-full h-full relative">
      {/* Image de fond en tant qu'élément img (comme snoo.png) */}
      <img 
        src={imageSrc}
        alt="Loading background"
        className="absolute inset-0 w-full h-full object-cover"
        onError={(e) => {
          console.error('Failed to load image:', imageSrc);
          // En cas d'erreur, essayons avec tour_phone.jpg
          e.currentTarget.src = '/tour_phone.jpg';
        }}
        onLoad={() => console.log('Image loaded successfully:', imageSrc)}
      />
      
      {/* Contenu de l'écran de chargement */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative z-10 flex flex-col items-center justify-center text-white">
          {/* Logo TOWER OF CHALLENGES */}
          <div className="mb-12" style={{ animation: 'title-glow 2s ease-in-out infinite' }}>
            <h1 className="text-5xl font-bold text-center mb-4 bg-gradient-to-r from-purple-400 via-pink-500 to-orange-500 bg-clip-text text-transparent">
              TOWER
            </h1>
            <h2 className="text-3xl font-bold text-center bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              OF CHALLENGES
            </h2>
          </div>
          
          {/* Texte de chargement */}
          <div className="mb-8">
            <p className="text-xl text-center opacity-90 text-white font-medium">
              Loading...
            </p>
          </div>
          
          {/* Barre de progression violette améliorée */}
          <div className="w-80 mb-4">
            <div className="bg-gray-800 bg-opacity-50 rounded-full h-3 shadow-inner">
              <div 
                className="h-3 rounded-full bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 shadow-lg"
                style={{ 
                  width: '0%',
                  animation: 'loading-progress 10s linear forwards',
                  boxShadow: '0 0 20px rgba(168, 85, 247, 0.6)'
                }}
              ></div>
            </div>
          </div>
          
          {/* Pourcentage de progression */}
          <div className="text-center">
            <span className="text-lg font-semibold text-purple-300">
              {progress}%
            </span>
          </div>
          
          {/* Particules flottantes décoratives */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 bg-purple-400 rounded-full opacity-60"
                style={{
                  left: `${20 + i * 15}%`,
                  animation: `float-particles ${4 + i}s linear infinite`,
                  animationDelay: `${i * 0.5}s`
                }}
              />
            ))}
          </div>
        </div>
      </div>
      
      {/* CSS pour les animations améliorées */}
      <style>{`
        @keyframes loading-progress {
          from { width: 0% }
          to { width: 100% }
        }
        
        @keyframes percentage-count {
          0% { opacity: 1; }
          100% { opacity: 1; }
        }
        
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
