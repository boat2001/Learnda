import './CoursePageSkeleton.css';

const heroCoveredItems = Array.from({ length: 3 }, (_, index) => index);
const lessonCards = Array.from({ length: 4 }, (_, index) => index);
const linkCards = Array.from({ length: 2 }, (_, index) => index);

export default function CoursePageSkeleton() {
  return (
    <div className="course-page-skeleton course-detail-page" aria-busy="true" aria-live="polite">
      <div className="course-page-skeleton-breadcrumb" aria-hidden="true">
        <span className="course-page-skeleton-block course-page-skeleton-breadcrumb-chip" />
        <span className="course-page-skeleton-breadcrumb-separator" />
        <span className="course-page-skeleton-block course-page-skeleton-breadcrumb-title" />
      </div>

      <section className="course-page-skeleton-hero course-hero" aria-hidden="true">
        <div className="course-page-skeleton-hero-left course-hero-left">
          <div className="course-page-skeleton-hero-main course-hero-title-row">
            <span className="course-page-skeleton-block course-page-skeleton-hero-image" />
            <div className="course-page-skeleton-hero-copy">
              <span className="course-page-skeleton-block course-page-skeleton-title" />
              <span className="course-page-skeleton-block course-page-skeleton-meta" />
            </div>
          </div>
        </div>

        <span className="course-hero-divider course-page-skeleton-hero-divider" />

        <div className="course-page-skeleton-hero-right course-hero-right">
          <div className="course-page-skeleton-progress-card">
            <div className="course-page-skeleton-progress-top">
              <span className="course-page-skeleton-block course-page-skeleton-progress-label" />
              <span className="course-page-skeleton-block course-page-skeleton-progress-value" />
            </div>
            <span className="course-page-skeleton-block course-page-skeleton-progress-track" />
            <span className="course-page-skeleton-block course-page-skeleton-progress-copy" />
          </div>

          <div className="course-page-skeleton-covered-card">
            <span className="course-page-skeleton-block course-page-skeleton-covered-title" />
            <div className="course-page-skeleton-covered-list">
              {heroCoveredItems.map((item) => (
                <div key={`covered-${item}`} className="course-page-skeleton-covered-item">
                  <div className="course-page-skeleton-covered-copy">
                    <span className="course-page-skeleton-block course-page-skeleton-covered-label" />
                    <span className="course-page-skeleton-block course-page-skeleton-covered-count" />
                  </div>
                  <span className="course-page-skeleton-block course-page-skeleton-covered-bar" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="course-page-skeleton-section course-section" aria-hidden="true">
        <div className="course-page-skeleton-section-head course-section-header with-divider">
          <div className="course-page-skeleton-section-title-wrap course-section-head">
            <span className="course-page-skeleton-block course-page-skeleton-section-title" />
            <span className="course-page-skeleton-block course-page-skeleton-count" />
          </div>
          <hr className="course-section-divider" />
        </div>

        <div className="course-page-skeleton-card-row">
          {lessonCards.map((card) => (
            <article key={`prelim-${card}`} className="course-page-skeleton-card course-lesson-card">
              <span className="course-page-skeleton-block course-page-skeleton-card-image" />
              <div className="course-page-skeleton-card-copy">
                <span className="course-page-skeleton-block course-page-skeleton-card-title" />
                <span className="course-page-skeleton-block course-page-skeleton-card-helper" />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="course-page-skeleton-section course-section" aria-hidden="true">
        <div className="course-page-skeleton-section-head course-section-header with-divider">
          <div className="course-page-skeleton-section-title-wrap course-section-head">
            <span className="course-page-skeleton-block course-page-skeleton-section-title" />
            <span className="course-page-skeleton-block course-page-skeleton-count" />
          </div>
          <hr className="course-section-divider" />
        </div>

        <div className="course-page-skeleton-card-row">
          {lessonCards.map((card) => (
            <article key={`lesson-${card}`} className="course-page-skeleton-card course-lesson-card">
              <span className="course-page-skeleton-block course-page-skeleton-card-image" />
              <div className="course-page-skeleton-card-copy">
                <span className="course-page-skeleton-block course-page-skeleton-card-title" />
                <span className="course-page-skeleton-block course-page-skeleton-card-helper" />
                <span className="course-page-skeleton-block course-page-skeleton-card-helper short" />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="course-page-skeleton-section course-section" aria-hidden="true">
        <div className="course-page-skeleton-section-head course-section-header with-divider">
          <div className="course-page-skeleton-section-title-wrap course-section-head">
            <span className="course-page-skeleton-block course-page-skeleton-section-title" />
            <span className="course-page-skeleton-block course-page-skeleton-count" />
          </div>
          <hr className="course-section-divider" />
        </div>

        <div className="course-page-skeleton-card-row">
          {lessonCards.map((card) => (
            <article key={`video-${card}`} className="course-page-skeleton-card course-lesson-card">
              <span className="course-page-skeleton-block course-page-skeleton-card-image" />
              <div className="course-page-skeleton-card-copy">
                <span className="course-page-skeleton-block course-page-skeleton-card-title" />
                <span className="course-page-skeleton-block course-page-skeleton-card-helper" />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="course-page-skeleton-links course-section course-section-links" aria-hidden="true">
        {linkCards.map((card) => (
          <article key={`link-${card}`} className="course-page-skeleton-link-card course-links-card">
            <span className="course-page-skeleton-block course-page-skeleton-link-tag" />
            <span className="course-page-skeleton-block course-page-skeleton-link-copy" />
            <span className="course-page-skeleton-block course-page-skeleton-link-copy short" />
            <span className="course-page-skeleton-block course-page-skeleton-link-button" />
          </article>
        ))}
      </section>
    </div>
  );
}
