import { useEffect, useState } from 'react';

// Measure both ends so the greeting stays connected when the sidebar resizes.
export default function BeeGreetingLine({ heroRef, greetingRef }) {
  const [path, setPath] = useState('');

  useEffect(() => {
    const hero = heroRef.current;
    const greeting = greetingRef.current;
    const scene = hero?.querySelector('[data-bee-scene]');
    if (!hero || !greeting || !scene) return;

    const measure = () => {
      const matrix = scene.getScreenCTM();
      if (!matrix || !greeting.getClientRects().length) {
        setPath('');
        return;
      }
      const bounds = hero.getBoundingClientRect();
      const pill = greeting.getBoundingClientRect();
      const mouth = scene.createSVGPoint();
      mouth.x = 153;
      mouth.y = 195;
      const position = mouth.matrixTransform(matrix);
      const startX = position.x - bounds.left;
      const startY = position.y - bounds.top;
      const endX = pill.right - bounds.left + 5;
      const endY = pill.top - bounds.top + pill.height / 2;
      const span = startX - endX;
      // Drift left from the mouth, then rise above the copy in gentle waves.
      const shoulderX = startX - span * 0.18;
      const shoulderY = endY - 8;
      const middleX = endX + span * 0.46;
      const crestY = Math.max(8, endY - 22);
      setPath(
        `M ${startX} ${startY} ` +
        `C ${startX - 45} ${startY + 8}, ${shoulderX + 45} ${shoulderY + 35}, ${shoulderX} ${shoulderY} ` +
        `C ${shoulderX - span * 0.12} ${crestY - 12}, ${middleX + span * 0.12} ${crestY + 8}, ${middleX} ${crestY} ` +
        `C ${middleX - span * 0.16} ${crestY - 8}, ${endX + span * 0.12} ${endY - 14}, ${endX} ${endY}`
      );
    };

    const observer = new ResizeObserver(measure);
    observer.observe(hero);
    observer.observe(hero.querySelector('.landing-hero__copy'));
    observer.observe(scene);
    window.addEventListener('resize', measure);
    document.fonts.ready.then(measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [heroRef, greetingRef]);

  return (
    <svg className="landing-hero__greeting-line" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}
