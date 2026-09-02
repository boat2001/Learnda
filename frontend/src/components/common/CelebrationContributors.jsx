import { useEffect, useRef } from 'react';
import './CelebrationContributors.css';

const CONFETTI = [
  { left: '4%',  bg: '#fab82c', dur: '3.5s', delay: '0s',    w: 8,  h: 8,  r: 2 },
  { left: '11%', bg: '#34d399', dur: '4.1s', delay: '0.4s',  w: 6,  h: 10, r: 1 },
  { left: '17%', bg: '#38bdf8', dur: '3.2s', delay: '0.8s',  w: 8,  h: 8,  r: 4 },
  { left: '24%', bg: '#f97316', dur: '4.6s', delay: '1.2s',  w: 10, h: 5,  r: 1 },
  { left: '31%', bg: '#fab82c', dur: '3.8s', delay: '0.5s',  w: 7,  h: 7,  r: 2 },
  { left: '39%', bg: '#818cf8', dur: '4.3s', delay: '1.5s',  w: 8,  h: 8,  r: 4 },
  { left: '47%', bg: '#10b981', dur: '3.6s', delay: '0.2s',  w: 6,  h: 9,  r: 1 },
  { left: '54%', bg: '#fab82c', dur: '4.9s', delay: '0.9s',  w: 9,  h: 5,  r: 2 },
  { left: '61%', bg: '#f97316', dur: '3.3s', delay: '1.7s',  w: 7,  h: 7,  r: 3 },
  { left: '69%', bg: '#0ea5e9', dur: '4.1s', delay: '0.4s',  w: 8,  h: 8,  r: 4 },
  { left: '76%', bg: '#6366f1', dur: '3.9s', delay: '1.3s',  w: 6,  h: 10, r: 1 },
  { left: '83%', bg: '#fab82c', dur: '4.4s', delay: '0.6s',  w: 10, h: 6,  r: 2 },
  { left: '89%', bg: '#10b981', dur: '3.7s', delay: '1.9s',  w: 7,  h: 7,  r: 3 },
  { left: '95%', bg: '#f97316', dur: '4.7s', delay: '0.1s',  w: 8,  h: 8,  r: 4 },
  { left: '8%',  bg: '#6366f1', dur: '3.4s', delay: '2.1s',  w: 6,  h: 6,  r: 3 },
  { left: '21%', bg: '#0ea5e9', dur: '4.2s', delay: '2.3s',  w: 9,  h: 5,  r: 1 },
  { left: '43%', bg: '#fab82c', dur: '3.1s', delay: '2.5s',  w: 6,  h: 11, r: 1 },
  { left: '66%', bg: '#34d399', dur: '4.8s', delay: '2.7s',  w: 8,  h: 8,  r: 4 },
  { left: '78%', bg: '#f97316', dur: '3.9s', delay: '2.9s',  w: 7,  h: 7,  r: 2 },
  { left: '52%', bg: '#818cf8', dur: '4.0s', delay: '3.1s',  w: 6,  h: 6,  r: 3 },
];

// Saturated colours that show clearly on both light and dark backgrounds
const FIREWORK_PALETTES = [
  ['#fab82c', '#d97706', '#fbbf24'],
  ['#10b981', '#059669', '#34d399'],
  ['#0ea5e9', '#0284c7', '#38bdf8'],
  ['#ea580c', '#c2410c', '#f97316'],
  ['#6366f1', '#4f46e5', '#818cf8'],
  ['#e11d48', '#be123c', '#fb7185'],
];

const CC_ACCENTS = ['#fab82c', '#10b981', '#0ea5e9', '#f97316', '#6366f1'];

const getInitials = (name = '') =>
  String(name).trim().split(/\s+/).filter(Boolean)
    .map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';

