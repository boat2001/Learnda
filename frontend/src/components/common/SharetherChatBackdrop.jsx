import { useMemo } from 'react';

const WORDMARK = 'Sharether';
const TAGLINE = 'Learn Like Never Before';

/** Logical width 100 = 100% of chat pane; approximate text half-extents in same units. */
function textHalfExtents(text, fontRem) {
  const hw = (text.length * fontRem * 3.2) / 2;
  const hh = (fontRem * 4.6) / 2;
  return { hw: Math.max(hw, 1.8), hh: Math.max(hh, 1.2) };
}

function logoHalfExtent(sidePx) {
  const h = (sidePx * 0.5) / 3.35;
  return { hw: Math.max(h, 1.2), hh: Math.max(h, 1.2) };
}

/** Axis-aligned bounds that cover a rotated rect (same center), for collision padding. */
function rotatedAabbHalf(hw, hh, rotDeg) {
  const rad = (rotDeg * Math.PI) / 180;
  const c = Math.abs(Math.cos(rad));
  const s = Math.abs(Math.sin(rad));
  return {
    hw: hw * c + hh * s,
    hh: hw * s + hh * c,
  };
}

function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace(arr, rand) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function buildShards(seedStr, logoUrl) {
  const rand = mulberry32(hashSeed(seedStr));
  const COLS = 3;
  const ROWS = 26;
  const cellW = 100 / COLS;
  const cellH = 100 / ROWS;

  const slots = [];
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      slots.push({ c, r });
    }
  }
  shuffleInPlace(slots, rand);

  const n = slots.length;
  const kinds = [];
  for (let i = 0; i < n; i += 1) {
    const roll = rand();
    if (roll < 0.55) kinds.push('logo');
    else if (roll < 0.77) kinds.push('word');
    else kinds.push('tagline');
  }

  const shards = [];

  for (let i = 0; i < n; i += 1) {
    const { c, r } = slots[i];
    const kind = kinds[i];
    const cx0 = (c + 0.5) * cellW;
    const cy0 = (r + 0.5) * cellH;
    const innerW = cellW * 0.9;
    const innerH = cellH * 0.9;
    const rot = (rand() - 0.5) * 40;

    if (kind === 'logo') {
      const side = 10 + Math.floor(rand() * 12);
      const raw = logoHalfExtent(side);
      const { hw, hh } = rotatedAabbHalf(raw.hw, raw.hh, rot);
      const jxMax = Math.max(0, cellW / 2 - hw - 0.45);
      const jyMax = Math.max(0, cellH / 2 - hh - 0.45);
      const cx = cx0 + (rand() * 2 - 1) * jxMax;
      const cy = cy0 + (rand() * 2 - 1) * jyMax;
      shards.push({
        key: `l${i}`,
        kind: 'logo',
        x: cx,
        y: cy,
        rot,
        op: 0.1 + rand() * 0.14,
        w: side,
        h: side,
        url: logoUrl,
      });
      continue;
    }

    if (kind === 'word') {
      let fontRem = innerW / (WORDMARK.length * 3.25);
      fontRem = Math.min(0.52, Math.max(0.2, fontRem * (0.92 + rand() * 0.08)));
      fontRem = Math.min(fontRem, innerH / 4.85);
      const raw = textHalfExtents(WORDMARK, fontRem);
      const { hw, hh } = rotatedAabbHalf(raw.hw, raw.hh, rot);
      const jxMax = Math.max(0, cellW / 2 - hw - 0.45);
      const jyMax = Math.max(0, cellH / 2 - hh - 0.45);
      const cx = cx0 + (rand() * 2 - 1) * jxMax;
      const cy = cy0 + (rand() * 2 - 1) * jyMax;
      shards.push({
        key: `w${i}`,
        kind: 'word',
        x: cx,
        y: cy,
        rot,
        op: 0.2 + rand() * 0.2,
        text: WORDMARK,
        fontRem,
      });
      continue;
    }

    let fontRem = innerW / (TAGLINE.length * 3.25);
    fontRem = Math.min(0.44, Math.max(0.17, fontRem * (0.92 + rand() * 0.08)));
    fontRem = Math.min(fontRem, innerH / 4.85);
    const rawT = textHalfExtents(TAGLINE, fontRem);
    const { hw, hh } = rotatedAabbHalf(rawT.hw, rawT.hh, rot);
    const jxMax = Math.max(0, cellW / 2 - hw - 0.45);
    const jyMax = Math.max(0, cellH / 2 - hh - 0.45);
    const cx = cx0 + (rand() * 2 - 1) * jxMax;
    const cy = cy0 + (rand() * 2 - 1) * jyMax;
    shards.push({
      key: `t${i}`,
      kind: 'tagline',
      x: cx,
      y: cy,
      rot,
      op: 0.18 + rand() * 0.18,
      text: TAGLINE,
      fontRem,
    });
  }

  return shards;
}

export function SharetherChatBackdrop({ patternSeed = 'sharether-chat' }) {
  const shards = useMemo(() => {
    const logoUrl = `${import.meta.env.BASE_URL}sharether-logo.webp`;
    return buildShards(patternSeed, logoUrl);
  }, [patternSeed]);

  return (
    <div className="sgr-chat__brand-watermark" aria-hidden="true">
      {shards.map((s) => {
        const base = {
          left: `${s.x}%`,
          top: `${s.y}%`,
          '--sgr-shard-rot': `${s.rot}deg`,
          '--sgr-shard-op': String(s.op),
        };

        if (s.kind === 'logo') {
          return (
            <span
              key={s.key}
              className="sgr-chat__brand-watermark__shard sgr-chat__brand-watermark__shard--logo"
              style={{
                ...base,
                width: s.w,
                height: s.h,
                backgroundImage: `url("${s.url}")`,
              }}
            />
          );
        }

        const cls =
          s.kind === 'word'
            ? 'sgr-chat__brand-watermark__shard sgr-chat__brand-watermark__shard--word'
            : 'sgr-chat__brand-watermark__shard sgr-chat__brand-watermark__shard--tagline';

        return (
          <span
            key={s.key}
            className={cls}
            style={{
              ...base,
              fontSize: `${s.fontRem}rem`,
            }}
          >
            {s.text}
          </span>
        );
      })}
    </div>
  );
}
