// The landing page.
//
// Two readers: a learner who wants to start, and the parent or guardian who
// will decide whether to let them (and often pays for the data). The page
// answers the parent's questions in order: what is it, does it match what my
// child does in school, is it safe, and will it work on our phone.
import { Link } from 'react-router-dom';
import { useRef } from 'react';
import {
  MdArrowForward,
  MdLock,
  MdCheckCircle,
  MdShield,
  MdSignalCellularAlt,
  MdMenuBook,
  MdEventRepeat,
  MdSchool,
} from 'react-icons/md';
import usePageTitle from '../../hooks/usePageTitle';
import ClassJourney from '../../components/learning/ClassJourney';
import BeeLesson from './BeeLesson';
import BeeGreetingLine from './BeeGreetingLine';

const openAuth = (mode) => {
  window.dispatchEvent(new CustomEvent('openAuthModal', { detail: mode }));
};

const STAGES = [
  {
    key: 'kg',
    color: 'orange',
    name: 'Kindergarten',
    classes: 'KG 1 – KG 2',
    points: ['Big pictures, tap to hear', 'Learn through play', 'A grown-up guides each step'],
  },
  {
    key: 'primary',
    color: 'amber',
    name: 'Primary',
    classes: 'Basic 1 – Basic 6',
    points: ['Simple words and pictures', 'Gentle quizzes after each topic', 'Computing and French from Basic 1'],
  },
  {
    key: 'jhs',
    color: 'green',
    name: 'Junior High',
    classes: 'JHS 1 – JHS 3',
    points: ['Step-by-step lessons', 'Plenty of practice', 'Ready for BECE'],
  },
  {
    key: 'shs',
    color: 'blue',
    name: 'Senior High',
    classes: 'SHS 1 – SHS 3',
    points: ['Core subjects plus your electives', 'Every learning area, Science to Languages', 'Ready for WASSCE'],
  },
];

const STEPS = [
  {
    icon: MdSchool,
    title: 'Tell us your class',
    text: 'Basic 4, JHS 2, SHS 1... whatever class you are in at school right now.',
  },
  {
    icon: MdMenuBook,
    title: 'Learn this term’s lessons',
    text: 'Only your class’s topics, in the order your teacher covers them.',
  },
  {
    icon: MdEventRepeat,
    title: 'Revise and move up',
    text: 'Go back over earlier classes any time. Next class opens with the new school year.',
  },
];

const PROMISES = [
  {
    icon: MdCheckCircle,
    title: 'Follows the NaCCA curriculum',
    text: 'The same subjects and topics your child meets in a Ghanaian classroom.',
  },
  {
    icon: MdLock,
    title: 'Their class, nothing above it',
    text: 'Children see work for their own class. Higher classes stay locked.',
  },
  {
    icon: MdShield,
    title: 'No chatting for young children',
    text: 'Kindergarten and Primary have no messaging or community at all.',
  },
  {
    icon: MdSignalCellularAlt,
    title: 'Light on data',
    text: 'Works on any smartphone and keeps working when the network is slow.',
  },
];

export default function GuestHome() {
  usePageTitle('Learn one class at a time');
  const heroRef = useRef(null);
  const greetingRef = useRef(null);

  return (
    <div className="landing">
      <section className="landing-hero" ref={heroRef}>
        <BeeGreetingLine heroRef={heroRef} greetingRef={greetingRef} />
        <div className="landing-hero__copy">
          <span className="landing-hero__greet" ref={greetingRef}>Akwaaba!</span>
          <h1 className="landing-hero__title">
            Learn, <span>one class at a time.</span>
          </h1>
          <p className="landing-hero__lead">
            Lessons, practice and revision for every class from KG&nbsp;1 to SHS&nbsp;3,
            following Ghana’s school curriculum.
          </p>
          <div className="landing-hero__actions">
            <button type="button" className="btn btn-primary btn-lg" onClick={() => openAuth('register')}>
              Start learning free <MdArrowForward aria-hidden="true" />
            </button>
            <button type="button" className="btn btn-secondary btn-lg" onClick={() => openAuth('login')}>
              I already have an account
            </button>
          </div>
          <p className="landing-hero__note">Free to join. A parent can set it up in two minutes.</p>
        </div>
        <BeeLesson />
      </section>

      <section className="landing-section" aria-labelledby="journey-title">
        <header className="landing-section__head">
          <h2 id="journey-title">Every class, KG 1 to SHS 3</h2>
          <p>Learnda moves with your child through school, one class each school year.</p>
        </header>
        <div className="landing-journey">
          <ClassJourney />
        </div>
        <div className="stage-grid">
          {STAGES.map((stage) => (
            <article
              key={stage.key}
              className="stage-card"
              style={{ '--stage': `var(--brand-${stage.color})`, '--stage-tint': `var(--tint-${stage.color})`, '--stage-ink': `var(--ink-${stage.color})` }}
            >
              <span className="stage-card__classes">{stage.classes}</span>
              <h3 className="stage-card__name">{stage.name}</h3>
              <ul className="stage-card__points">
                {stage.points.map((point) => (
                  <li key={point}><MdCheckCircle aria-hidden="true" /> {point}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section" aria-labelledby="how-title">
        <header className="landing-section__head">
          <h2 id="how-title">How it works</h2>
        </header>
        <ol className="steps">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className="step">
                <span className="step__num">{i + 1}</span>
                <div className="step__head">
                  <span className="step__icon" aria-hidden="true"><Icon /></span>
                  <h3 className="step__title">{step.title}</h3>
                </div>
                <p className="step__text">{step.text}</p>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="landing-section landing-parents" aria-labelledby="parents-title">
        <header className="landing-section__head">
          <span className="landing-section__eyebrow">For parents and guardians</span>
          <h2 id="parents-title">Made to be safe for children</h2>
        </header>
        <div className="promise-grid">
          {PROMISES.map((promise) => {
            const Icon = promise.icon;
            return (
              <article key={promise.title} className="promise">
                <span className="promise__icon" aria-hidden="true"><Icon /></span>
                <div>
                  <h3 className="promise__title">{promise.title}</h3>
                  <p className="promise__text">{promise.text}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="landing-cta">
        <span className="kente-band landing-cta__band" aria-hidden="true" />
        <h2>Ready for this term?</h2>
        <p>Pick your class and start your first lesson today.</p>
        <div className="landing-cta__actions">
          <button type="button" className="btn btn-accent btn-lg" onClick={() => openAuth('register')}>
            Start learning free <MdArrowForward aria-hidden="true" />
          </button>
          <Link to="/user-manual" className="landing-cta__link">How Learnda works</Link>
        </div>
      </section>
    </div>
  );
}
