import { useEffect, useRef, useState } from 'react';

/**
 * LessonIllustration
 * Renders lesson illustrations. Local Sharether SVG diagrams
 * (/lesson-images/*.svg) are fetched and inlined into the DOM so that
 * CSS/JS interactivity inside the SVG works (hover, tap-to-reveal,
 * animations). Anything else — photos, external URLs — renders as a
 * plain <img> with the usual fallback behaviour.
 *
 * Scripts are only ever executed for same-origin /lesson-images/ assets,
 * which are part of the app bundle (trusted, versioned with the code).
 */

const LOCAL_INTERACTIVE_SVG = /^\/lesson-images\/[^?#]+\.svg$/i;

export const isLocalLessonSvg = (src) =>
  typeof src === 'string' && LOCAL_INTERACTIVE_SVG.test(src.trim());

const svgTextCache = new Map();

const fetchSvgText = (src) => {
  if (!svgTextCache.has(src)) {
    svgTextCache.set(
      src,
      fetch(src, { credentials: 'same-origin' })
        .then((response) => {
          if (!response.ok) throw new Error(`Failed to load ${src}`);
          return response.text();
        })
        .catch((error) => {
          svgTextCache.delete(src);
          throw error;
        })
    );
  }
  return svgTextCache.get(src);
};

const injectSvg = (host, svgText, alt) => {
  const parsed = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const svg = parsed.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== 'svg') {
    throw new Error('Not a valid SVG document');
  }

  // Responsive sizing: rely on viewBox, never fixed pixel dimensions.
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.setAttribute('preserveAspectRatio', svg.getAttribute('preserveAspectRatio') || 'xMidYMid meet');
  if (!svg.getAttribute('role')) svg.setAttribute('role', 'img');
  if (alt && !svg.getAttribute('aria-label')) svg.setAttribute('aria-label', alt);

  const adopted = document.importNode(svg, true);

  // Re-create script nodes so embedded interactivity actually runs
  // (innerHTML/importNode does not execute <script> elements).
  const scripts = Array.from(adopted.querySelectorAll('script'));
  scripts.forEach((oldScript) => {
    const replacement = document.createElementNS('http://www.w3.org/2000/svg', 'script');
    Array.from(oldScript.attributes).forEach((attr) => {
      replacement.setAttribute(attr.name, attr.value);
    });
    replacement.textContent = oldScript.textContent;
    oldScript.parentNode.replaceChild(replacement, oldScript);
  });

  host.innerHTML = '';
  host.appendChild(adopted);
};

const LessonIllustration = ({ src, alt = '', fallbackSrc = '', className = '' }) => {
  const hostRef = useRef(null);
  const [inlineFailed, setInlineFailed] = useState(false);
  const useInline = isLocalLessonSvg(src) && !inlineFailed;

  useEffect(() => {
    if (!useInline) return undefined;
    let cancelled = false;
    const host = hostRef.current;

    fetchSvgText(src.trim())
      .then((text) => {
        if (cancelled || !hostRef.current) return;
        injectSvg(hostRef.current, text, alt);
      })
      .catch(() => {
        if (!cancelled) setInlineFailed(true);
      });

    return () => {
      cancelled = true;
      if (host) host.innerHTML = '';
    };
  }, [src, alt, useInline]);

  useEffect(() => {
    setInlineFailed(false);
  }, [src]);

  if (useInline) {
    return <div ref={hostRef} className={`lesson-illustration-inline-svg ${className}`.trim()} />;
  }

  return (
    <img
      src={inlineFailed && !src ? fallbackSrc : src}
      alt={alt}
      className={className || undefined}
      loading="lazy"
      onError={(event) => {
        if (fallbackSrc && event.currentTarget.src !== fallbackSrc) {
          event.currentTarget.src = fallbackSrc;
        }
      }}
    />
  );
};

export default LessonIllustration;
