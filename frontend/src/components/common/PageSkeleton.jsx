import './PageSkeleton.css';

export default function PageSkeleton({
  title = 'Loading Sharether',
  subtitle = 'Preparing your next screen.',
  cardCount = 6,
  compact = false,
}) {
  const cards = Array.from({ length: Math.max(1, cardCount) }, (_, index) => index);

  return (
    <div className={`page-skeleton ${compact ? 'compact' : ''}`} aria-busy="true" aria-live="polite">
      <div className="page-skeleton-shell">
        <div className="page-skeleton-hero">
          <span className="page-skeleton-chip shimmer-block" />
          <span className="page-skeleton-title shimmer-block" />
          <span className="page-skeleton-subtitle shimmer-block" />
          <p className="page-skeleton-copy">{title}</p>
          <p className="page-skeleton-caption">{subtitle}</p>
        </div>

        <div className="page-skeleton-toolbar">
          <span className="page-skeleton-input shimmer-block" />
          <span className="page-skeleton-filter shimmer-block" />
          <span className="page-skeleton-filter shimmer-block" />
          <span className="page-skeleton-filter shimmer-block" />
        </div>

        <div className="page-skeleton-grid">
          {cards.map((card) => (
            <article key={card} className="page-skeleton-card">
              <div className="page-skeleton-card-image shimmer-block" />
              <div className="page-skeleton-card-lines">
                <span className="page-skeleton-line long shimmer-block" />
                <span className="page-skeleton-line medium shimmer-block" />
                <span className="page-skeleton-line short shimmer-block" />
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