export default function CelebrationContributors({ contributors = [], totalAmount }) {
  const canvasRef = useRef(null);
  const tickerRef = useRef(null);

  // Canvas fireworks — no shadowBlur (expensive), no save/restore per particle
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    let particles = [];
    let rafId;
    let lastLaunch = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width  = parent.offsetWidth;
      canvas.height = parent.offsetHeight;
    };
    resize();

    const obs = new ResizeObserver(resize);
    if (canvas.parentElement) obs.observe(canvas.parentElement);

    const launch = () => {
      const x = canvas.width  * 0.1 + Math.random() * canvas.width  * 0.8;
      const y = canvas.height * 0.05 + Math.random() * canvas.height * 0.5;
      const palette = FIREWORK_PALETTES[Math.floor(Math.random() * FIREWORK_PALETTES.length)];
      const count = 40 + Math.floor(Math.random() * 20); // 40–60 particles
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
        const speed = Math.random() * 4 + 1;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.2,
          color: palette[Math.floor(Math.random() * palette.length)],
          alpha: 1,
          radius: Math.random() * 2.2 + 0.8,
          decay:   0.008 + Math.random() * 0.009,
          gravity: 0.05  + Math.random() * 0.04,
        });
      }
    };

    const animate = (ts) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (ts - lastLaunch > 1600) { launch(); lastLaunch = ts; }

      // Update
      for (const p of particles) {
        p.x  += p.vx;
        p.y  += p.vy;
        p.vy += p.gravity;
        p.vx *= 0.986;
        p.alpha -= p.decay;
      }
      particles = particles.filter((p) => p.alpha > 0.02);

      // Draw — single globalAlpha + fillStyle change per particle, zero shadow
      for (const p of particles) {
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle   = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(rafId); obs.disconnect(); };
  }, []);

  // Auto-scroll ticker
  useEffect(() => {
    const el = tickerRef.current;
    if (!el) return undefined;
    let rafId, paused = false, lastTime = null;
    const SPEED = 22;

    const tick = (ts) => {
      if (lastTime !== null && !paused) {
        el.scrollLeft += (SPEED * (ts - lastTime)) / 1000;
        if (el.scrollLeft >= el.scrollWidth - el.clientWidth) el.scrollLeft = 0;
      }
      lastTime = ts;
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    const pause  = () => { paused = true; };
    const resume = () => { paused = false; };
    el.addEventListener('mouseenter', pause);
    el.addEventListener('mouseleave', resume);
    el.addEventListener('touchstart', pause,  { passive: true });
    el.addEventListener('touchend',   resume, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      el.removeEventListener('mouseenter', pause);
      el.removeEventListener('mouseleave', resume);
      el.removeEventListener('touchstart', pause);
      el.removeEventListener('touchend',   resume);
    };
  }, [contributors]);

  return (
    <div className="cc-stage">
      <canvas ref={canvasRef} className="cc-fireworks" aria-hidden="true" />

      <div className="cc-confetti-wrap" aria-hidden="true">
        {CONFETTI.map((c, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: '-12px',
              left: c.left,
              width:  `${c.w}px`,
              height: `${c.h}px`,
              background:  c.bg,
              borderRadius:`${c.r}px`,
              animation:   `cc-fall ${c.dur} linear ${c.delay} infinite`,
              pointerEvents: 'none',
            }}
          />
        ))}
      </div>

      <div className="cc-content">
      <div className="cc-header">
        <span className="cc-header__emoji" aria-hidden="true">🎉</span>
        <h2 className="cc-header__title">Thank You, Contributors!</h2>
        <p className="cc-header__subtitle">
          These people brought Learnda back when it went down. Every contribution mattered. They are our superheroes. Let&apos;s celebrate them.
        </p>
        <div className="cc-stats">
          <div className="cc-stat">
            <span className="cc-stat__num">{contributors.length}</span>
            <span className="cc-stat__label">contributors</span>
          </div>
          {totalAmount && (
            <>
              <div className="cc-stat-divider" aria-hidden="true" />
              <div className="cc-stat">
                <span className="cc-stat__num">GHS {totalAmount.toLocaleString()}</span>
                <span className="cc-stat__label">contributed</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div ref={tickerRef} className="cc-ticker" role="list">
        {contributors.map((c, i) => (
          <div
            key={c.id ?? i}
            className="cc-card"
            role="listitem"
            style={{
              '--cc-accent': CC_ACCENTS[i % CC_ACCENTS.length],
              '--cc-delay':  `${(i * 0.15) % 2.5}s`,
            }}
          >
            <div className="cc-card__shine" aria-hidden="true" />
            <div className="cc-card__avatar">{getInitials(c.name)}</div>
            <strong className="cc-card__name">{c.name}</strong>
            {c.from && <span className="cc-card__from">{c.from}</span>}
            {c.amount && <span className="cc-card__amount">GHS {c.amount}</span>}
          </div>
        ))}
      </div>

      <div className="cc-sparkles" aria-hidden="true">
        {['⭐', '🌟', '✨', '🌟', '⭐', '✨', '🌟'].map((s, i) => (
          <span key={i} className="cc-sparkle" style={{ animationDelay: `${i * 0.22}s` }}>{s}</span>
        ))}
      </div>
      </div>{/* end cc-content */}
    </div>
  );
}
