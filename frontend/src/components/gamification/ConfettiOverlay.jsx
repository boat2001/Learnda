import { useEffect, useRef, useCallback } from 'react';
import './ConfettiOverlay.css';

const COLORS = ['#f72585', '#7209b7', '#3a0ca3', '#4361ee', '#4cc9f0', '#06d6a0', '#ffd166', '#ef233c'];
const GRAND_COLORS = [
  '#f72585', '#7209b7', '#4361ee', '#4cc9f0', '#06d6a0',
  '#ffd166', '#ef233c', '#FFD700', '#FF1493', '#00e5ff',
  '#ff9f1c', '#cbf3f0', '#ffffff', '#a8dadc',
];
const SHAPES = ['square', 'circle', 'ribbon'];
const GRAND_SHAPES = ['square', 'circle', 'ribbon', 'star', 'star', 'star'];

function createParticle(canvas) {
  const x = Math.random() * canvas.width;
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  return {
    x,
    y: -10,
    color,
    shape,
    size: Math.random() * 8 + 5,
    speedY: Math.random() * 3 + 2,
    speedX: (Math.random() - 0.5) * 3,
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 8,
    opacity: 1,
    wobble: Math.random() * Math.PI * 2,
    wobbleSpeed: Math.random() * 0.05 + 0.02,
    sparkle: false,
  };
}

function drawStar(ctx, size) {
  const outer = size / 2;
  const inner = outer * 0.42;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
    else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
  }
  ctx.closePath();
  ctx.fill();
}

function drawParticle(ctx, p) {
  ctx.save();
  ctx.globalAlpha = p.opacity;
  ctx.translate(p.x, p.y);
  ctx.rotate((p.rotation * Math.PI) / 180);
  ctx.fillStyle = p.color;

  if (p.shape === 'square') {
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
  } else if (p.shape === 'circle') {
    ctx.beginPath();
    ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.shape === 'star') {
    drawStar(ctx, p.size);
  } else {
    // ribbon
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
  }

  ctx.restore();
}

export default function ConfettiOverlay({ active, mode = 'burst', onDone }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const onDoneRef = useRef(onDone);

  // Keep onDoneRef pointing at the latest callback without adding it to effect deps
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  // Stable stop — no deps, uses only refs
  const stop = useCallback(() => {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    onDoneRef.current?.();
  }, []);

  useEffect(() => {
    if (!active) {
      stop();
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const ctx = canvas.getContext('2d');
    const particles = [];

    const count = mode === 'rain' ? 200 : mode === 'fireworks' ? 300 : mode === 'grand' ? 500 : 120;

    const grandCenters = mode === 'grand' ? [
      { x: canvas.width * 0.2,  y: canvas.height * 0.38 },
      { x: canvas.width * 0.5,  y: canvas.height * 0.32 },
      { x: canvas.width * 0.8,  y: canvas.height * 0.38 },
    ] : null;

    for (let i = 0; i < count; i++) {
      const p = createParticle(canvas);
      if (mode === 'rain') {
        p.y = Math.random() * -canvas.height;
      } else if (mode === 'fireworks') {
        p.x = canvas.width / 2 + (Math.random() - 0.5) * 100;
        p.y = canvas.height * 0.4 + (Math.random() - 0.5) * 100;
        p.speedX = (Math.random() - 0.5) * 12;
        p.speedY = Math.random() * -8 - 2;
      } else if (mode === 'grand') {
        const center = grandCenters[Math.floor(Math.random() * grandCenters.length)];
        p.color = GRAND_COLORS[Math.floor(Math.random() * GRAND_COLORS.length)];
        p.shape = GRAND_SHAPES[Math.floor(Math.random() * GRAND_SHAPES.length)];
        p.x = center.x + (Math.random() - 0.5) * 90;
        p.y = center.y + (Math.random() - 0.5) * 90;
        p.size = Math.random() * 12 + 5;
        p.speedX = (Math.random() - 0.5) * 18;
        p.speedY = Math.random() * -14 - 2;
        p.rotationSpeed = (Math.random() - 0.5) * 14;
        p.sparkle = Math.random() > 0.55;
      }
      particles.push(p);
    }

    let startTime = null;
    const duration = mode === 'rain' ? 3000 : mode === 'fireworks' ? 4000 : mode === 'grand' ? 6000 : 2500;
    let stopped = false;

    const animate = (timestamp) => {
      if (stopped) return;
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = elapsed / duration;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let alive = 0;
      for (const p of particles) {
        p.wobble += p.wobbleSpeed;
        p.x += p.speedX + Math.sin(p.wobble) * 0.8;
        p.y += p.speedY;
        p.rotation += p.rotationSpeed;

        if (mode === 'fireworks') {
          p.speedY += 0.15;
        }

        if (mode === 'grand') {
          p.speedY += 0.13;
          if (p.sparkle) {
            p.opacity = Math.min(1, Math.max(0.1, p.opacity + (Math.random() - 0.48) * 0.18));
          }
        }

        if (progress > 0.65) {
          const fadeProgress = (progress - 0.65) / 0.35;
          if (!p.sparkle || mode !== 'grand') {
            p.opacity = Math.max(0, 1 - fadeProgress);
          } else {
            p.opacity = Math.max(0, (1 - fadeProgress) * (0.5 + Math.random() * 0.5));
          }
        } else if (mode !== 'grand' && progress > 0.6) {
          p.opacity = Math.max(0, 1 - (progress - 0.6) / 0.4);
        }

        if (p.y < canvas.height + 20 && p.opacity > 0) {
          drawParticle(ctx, p);
          alive++;
        }
      }

      if (alive > 0 && elapsed < duration) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        animRef.current = null;
        stop();
      }
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      stopped = true;
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
    };
  }, [active, mode, stop]);

  if (!active) return null;

  return <canvas ref={canvasRef} className="confetti-overlay" aria-hidden="true" />;
}
