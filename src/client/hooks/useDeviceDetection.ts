import { useState, useEffect } from 'react';

export const useDeviceDetection = () => {
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const checkDevice = () => {
      // Vérifie la largeur de l'écran
      const isMobileWidth = window.innerWidth <= 768;
      
      // Vérifie le user agent pour détecter les appareils mobiles
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
      
      // Vérifie si c'est un écran tactile
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      setIsMobile(isMobileWidth || isMobileUA || isTouchDevice);
    };

    checkDevice();
    
    // Écoute les changements de taille d'écran
    window.addEventListener('resize', checkDevice);
    
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  return { isMobile };
};
