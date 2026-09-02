import { useNavigate } from 'react-router-dom';
import {
  FiUsers, FiGlobe, FiEdit, FiMapPin, FiRefreshCw,
  FiHeart, FiDollarSign,
} from 'react-icons/fi';
import './SharedPages.css';
import './About.css';
import './Team.css';

const CHAPTERS = [
  {
    id: 'spark',
    year: 'January 2022',
    label: 'The Spark',
    color: '#26c9d0',
    Icon: FiMapPin,
    headline: 'Denied. Shut out. And somehow, still showing up.',
    summary: [
      "In January 2022, Kwabena came to Foso College of Education wanting to study Mathematics and ICT, but was placed in Performing Arts. He applied to switch programmes. They said no. But he didn't leave. He kept attending Maths and IT lectures, buying their books, and even wrote the external quizzes with them, even though he wasn't officially in the programme.",
      "Then, just weeks before final exams, he was told he couldn't write with them. He was denied an index number. All that effort, and he couldn't write a single exam. He had to return to his original programme, now far behind.",
      "He needed course materials fast, but physical copies were hard to come by at that stage. That struggle planted an idea, what if there was one place where every student could find everything they needed, at any time? And with that, the spark of Learnda was born.",
    ],
  },
  {
    id: 'build',
    year: '2022',
    label: 'The Build',
    color: '#fab82c',
    Icon: FiEdit,
    headline: 'No laptop. Just code, a flash drive, and a reason.',
    summary: "After exams, vacation started, and that's when the work began. He sat down at his brother's desktop computer and started coding. PHP. MySQL. HTML. CSS. JavaScript. He worked day and night. Not for any reward, but because he knew what it felt like to be a student with nowhere to turn for files. Back on campus, he had no laptop of his own. Bismark offered his, so the work could keep going. Two full vacations of building later, Learnda was done.",
  },
  {
    id: 'launch',
    year: 'February 7, 2023',
    label: 'Going Live',
    color: '#60a5fa',
    Icon: FiGlobe,
    headline: 'The name changed. The mission never did.',
    summary: "The platform was first called Foscoshare, after the college. But that name felt too small. The motto, \"Let's share and learn together\", gave a better idea. Take \"share\" and \"together\", press them into one word: Learnda. To get it online, close friends and siblings chipped in for the domain and hosting. On February 7, 2023, learnda.app went live. The link went into school WhatsApp groups, and within hours, students who had been struggling to find materials were finally getting what they needed.",
  },
  {
    id: 'people',
    year: '2023',
    label: 'Not Alone',
    color: '#f472b6',
    Icon: FiHeart,
    headline: 'I reached out. And people came.',
    summary: [
      "Once the platform was live, the scope of what still needed to happen became clear. Sir Philip and Sis. Abigail, the SRC Academic Coordinators, were already scanning files at the library and stepped in to help build up the course material collection.",
      "Think Twice, who had already been sharing files on WhatsApp for students long before Learnda existed, joined to help grow the content and community. Mubarack, who had built a COE past questions app, and Sarkodie, another programmer, came in to help with development.",
      "Pedro, Sir Rahman, and Sikapa, iTech executives, gave their time, knowledge, and experience freely. Gideon Ofori, Akwasi Obeng, Stephen Boateng, and Sir Paul offered early financial support to keep things going, and Sir Paul also designed the flyers that helped put Learnda in front of more students.",
      "Fosco's ICT officer, Mr. Eddie Essel Dadzie, gave guidance on hosting and domain matters. Christopher and Ohojo literally took the platform to people through a campaign. And when a video was needed, Arhinsco made it.",
      "Learnda was started alone. But it was carried forward by people who believed it was worth carrying.",
    ],
  },
  {
    id: 'growth',
    year: '2024 – 2025',
    label: 'Growing Strong',
    color: '#a78bfa',
    Icon: FiUsers,
    headline: 'Other students found it. And everything shifted.',
    summary: "Learnda was built for Fosco. But students from other colleges across Ghana started reaching out, asking to be included, sending in their materials, hoping they hadn't been forgotten. College after college was added until Learnda covered every UCC-affiliated college of education in Ghana. A resource that began as the answer to one student's problem at one college had grown into something the whole country could use.",
  },
  {
    id: 'expanding',
    year: '2026 – Present',
    label: 'Expanding',
    color: '#34d399',
    Icon: FiRefreshCw,
    headline: 'Rebuilt to last. Designed to go further.',
    summary: [
      "With a more stable foundation in place, the focus shifted to building something that could grow with the students using it. Learnda was rebuilt from the ground up in React and Node.js, faster, more reliable, and ready for what was coming next.",
      "A proper mobile experience was added. New features designed to make studying more engaging are being rolled out. The platform that started as a simple file-sharing site is becoming a full learning companion. There's still a lot ahead. But for the first time, the foundation is strong enough to hold it.",
    ],
  },
  {
    id: 'contribution',
    year: '2026 – Present',
    label: 'Staying Alive',
    color: '#fb923c',
    Icon: FiDollarSign,
    headline: 'Free to use was never free to run.',
    summary: [
      "Learnda had been running free for users since it launched. But there were always real expenses behind it, domain, hosting, storage, and SSL certificate. Those were funded by the team and some generous people. But the amount being contributed sometimes wasn't enough to cover everything.",
      "Advertisements were added at one point to help generate some funds. But they were so distracting and annoying that users complained, and they were removed. Without money coming in, users kept seeing domain expirations, hosting shutdowns, and long stretches of downtime.",
      "A call went out for contributions. Some people gave funds, and every one of them is appreciated. But very few people contributed, which made things unfair. Some people were funding a platform others used for free.",
      "To fix this, the cost needed to be shared evenly, so everyone pays for what they need, and all those small contributions together cover the expenses of keeping the platform running for everyone. That brought in the contribution model.",
      "Files are free to access and will always be free, but with some limits. Free Learners get the content and tools for one course, along with access to other platform features. Helpers who contribute GH₵5 get access to four courses, plus downloads, study groups, and more. Heroes who contribute GH₵10 get access to everything Learnda has to offer. Whenever you contribute, consider it a direct contribution to keep Learnda alive for every student who needs it.",
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
          The site that began as a simple place to access past questions and learning resources
          is now an interactive learning platform built to make learning interesting, simple and collaborative. <br />
          And the funny thing is that, we&rsquo;re just getting started. <br />
          Thank you for being part of this journey.
        </blockquote>
        <div className="tm-celebrate__author">
          <img
            src={`${import.meta.env.BASE_URL}team/members/boateng.jpg`}
            alt="Kwabena Boateng"
            className="tm-celebrate__photo"
          />
          <div className="tm-celebrate__author-text">
            <strong className="tm-celebrate__name">Kwabena Boateng Adjei</strong>
            <span className="tm-celebrate__role">Founder &amp; CEO, Learnda</span>
          </div>
        </div>
      </div>

      {/* Origin Story Timeline */}
      <section className="page-section">
        <div className="section-heading section-heading--wide">
          <h2>How it all started</h2>
          <p>From the ideation, through development, to deployment and to a platform that helps thousands of students learn.</p>
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
