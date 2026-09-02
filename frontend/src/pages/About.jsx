import { useNavigate } from 'react-router-dom';
import {
  FiUsers, FiGlobe, FiEdit, FiMapPin, FiRefreshCw,
  FiHeart, FiDollarSign,
} from 'react-icons/fi';
import './SharedPages.css';
import './About.css';
import './Team.css';

// Learnda's own story. The previous chapters narrated the founder's experience
// at a Ghanaian college of education, the "share + together" naming, and the
// GH₵5 / GH₵10 contribution tiers -- all inherited from the platform Learnda
// was forked from, and none of it true of Learnda (dev guide §10, §14).
const CHAPTERS = [
  {
    id: 'problem',
    year: 'The problem',
    label: 'One class at a time',
    color: '#fb6334',
    Icon: FiMapPin,
    headline: 'Most learning apps let children wander anywhere.',
    summary: [
      'A learner opens an app and can tap into any topic at any level. It looks generous. In practice a Basic 3 child meets JHS work they cannot yet read, decides they are bad at the subject, and stops.',
      'Ghanaian schooling does not work that way. A learner sits in one class for one year, studies what that class teaches, and moves up when the year turns. That structure is not a limitation — it is what makes learning feel possible.',
    ],
  },
  {
    id: 'approach',
    year: 'The approach',
    label: 'The real school timeline',
    color: '#3e7fdd',
    Icon: FiGlobe,
    headline: 'Learnda mirrors the school year, not a content library.',
    summary: [
      'Every lesson, practice set and question in Learnda is tied to exactly one class, from KG 1 to SHS 3. You study your class. You can revise every class behind you, as often as you like. Classes ahead of you stay closed until the school year turns.',
      'Nobody can skip ahead, and nobody has to. Progression happens the way it happens at school: by the calendar, confirmed by an adult, never by choosing it in a menu.',
    ],
  },
  {
    id: 'curriculum',
    year: 'The curriculum',
    label: 'Aligned to NaCCA',
    color: '#73a24b',
    Icon: FiEdit,
    headline: 'Ghana’s curriculum, not a generic one.',
    summary: [
      'Kindergarten follows Learning Areas — Language and Literacy, Numeracy, Environmental Studies, Creative Arts and the rest — taught through audio and pictures, with no tests at all.',
      'Basic school covers the NaCCA subjects including Our World Our People, Ghanaian Language and Culture, Computing and French. JHS builds towards BECE. SHS adds learning areas and electives, from Science and General Arts through Business, Applied Technology, Home Economics, Art, Agriculture, Languages and STEM.',
    ],
  },
  {
    id: 'age',
    year: 'The learners',
    label: 'Built for the age in front of it',
    color: '#fab82c',
    Icon: FiHeart,
    headline: 'A five-year-old and a seventeen-year-old need different apps.',
    summary: [
      'Kindergarten gets big pictures, tap-to-listen audio and no text walls. There are no quizzes, no exams, no scores and no chat — the app is for looking, listening and playing, and a parent sits alongside.',
      'Basic school keeps the visuals and adds gentle practice. JHS and SHS get structured lessons, heavier practice and exam preparation, with community and study groups opening up only at that age.',
    ],
  },
  {
    id: 'access',
    year: 'Access',
    label: 'Wherever learners are',
    color: '#1f3049',
    Icon: FiUsers,
    headline: 'Ghana is not evenly connected, and learning should not depend on that.',
    summary: [
      'Lessons work offline once opened, at every level, so a learner in a town with patchy data is not locked out of their own class.',
      'Audio matters as much as text. A learner who reads slowly, or not yet at all, should still be able to use the app on their own.',
    ],
  },
];


export default function About() {
  const navigate = useNavigate();

  return (
    <div className="page-shell">

      {/* Hero */}
      <section className="page-hero hero-theme-mission page-hero-compact">
        <div className="hero-grid">
          <div>
            <span className="hero-tag">Our story</span>
            <h1 className="hero-title">One student's problem.<br />Every student's solution.</h1>
            <div className="hero-actions">
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => navigate('/team')}
              >
                Meet the team
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CEO quote */}
      <div className="tm-celebrate about-ceo-quote">
        <span className="tm-celebrate__mark" aria-hidden="true">&ldquo;</span>
        <blockquote className="tm-celebrate__line">
          Learnda follows Ghana&rsquo;s real education timeline. <br />
          Subjects are taught only at the learner&rsquo;s class level. <br />
          Progression happens by academic year, not by choice.
        </blockquote>
      </div>

      {/* Origin Story Timeline */}
      <section className="page-section">
        <div className="section-heading section-heading--wide">
          <h2>Why Learnda works this way</h2>
          <p>Five decisions that shape everything in the app, from Kindergarten through Senior High School.</p>
        </div>
        <div className="about-timeline">
          {CHAPTERS.map((chapter, index) => {
            const { Icon } = chapter;
            const isLast = index === CHAPTERS.length - 1;
            return (
              <div
                key={chapter.id}
                className="about-chapter"
                style={{ '--chapter-color': chapter.color }}
              >
                <div className="about-chapter__rail">
                  <div className="about-chapter__dot">
                    <Icon className="about-chapter__dot-icon" aria-hidden="true" />
                  </div>
                  {!isLast && <div className="about-chapter__line" />}
                </div>
                <div className="about-chapter__card">
                  <div className="about-chapter__meta">
                    <span className="about-chapter__badge">{chapter.label}</span>
                    <span className="about-chapter__year">{chapter.year}</span>
                  </div>
                  <h3 className="about-chapter__headline">{chapter.headline}</h3>
                  {Array.isArray(chapter.summary) ? (
                    chapter.summary.map((para, i) => (
                      <p key={i} className="about-chapter__body">{para}</p>
                    ))
                  ) : (
                    <p className="about-chapter__body">{chapter.summary}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Mission and Values */}
      <section className="page-section split-grid about-mv-grid">
        <div className="info-card about-mv-card about-mv-card--mission">
          <h3>Our mission</h3>
          <p>
            &ldquo;To make learning simple, fun, and accessible to every student.&rdquo; That&rsquo;s our north star &mdash; guiding every decision, every feature, every update. We believe education should be an interesting journey, not a stressful struggle.
          </p>
          <div className="pill-row">
            <span className="pill">Accessibility</span>
            <span className="pill">Collaboration</span>
            <span className="pill">Student-first</span>
          </div>
        </div>
        <div className="info-card about-mv-card about-mv-card--values">
          <h3>Our values</h3>
          <p>
            Built with integrity. Designed for calmness. Focused on learning experiences that feel
            human &mdash; not corporate, not algorithmic, just genuinely useful for real students.
          </p>
          <div className="pill-row">
            <span className="pill">Simplicity</span>
            <span className="pill">Transparency</span>
            <span className="pill">Community</span>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="page-section about-cta-grid">
        <div className="info-card">
          <h3>Join the team</h3>
          <p>Learnda is student-built and student-run. Contribute your skills &mdash; dev, design, content &mdash; and help build it.</p>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => navigate('/contribute')}
          >
            Get involved
          </button>
        </div>
        <div className="info-card">
          <h3>Support the mission</h3>
          <p>Every contribution helps Learnda to keep growing, stay updated, and remain accessible for every student who needs it.</p>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => navigate('/contribute')}
          >
            Contribute funds
          </button>
        </div>
      </section>


    </div>
  );
}
