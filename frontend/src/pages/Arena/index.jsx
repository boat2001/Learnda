// Arena — a competition field where learners test themselves against each
// other in quiz-show style rounds. Replaces My Space in the main navigation.
//
// The competition itself isn't built yet; this page introduces the rounds
// and points learners to Practice in the meantime.
import { Link } from 'react-router-dom';
import {
  MdQuiz, MdBolt, MdFunctions, MdRule, MdPsychology,
} from 'react-icons/md';
import usePageTitle from '../../hooks/usePageTitle';
import PageHeader from '../../components/common/PageHeader';
import './Arena.css';

const ROUNDS = [
  { key: 'general', icon: MdQuiz, name: 'General round', text: 'Questions on every subject in your class. Answer correctly to put points on the board.' },
  { key: 'speed', icon: MdBolt, name: 'Speed race', text: 'Quick-fire questions against the clock. The fastest correct answer wins the point.' },
  { key: 'problem', icon: MdFunctions, name: 'Problem of the day', text: 'One harder problem to work through step by step before time runs out.' },
  { key: 'truefalse', icon: MdRule, name: 'True or false', text: 'Decide fast. Every right call earns points, every wrong one costs you.' },
  { key: 'riddles', icon: MdPsychology, name: 'Riddles', text: 'Clues arrive one at a time. Guess early for more points.' },
];

export default function Arena() {
  usePageTitle('Arena');

  return (
    <div className="arena">
      <PageHeader
        icon="arena"
        title="Arena"
        description="Compete with other learners and win."
      />

      <section className="arena__soon" aria-labelledby="arena-soon-title">
        <span className="arena__badge">Coming soon</span>
        <h2 id="arena-soon-title">The Arena is being built</h2>
        <p>
          Soon you will be able to challenge friends and other learners, climb your class leaderboard and
          represent your school. Until then, sharpen up in Practice.
        </p>
        <Link to="/practice" className="btn btn-primary">Go to Practice</Link>
      </section>

      <section className="arena__section" aria-labelledby="arena-rounds-title">
        <h2 id="arena-rounds-title" className="arena__section-title">The rounds</h2>
        <ol className="arena__rounds">
          {ROUNDS.map(({ key, icon: Icon, name, text }, index) => (
            <li key={key} className="arena__round">
              <span className="arena__round-icon" aria-hidden="true"><Icon /></span>
              <div>
                <span className="arena__round-num">Round {index + 1}</span>
                <h3 className="arena__round-name">{name}</h3>
                <p className="arena__round-text">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
