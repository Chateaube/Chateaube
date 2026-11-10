import React, { useEffect, useRef } from 'react';
import graduation from '../assets/graduation.json';

// Animation de l'écran de chargement (fichier Lottie « Graduation », LottieFiles, licence libre).
// Le lecteur est chargé à part ; s'il échoue (vieux téléphone), il ne reste que le texte. Les personnes qui
// limitent les animations sur leur appareil voient une image fixe.
export default function LoadingAnimation({ size = 160 }) {
  const box = useRef(null);
  useEffect(() => {
    let anim; let stop = false;
    import('lottie-web/build/player/lottie_light').then(({ default: lottie }) => {
      if (stop || !box.current) return;
      const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      anim = lottie.loadAnimation({ container: box.current, renderer: 'svg', loop: true, autoplay: !still, animationData: graduation });
      if (still) anim.goToAndStop(30, true);
    }).catch(() => { /* sans animation */ });
    return () => { stop = true; anim?.destroy(); };
  }, []);
  return <div ref={box} aria-hidden="true" style={{ width: size, height: size }} className="mx-auto" />;
}
