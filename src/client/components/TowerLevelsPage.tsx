import { useState, useEffect, useRef } from 'react';
import { usePlayerData } from '../hooks/usePlayerData';
import { Stage } from '../../shared/types/stage';

interface Level {
  id: number;
  level: number;
  isUnlocked: boolean;
  isCompleted: boolean;
  stars: number;
  stage?: Stage; // Référence vers l'étage de la BD
}

interface TowerLevelsPageProps {
  onLevelSelect: (levelId: number, stageName?: string) => void;
  onHomeClick: () => void;
}

export const TowerLevelsPage = ({ onLevelSelect, onHomeClick }: TowerLevelsPageProps) => {
  const [levels, setLevels] = useState<Level[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loadingStages, setLoadingStages] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const levelRefs = useRef<Record<number, HTMLDivElement | null>>({});
  
  // Utiliser le hook de données joueur
  const { player, stats, loading, error, initializePlayer } = usePlayerData();

  // Récupérer les étages depuis la base de données
  useEffect(() => {
    const loadStages = async () => {
      try {
        setLoadingStages(true);
        const response = await fetch('/api/stages');
        const result = await response.json();
        
        if (result.status === 'success') {
          // Trier les étages par niveau
          const sortedStages = result.data.sort((a: Stage, b: Stage) => a.niveau - b.niveau);
          setStages(sortedStages);
        } else {
          console.error('Failed to load stages:', result.message);
          setStages([]); // Fallback: aucun étage
        }
      } catch (err) {
        console.error('Error loading stages:', err);
        setStages([]); // Fallback: aucun étage
      } finally {
        setLoadingStages(false);
      }
    };

    loadStages();
  }, []);

  // Initialiser le joueur au chargement de la page
  useEffect(() => {
    initializePlayer();
  }, []);

  // Générer les niveaux basés sur les étages de la BD et les données du joueur
  useEffect(() => {
    if (loadingStages) return; // Attendre que les étages soient chargés

    if (stages.length === 0) {
      // Aucun étage dans la BD, pas de niveaux à afficher
      setLevels([]);
      return;
    }

    const generatedLevels = stages.map((stage) => {
      const isCompleted = stats ? stats.levels_completed.includes(stage.niveau) : false;
      const isUnlocked = player ? stage.niveau <= player.etage_actuel : stage.niveau === 1; // Seul le niveau 1 débloqué par défaut
      const starsForLevel = stats ? stats.stars_per_level[stage.niveau] || 0 : 0;

      return {
        id: stage.id,
        level: stage.niveau,
        isCompleted,
        isUnlocked,
        stars: starsForLevel,
        stage, // Référence vers l'étage complet
      };
    });

    setLevels(generatedLevels);
  }, [stages, player, stats, loadingStages]);

  // Scroll automatique vers le niveau le plus haut débloqué
  useEffect(() => {
    if (levels.length === 0) return;
    const highestUnlocked = levels.reduce((acc, l) => (l.isUnlocked && l.level > acc ? l.level : acc), 1);
    
    const targetEl = levelRefs.current[highestUnlocked];
    const scroller = scrollRef.current;
    if (!targetEl || !scroller) return;
    
    setTimeout(() => {
      const rect = targetEl.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();
      const targetCenter = rect.top + rect.height / 2;
      const scrollerCenter = scrollerRect.top + scrollerRect.height / 2;
      
      scroller.scrollBy({
        top: targetCenter - scrollerCenter,
        behavior: 'smooth'
      });
    }, 500);
  }, [levels]);

  const getLevelStatus = (level: Level) => {
    return level.isCompleted ? 'completed' : level.isUnlocked ? 'unlocked' : 'locked';
  };

  // Affichage pendant le chargement
  if (loadingStages || loading) {
    return (
      <div className="min-h-screen w-full bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-4xl mb-4">⏳</div>
          <div className="text-xl">Loading levels...</div>
        </div>
      </div>
    );
  }

  // Affichage en cas d'erreur
  if (error) {
    return (
      <div className="min-h-screen w-full bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-4xl mb-4">❌</div>
          <div className="text-xl mb-4">Erreur lors du chargement</div>
          <button
            onClick={onHomeClick}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  // Affichage si aucun niveau n'est disponible
  if (stages.length === 0) {
    return (
      <div className="min-h-screen w-full bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-4xl mb-4">🏗️</div>
          <div className="text-xl mb-4">Aucun niveau disponible</div>
          <div className="text-gray-400 mb-4">Les niveaux n'ont pas encore été créés par l'administrateur.</div>
          <button
            onClick={onHomeClick}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full relative overflow-hidden flex flex-col">
      {/* Image de fond en tant qu'élément img (comme snoo.png) */}
      <img 
        src="/levels.jpg"
        alt="Background"
        className="absolute inset-0 w-full h-full object-cover z-0"
        onError={(e) => {
          console.error('Failed to load levels.jpg');
          // Fallback vers un fond sombre
          e.currentTarget.style.display = 'none';
        }}
        onLoad={() => console.log('levels.jpg loaded successfully')}
      />
      
      {/* Pas d'overlay pour l'instant - on veut voir l'image */}
      {/* Header */}
      <div className="relative z-20 flex items-center justify-between p-4 md:p-6 w-full">
        <button
          onClick={onHomeClick}
          className="px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-800 text-white rounded-lg hover:from-gray-500 hover:to-gray-700 transition-all duration-300 flex items-center gap-2"
        >
          <span className="text-lg">🏠</span>
          Accueil
        </button>
        
        <div className="text-center">
          <h1 className="text-2xl md:text-4xl font-bold text-white">
            TOWER OF CHALLENGES
          </h1>
          <p className="text-sm md:text-lg text-gray-300 mt-2">
            Gravissez la tour niveau par niveau
          </p>
        </div>
        
        {/* Informations du joueur */}
        <div className="flex flex-col items-end gap-1">
          {player ? (
            <>
              <div className="text-white font-bold text-sm">
                {player.username}
              </div>
              <div className="text-yellow-400 font-bold text-xs flex items-center gap-1">
                ⭐ {player.score_global}
              </div>
              <div className="text-gray-300 text-xs">
                Étage {player.etage_actuel}
              </div>
            </>
          ) : (
            <div className="text-gray-400 text-sm">
              Chargement...
            </div>
          )}
        </div>
      </div>

      {/* Levels List - FROM BOTTOM TO TOP */}
      <div 
        className="relative z-20 h-[calc(100vh-120px)] overflow-y-auto py-8 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        ref={scrollRef}
      >
        <div className="max-w-xs sm:max-w-sm mx-auto px-4 flex flex-col gap-6 sm:gap-8">
          {/* Coming Soon - EN HAUT */}
          <div className="flex justify-center">
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-purple-600 via-pink-500 to-orange-500 rounded-2xl shadow-2xl flex items-center justify-center mx-auto border-2 border-purple-300 animate-pulse">
              <div className="text-white font-bold text-center">
                <div className="text-2xl sm:text-3xl mb-1">🔮</div>
                <div className="text-xs font-extrabold tracking-wider">COMING<br/>SOON</div>
              </div>
              {/* Effet de lueur */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-400 to-pink-400 opacity-20 animate-ping"></div>
            </div>
          </div>
          
          {/* Regular Levels - du niveau le plus haut vers le plus bas */}
          {levels.slice().reverse().map((level, index) => {
            const status = getLevelStatus(level);
            const isEven = level.level % 2 === 0;
            
            return (
              <div 
                key={level.id}
                className="flex justify-center transform transition-all duration-500 hover:scale-105"
                style={{ 
                  animationDelay: `${index * 100}ms`,
                  animation: 'fadeInUp 0.6s ease-out forwards'
                }}
                ref={(el: HTMLDivElement | null) => {
                  levelRefs.current[level.level] = el;
                }}
              >
                <div className="relative group">
                  {/* Niveau principal avec design amélioré */}
                  <div
                    className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl shadow-2xl cursor-pointer transition-all duration-300 flex items-center justify-center border-2 transform group-hover:rotate-3 group-hover:scale-110 ${
                      status === 'completed'
                        ? 'bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 border-emerald-300 shadow-emerald-500/50'
                        : status === 'unlocked'
                        ? `bg-gradient-to-br ${isEven ? 'from-blue-500 via-indigo-500 to-purple-600' : 'from-cyan-500 via-blue-500 to-indigo-600'} border-blue-300 shadow-blue-500/50 hover:shadow-blue-400/70`
                        : 'bg-gradient-to-br from-gray-600 via-gray-700 to-gray-800 border-gray-500 opacity-60'
                    }`}
                    onClick={() => {
                      if (status === 'locked') return;
                      onLevelSelect(level.id, level.stage?.nom);
                    }}
                  >
                    {/* Numéro du niveau avec style amélioré */}
                    <div className={`text-white font-black text-xl sm:text-2xl ${status === 'locked' ? 'hidden' : ''}`}>
                      {level.level}
                    </div>

                    {/* Icône de verrouillage améliorée */}
                    {status === 'locked' && (
                      <div className="text-gray-300 text-2xl">🔒</div>
                    )}

                    {/* Indicateur de completion avec animation */}
                    {status === 'completed' && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center border-2 border-white shadow-lg animate-bounce">
                        <span className="text-white text-sm font-bold">✓</span>
                      </div>
                    )}

                    {/* Effet de brillance pour les niveaux débloqués */}
                    {status === 'unlocked' && (
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    )}

                    {/* Particules flottantes pour les niveaux complétés */}
                    {status === 'completed' && (
                      <>
                        <div className="absolute -top-1 -left-1 w-2 h-2 bg-yellow-300 rounded-full animate-ping opacity-75"></div>
                        <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-green-300 rounded-full animate-ping opacity-75" style={{ animationDelay: '0.5s' }}></div>
                      </>
                    )}
                  </div>

                  {/* Étoiles pour les niveaux complétés - design amélioré */}
                  {status === 'completed' && level.stars > 0 && (
                    <div className="flex justify-center mt-2 gap-1">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <span
                          key={i}
                          className={`text-base transition-all duration-300 ${
                            i < level.stars 
                              ? 'text-yellow-400 drop-shadow-lg animate-pulse' 
                              : 'text-gray-500'
                          }`}
                          style={{ animationDelay: `${i * 200}ms` }}
                        >
                          ⭐
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Indication de niveau débloqué */}
                  {status === 'unlocked' && (
                    <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2">
                      <div className="px-2 py-1 bg-blue-500 text-white text-xs rounded-full font-semibold shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        Disponible
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* CSS Animations pour les améliorations */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes levelPulse {
          0%, 100% {
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.5);
          }
          50% {
            box-shadow: 0 0 40px rgba(59, 130, 246, 0.8);
          }
        }
        
        .group:hover .animate-levelPulse {
          animation: levelPulse 2s infinite;
        }
      `}</style>
    </div>
  );
};
