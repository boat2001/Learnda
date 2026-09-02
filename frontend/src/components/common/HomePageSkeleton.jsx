import './HomePageSkeleton.css';

function GuestHomeSkeleton() {
  return (
    <div className="home-skel home-skel-guest" aria-busy="true" aria-live="polite">
      <section className="home-skel-hero">
        <div className="home-skel-hero-copy">
          <span className="home-skel-pill shimmer-block" />
          <span className="home-skel-heading shimmer-block" />
          <span className="home-skel-heading shimmer-block short" />
          <span className="home-skel-text shimmer-block" />
          <span className="home-skel-text shimmer-block medium" />
          <div className="home-skel-actions">
            <span className="home-skel-btn shimmer-block" />
            <span className="home-skel-btn shimmer-block" />
            <span className="home-skel-btn shimmer-block ghost" />
          </div>
        </div>
        <div className="home-skel-hero-panel">
          {[0, 1, 2].map((index) => (
            <span key={index} className="home-skel-highlight shimmer-block" />
          ))}
        </div>
      </section>

      <section className="home-skel-section">
        <span className="home-skel-section-title shimmer-block" />
        <div className="home-skel-strip">
          {[0, 1, 2, 3].map((index) => (
            <span key={index} className="home-skel-strip-card shimmer-block" />
          ))}
        </div>
      </section>

      <section className="home-skel-section">
        <span className="home-skel-section-title shimmer-block" />
        <div className="home-skel-plans">
          {[0, 1, 2].map((index) => (
            <span key={index} className="home-skel-plan-card shimmer-block" />
          ))}
        </div>
      </section>
    </div>
  );
}

function AuthenticatedHomeSkeleton() {
  return (
    <div className="home-skel home-skel-auth" aria-busy="true" aria-live="polite">
      <section className="home-skel-greeting">
        <div className="home-skel-greeting-copy">
          <span className="home-skel-eyebrow shimmer-block" />
          <span className="home-skel-heading shimmer-block" />
          <span className="home-skel-text shimmer-block medium" />
        </div>
        <span className="home-skel-art shimmer-block" />
      </section>

      <span className="home-skel-banner shimmer-block" />

      <section className="home-skel-section">
        <span className="home-skel-section-title shimmer-block" />

        <div className="home-skel-explore-row row-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="home-skel-explore-card">
              <span className="home-skel-icon shimmer-block" />
              <span className="home-skel-line shimmer-block" />
            </div>
          ))}
        </div>

        <div className="home-skel-explore-row row-2">
          {[0, 1].map((index) => (
            <div key={index} className="home-skel-explore-card wide">
              <span className="home-skel-icon shimmer-block" />
              <span className="home-skel-line shimmer-block" />
            </div>
          ))}
        </div>

        <div className="home-skel-explore-row row-2">
          {[0, 1].map((index) => (
            <div key={index} className="home-skel-explore-card wide">
              <span className="home-skel-icon shimmer-block" />
              <span className="home-skel-line shimmer-block" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function HomePageSkeleton({ isAuthenticated = false }) {
  return isAuthenticated ? <AuthenticatedHomeSkeleton /> : <GuestHomeSkeleton />;
}
