/* eslint-disable no-console */
/**
 * Seed: EBS 106 — Child and Adolescent Development and Learning
 * Part 2: Lessons 14–26
 * Run AFTER seed_ebs106_child_development.js (which creates the course and Lessons 1–13).
 */
const { Op } = require('sequelize');
const db = require('../models');

const COURSE_CODE = 'EBS 106';
const COURSE_TITLE = 'Child and Adolescent Development and Learning';
const COURSE_KEY = 'ebs106-child-adolescent-development';

const img = (filename) =>
  `https://commons.wikimedia.org/w/index.php?title=Special%3ARedirect%2Ffile%2F${encodeURIComponent(filename)}&width=480`;

const IMG = {
  play:         img('Children_playing_on_grass.jpg'),
  pavlov:       img('Classical_conditioning_diagram.svg'),
  skinner:      img('Operant_conditioning_diagram.svg'),
  bandura:      img('Social_cognitive_theory.svg'),
  maslow:       img('MaslowsHierarchyOfNeeds.svg'),
  motivation:   img('Intrinsic_and_extrinsic_motivation.svg'),
  attribution:  img('Attribution_theory.svg'),
  intelligence: img('Gardner_multiple_intelligences.svg'),
  childStages:  img('Developmental_stages_of_a_young_child.jpg'),
  specialNeeds: img('Special_education_symbol.svg'),
  inclusion:    img('Inclusion_symbol.svg'),
  family:       img('Family_portrait.svg'),
  teacher:      img('Teacher_and_students.jpg'),
};

// ─── LESSONS 14–26 ────────────────────────────────────────────────────────────

const LESSONS = [

  // ── LESSON 14 ─────────────────────────────────────────────────────────────
  {
    lessonNumber: 14,
    title: 'Play and Development',
    tags: ['child-development', 'play', 'learning', 'ebs106'],
    chunks: [
      {
        heading: 'The Nature and Functions of Play',
        illustration: {
          src: IMG.play,
          alt: 'Children playing together on grass',
          caption: 'Play is not just recreation — it is a primary vehicle for cognitive, social, and emotional development.',
          credit: 'Wikimedia Commons',
          mobile_position: 'between_paragraph_0_1',
          desktop_align: 'right',
        },
        paragraphs: [
          'Play is the self-initiated, intrinsically motivated activity children engage in for its own sake, without external rewards. It is a universal behaviour across all cultures and is essential — not incidental — to healthy development.',
          'Play serves multiple developmental functions: it develops imagination and creativity, strengthens cognitive skills (problem-solving, symbolic thinking), builds social competence (cooperation, negotiation, empathy), and supports emotional regulation (managing excitement, frustration, and disappointment in a safe context).',
        ],
        exercise: {
          type: 'multiple_choice',
          prompt: 'Which of the following best describes the role of play in child development?',
          options: [
            'Play is a reward to be given after academic work is complete',
            'Play is a primary vehicle for cognitive, social, and emotional development',
            'Play is only valuable in early childhood and becomes irrelevant by age 7',
            'Play is mainly a physical activity with no cognitive or social benefit',
          ],
          answer: 'Play is a primary vehicle for cognitive, social, and emotional development',
          explanation: 'Play is not merely recreation — it is a core mechanism of development. Through play, children practise cognitive skills, develop social competence, regulate emotions, and build creativity.',
        },
      },
      {
        heading: 'Types of Play',
        paragraphs: [
          "Mildred Parten (1932) described a developmental sequence of social play: <strong>Solitary play</strong> — child plays alone (infants). <strong>Onlooker play</strong> — child watches others play without joining. <strong>Parallel play</strong> — child plays alongside but not with others (2–3 years). <strong>Associative play</strong> — children interact but without shared goals. <strong>Cooperative play</strong> — children work together toward a shared goal (4+ years).",
          'Beyond social categories, play can be classified as: <strong>Symbolic/pretend play</strong> — using objects to represent other things (a stick becomes a sword). <strong>Constructive play</strong> — building, creating, designing. <strong>Games with rules</strong> — following shared rules (board games, sports). <strong>Rough-and-tumble play</strong> — physical play that is distinct from aggression and is important for social bonding.',
        ],
        exercise: {
          type: 'true_false',
          prompt: 'According to Parten, cooperative play is the most socially advanced type of play and typically emerges in children aged 4 and above.',
          options: ['True', 'False'],
          answer: 'True',
          explanation: "Cooperative play — where children work together toward a shared goal with roles and rules — is the most socially complex form in Parten's sequence and emerges around age 4. It requires communication, negotiation, and perspective-taking.",
        },
      },
      {
        heading: 'Play and Cognitive Development',
        paragraphs: [
          'Vygotsky argued that play creates a "zone of proximal development" — during pretend play, children consistently perform above their everyday cognitive level. When a child pretends to be a doctor or cook, they must follow the rules and logic of that role, stretching their thinking.',
          'Symbolic play (e.g., using a banana as a telephone) develops the same capacity for symbolic thinking that underlies language and literacy — understanding that one thing can represent another. Constructive play builds spatial reasoning, planning, and persistence.',
        ],
        exercise: {
          type: 'fill_in',
          prompt: 'Vygotsky argued that play creates a ________ of proximal development, because children regularly perform above their everyday cognitive level during play.',
          answer: 'zone',
          explanation: "Vygotsky's concept of the zone of proximal development applies to play: during play, children stretch their thinking beyond their current level, practising skills and reasoning they are just beginning to master.",
        },
      },
      {
        heading: 'Play and Social Development',
        paragraphs: [
          'Play is the primary context in which children develop social skills. Through play, children learn to: negotiate roles and rules, take turns, manage conflict, cooperate toward shared goals, take the perspective of others, and regulate their own behaviour in relation to others.',
          '<ol><li>Protect play time in school — do not eliminate recess or free play as academic pressure increases. The social and cognitive benefits of play support academic achievement, not undermine it.</li><li>Facilitate rich play environments with diverse materials (blocks, sand, art, role-play props) that stimulate imagination and cooperation.</li><li>Observe children\'s play to assess social and emotional development — what children do in play reveals what they understand about the world.</li><li>Include cooperative games and activities as learning tools across subjects and age groups.</li></ol>',
        ],
        exercise: {
          type: 'theory',
          prompt: 'Some primary school administrators want to reduce recess time to allow more time for academic instruction. Using developmental theory, argue for the importance of retaining play time in the school day.',
          answer: "Play is not a luxury — it is essential to the cognitive and social development that underlies academic learning. Here's why play time must be protected: 1. Cognitive benefits (Vygotsky): Play creates a zone of proximal development where children practise skills beyond their current level. Symbolic play builds the representational thinking needed for reading, mathematics, and science. 2. Social-emotional development: Children learn cooperation, negotiation, conflict resolution, and emotional regulation through play — all of which are prerequisite to effective classroom learning. A child who cannot regulate emotions or cooperate with peers will struggle academically. 3. Physical health and brain function: Physical play improves blood flow to the prefrontal cortex, the region responsible for attention, impulse control, and executive function — all critical for academic performance. 4. Motivation and engagement: Adequate free play reduces stress and increases children's willingness to engage with structured academic tasks. Eliminating recess produces more restless, disengaged learners, not more productive ones. Research consistently shows that schools that protect play time achieve better, not worse, academic outcomes.",
          explanation: 'Developmental research consistently supports play as a driver of cognitive, social, and emotional growth. Reducing play to increase instruction time is counterproductive.',
        },
      },
    ],
  },

  // ── LESSON 15 ─────────────────────────────────────────────────────────────
  {
    lessonNumber: 15,
    title: 'Behaviorism: Classical Conditioning',
    tags: ['learning-theory', 'behaviorism', 'classical-conditioning', 'pavlov', 'ebs106'],
    chunks: [
      {
        heading: 'Introduction to Behaviorism',
        illustration: {
          src: IMG.pavlov,
          alt: 'Diagram of classical conditioning showing stimulus-response associations',
          caption: 'Classical conditioning shows how neutral stimuli become associated with natural responses through repeated pairing.',
          credit: 'Wikimedia Commons',
          mobile_position: 'between_paragraph_0_1',
          desktop_align: 'right',
        },
        paragraphs: [
          'Behaviorism is a school of psychology that focuses exclusively on observable behavior, rejecting the study of mental processes (thoughts, feelings, consciousness) as unscientific. Major behaviorists include John Watson, Ivan Pavlov, and B.F. Skinner.',
          "Behaviorists believe that all behavior — including learning — is the result of conditioning: the association between stimuli and responses shaped by the environment. The core claim is that with the right environment and reinforcement history, any behavior can be shaped.",
        ],
        exercise: {
          type: 'multiple_choice',
          prompt: 'What is the central focus of behaviorism as a school of psychology?',
          options: [
            'The study of unconscious mental processes and their effect on behavior',
            'Observable behavior and how it is shaped by environmental stimuli and consequences',
            'The biological basis of personality and temperament',
            'The role of genetics in determining intelligence',
          ],
          answer: 'Observable behavior and how it is shaped by environmental stimuli and consequences',
          explanation: 'Behaviorism focuses exclusively on observable behavior and its environmental causes — stimuli and consequences. Mental processes are considered outside the scope of scientific study in strict behaviorism.',
        },
      },
      {
        heading: "Pavlov's Classical Conditioning",
        paragraphs: [
          "Ivan Pavlov (1849–1936), a Russian physiologist, discovered classical conditioning while studying digestion in dogs. He noticed that dogs began salivating not only at the sight of food, but also at the sight of the lab assistant who brought the food. The dog had learned to associate the neutral stimulus (assistant) with the unconditioned stimulus (food).",
          "Pavlov systematically paired a neutral stimulus (a bell) with food. After repeated pairings, the dog salivated at the bell alone — even without food. Pavlov's key terms: <strong>Unconditioned Stimulus (UCS)</strong> — naturally triggers a response (food → salivation). <strong>Unconditioned Response (UCR)</strong> — natural, unlearned response (salivation to food). <strong>Conditioned Stimulus (CS)</strong> — learned trigger after conditioning (bell). <strong>Conditioned Response (CR)</strong> — learned response to CS (salivation to bell).",
        ],
        exercise: {
          type: 'true_false',
          prompt: "In Pavlov's experiment, the bell is an unconditioned stimulus because it naturally causes salivation in dogs.",
          options: ['True', 'False'],
          answer: 'False',
          explanation: 'The bell is a conditioned stimulus (CS) — it is neutral before conditioning and only triggers salivation (the conditioned response) after being repeatedly paired with the unconditioned stimulus (food). Food is the unconditioned stimulus.',
        },
      },
      {
        heading: 'Key Concepts in Classical Conditioning',
        paragraphs: [
          '<strong>Extinction:</strong> The conditioned response weakens and disappears when the CS is repeatedly presented without the UCS (bell without food). <strong>Spontaneous recovery:</strong> The extinguished CR may reappear after a rest period. <strong>Generalisation:</strong> The CR is elicited by stimuli similar to the CS (e.g., a tone similar to the original bell). <strong>Discrimination:</strong> The organism learns to respond to the original CS but not to similar stimuli.',
          'John Watson applied classical conditioning to humans in the famous (and ethically problematic) "Little Albert" experiment, conditioning an infant to fear a white rat by pairing it with a loud noise. This demonstrated that emotional responses (such as fear and anxiety) can be classically conditioned.',
        ],
        exercise: {
          type: 'fill_in',
          prompt: 'When a conditioned response weakens and disappears because the conditioned stimulus is repeatedly presented without the unconditioned stimulus, this is called ________.',
          answer: 'extinction',
          explanation: 'Extinction occurs when the CS is no longer paired with the UCS. Without reinforcement through pairing, the conditioned response gradually diminishes and eventually disappears.',
        },
      },
      {
        heading: 'Educational Implications of Classical Conditioning',
        paragraphs: [
          '<ol><li><strong>Fear of school and subjects:</strong> Children can develop conditioned anxiety about school, particular subjects, or teachers if those environments are repeatedly associated with failure, humiliation, or punishment. This is classical conditioning — and it is the teacher\'s responsibility to avoid creating these associations.</li><li><strong>Positive associations:</strong> A warm, encouraging classroom environment creates positive conditioned associations with learning itself. Children who feel safe and valued come to associate learning with pleasure rather than threat.</li><li><strong>Anxiety management:</strong> Systematic desensitisation (a therapeutic technique based on classical conditioning) can help students with test anxiety by pairing relaxation with gradually increasing exposure to test-like conditions.</li><li>Transition routines: Consistent start-of-lesson rituals (a song, a focusing activity) can become conditioned stimuli that signal "learning mode" and help children transition quickly.</li></ol>',
        ],
        exercise: {
          type: 'theory',
          prompt: 'A student consistently becomes anxious and refuses to participate in mathematics lessons. Using classical conditioning, explain how this anxiety may have developed and suggest a strategy to address it.',
          answer: "The student's mathematics anxiety is likely a classically conditioned emotional response. Here's how it may have developed: If the student repeatedly experienced mathematics (neutral stimulus) paired with negative experiences — public humiliation when giving wrong answers, harsh marking, failure, or peer ridicule — the subject itself became a conditioned stimulus that triggers anxiety (conditioned response). The anxiety became generalised: even entering a maths class now triggers the fear response, regardless of actual threat. Strategy to address it (based on classical conditioning principles): 1. Extinction: Remove the association between maths and fear by creating repeated, genuinely positive experiences in mathematics — start with activities the student can succeed at, gradually increasing difficulty. 2. Counter-conditioning: Pair maths tasks with relaxation, encouragement, and success. Over time, these positive pairings weaken the negative conditioned association. 3. Avoid retraumatising: Never humiliate the student publicly, call on them unexpectedly, or compare their performance negatively — this restrengthens the conditioned anxiety. 4. Build on small wins: Each success experience weakens the fear response and begins to form a new positive association.",
          explanation: "Classical conditioning explains why many students develop subject-specific anxiety. Understanding this helps teachers prevent harmful associations and deliberately create positive ones.",
        },
      },
    ],
  },

  // ── LESSON 16 ─────────────────────────────────────────────────────────────
  {
    lessonNumber: 16,
    title: 'Behaviorism: Operant Conditioning',
    tags: ['learning-theory', 'behaviorism', 'operant-conditioning', 'skinner', 'ebs106'],
    chunks: [
      {
        heading: "Thorndike's Law of Effect",
        illustration: {
          src: IMG.skinner,
          alt: 'Diagram of operant conditioning showing reinforcement and punishment',
          caption: 'Operant conditioning links behavior to consequences — reinforcement increases behavior; punishment decreases it.',
          credit: 'Wikimedia Commons',
          mobile_position: 'after_last_paragraph',
          desktop_align: 'right',
        },
        paragraphs: [
          "Edward Thorndike (1874–1949) conducted experiments with cats in puzzle boxes. He observed that behaviors followed by satisfying consequences were repeated, while those followed by unpleasant consequences were not. He called this the <strong>Law of Effect</strong>: the effect of a behavior determines whether it will occur again.",
          "Thorndike also proposed the <strong>Law of Exercise</strong> (practice strengthens connections between stimulus and response) and the <strong>Law of Readiness</strong> (learning is more effective when the organism is ready to respond). These laws laid the groundwork for Skinner's operant conditioning.",
        ],
        exercise: {
          type: 'multiple_choice',
          prompt: "Thorndike's Law of Effect states that:",
          options: [
            'Behaviors followed by satisfying consequences are more likely to be repeated',
            'All behavior is determined by genetic factors',
            'Repetition alone is sufficient to guarantee learning',
            'Punishment is the most effective way to change behavior',
          ],
          answer: 'Behaviors followed by satisfying consequences are more likely to be repeated',
          explanation: "Thorndike's Law of Effect establishes the connection between behavior and its consequences. Behaviors that produce satisfying outcomes increase in frequency; behaviors that produce unpleasant outcomes decrease. This is the foundation of operant conditioning.",
        },
      },
      {
        heading: "Skinner's Operant Conditioning",
        paragraphs: [
          "B.F. Skinner (1904–1990) extended Thorndike's work into a comprehensive theory of operant conditioning. Using a specially designed chamber (the 'Skinner box'), he demonstrated that the frequency of voluntary behavior is controlled by its consequences. He called this type of learning 'operant' because the organism operates on the environment to produce consequences.",
          'Skinner identified two major categories of consequences: <strong>Reinforcers</strong> — consequences that increase the frequency of a behavior. <strong>Punishers</strong> — consequences that decrease the frequency of a behavior. Critically, reinforcers and punishers are defined by their effect, not their nature — something is a reinforcer only if it actually increases the target behavior.',
        ],
        exercise: {
          type: 'true_false',
          prompt: "In Skinner's operant conditioning, a punisher is defined as any consequence that the teacher intends to be unpleasant, regardless of whether it actually decreases the behavior.",
          options: ['True', 'False'],
          answer: 'False',
          explanation: 'Reinforcers and punishers are defined by their effect on behavior. A punisher is something that actually decreases the frequency of a behavior — not simply what the teacher intends. If a consequence does not reduce the behavior, it is not functioning as a punisher.',
        },
      },
      {
        heading: 'Reinforcement and Punishment',
        paragraphs: [
          '<strong>Positive reinforcement:</strong> Adding a pleasant stimulus after a behavior (giving praise for completing homework → homework completion increases). <strong>Negative reinforcement:</strong> Removing an unpleasant stimulus after a behavior (removing an extra task when a student behaves well → good behavior increases). Note: negative reinforcement increases behavior — it is not punishment.',
          '<strong>Positive punishment:</strong> Adding an unpleasant stimulus after a behavior (giving extra work for misbehaviour → misbehaviour decreases). <strong>Negative punishment:</strong> Removing a pleasant stimulus after a behavior (taking away break time for misbehaviour → misbehaviour decreases). Skinner favoured reinforcement over punishment, arguing that reinforcement is more effective and does not produce the negative side effects of punishment.',
        ],
        exercise: {
          type: 'fill_in',
          prompt: 'Negative reinforcement ________ the frequency of a behavior by removing an unpleasant stimulus — it is often confused with punishment, but it is the opposite.',
          answer: 'increases',
          explanation: 'Negative reinforcement increases behavior by removing something unpleasant. For example, a student who studies to avoid a failing grade is negatively reinforced for studying. This is commonly confused with punishment, which decreases behavior.',
        },
      },
      {
        heading: 'Educational Applications of Operant Conditioning',
        paragraphs: [
          '<ol><li><strong>Positive reinforcement is the most powerful tool:</strong> Consistently praising, acknowledging, and rewarding desired behavior is more effective than punishing undesired behavior. Make praise specific and immediate.</li><li><strong>Schedules of reinforcement:</strong> Intermittent reinforcement (rewarding behavior only sometimes) produces more persistent behavior than continuous reinforcement. Use continuous reinforcement when teaching a new skill; switch to intermittent reinforcement to maintain it.</li><li><strong>Token economy systems:</strong> Award tokens (points, stickers) for desired behaviors that can be exchanged for rewards. These are particularly effective in structured settings.</li><li><strong>Behaviour shaping:</strong> Reinforce successive approximations toward a desired behavior — useful when teaching complex skills incrementally.</li><li>Avoid heavy reliance on punishment: punishment suppresses behavior temporarily but does not teach what to do instead and can create resentment and anxiety.</li></ol>',
        ],
        exercise: {
          type: 'theory',
          prompt: 'A teacher wants to increase the frequency of students raising their hands before speaking, instead of calling out. Using operant conditioning, design a strategy to achieve this.',
          answer: "Goal behavior: Students raise their hand before speaking. Operant conditioning strategy: 1. Positive reinforcement: Every time a student raises their hand, the teacher calls on them promptly and responds warmly to their contribution, regardless of content. This makes hand-raising reinforcing (it gets attention and a response). Students who call out are not acknowledged — the behavior is placed on extinction by removing the reinforcer (teacher attention). 2. Continuous reinforcement initially: When the behavior is new, reinforce every instance of hand-raising to establish the habit quickly. 3. Transition to intermittent reinforcement: Once hand-raising is established, begin calling on students selectively and occasionally praise specifically: 'I love how many hands went up — that shows great classroom respect.' 4. Behavior shaping: If some students never raise hands, begin by reinforcing any quieter behavior (not calling out loudly) before gradually requiring a hand to be raised. 5. Consistency: All adults in the classroom must apply the same contingency. If any teacher accepts call-outs, the desired behavior will extinguish.",
          explanation: 'Operant conditioning principles — especially positive reinforcement, extinction, and shaping — provide practical tools for establishing and maintaining desired classroom behaviors.',
        },
      },
    ],
  },

  // ── LESSON 17 ─────────────────────────────────────────────────────────────
  {
    lessonNumber: 17,
    title: 'Social Learning Theory (Albert Bandura)',
    tags: ['learning-theory', 'social-learning', 'bandura', 'modelling', 'ebs106'],
    chunks: [
      {
        heading: 'Introduction to Social Learning Theory',
        illustration: {
          src: IMG.bandura,
          alt: 'Diagram of social cognitive theory showing reciprocal determinism',
          caption: "Bandura's social cognitive theory shows that learning occurs through observation of models in a social environment.",
          credit: 'Wikimedia Commons',
          mobile_position: 'between_paragraph_0_1',
          desktop_align: 'right',
        },
        paragraphs: [
          "Albert Bandura (1925–2021) proposed social learning theory as an extension of behaviorism. While he agreed that behavior is influenced by consequences, he argued that humans learn far more through observation of others (models) than through direct reinforcement — we can learn without personally experiencing consequences.",
          "Bandura later expanded the theory into social cognitive theory, introducing the concept of <strong>reciprocal determinism</strong>: behavior, personal factors (cognition, beliefs), and environment all influence each other in a continuous, bidirectional way. Learning is not simply a response to environmental stimuli — the learner's cognitions mediate it.",
        ],
        exercise: {
          type: 'multiple_choice',
          prompt: "Which of the following best distinguishes Bandura's social learning theory from strict behaviorism?",
          options: [
            'Bandura rejected the idea that consequences affect behavior',
            'Bandura argued that biological maturation alone determines behavior',
            'Bandura showed that humans can learn by observing others, without direct reinforcement',
            'Bandura believed that all learning occurs through classical conditioning',
          ],
          answer: 'Bandura showed that humans can learn by observing others, without direct reinforcement',
          explanation: "Bandura's key contribution was demonstrating observational learning — humans acquire new behaviors, attitudes, and emotional reactions by watching models, without needing to personally experience reinforcement or punishment.",
        },
      },
      {
        heading: 'Observational Learning and Modelling',
        paragraphs: [
          "Bandura's classic Bobo doll experiments (1961–1963) demonstrated observational learning. Children who watched an adult model behave aggressively toward an inflatable doll subsequently imitated that aggression — especially when the model was seen to be rewarded for it. Children who saw the model punished showed less imitation.",
          "Bandura identified four processes required for observational learning: <strong>Attention</strong> — the observer must notice the model's behavior. <strong>Retention</strong> — the behavior must be remembered in symbolic form. <strong>Reproduction</strong> — the observer must have the physical/cognitive ability to perform the behavior. <strong>Motivation</strong> — the observer must want to perform the behavior (influenced by vicarious reinforcement — seeing the model rewarded).",
        ],
        exercise: {
          type: 'true_false',
          prompt: "According to Bandura, vicarious reinforcement occurs when a learner is directly rewarded for performing a behavior they observed.",
          options: ['True', 'False'],
          answer: 'False',
          explanation: "Vicarious reinforcement occurs when a learner observes a model being rewarded for a behavior. The learner is not directly rewarded — the motivation to imitate comes from seeing the model's positive outcome. Direct reward to the learner is standard reinforcement, not vicarious.",
        },
      },
      {
        heading: 'Self-Efficacy',
        paragraphs: [
          "Self-efficacy is the belief in one's own capacity to perform a specific task or achieve a goal. It is Bandura's most significant contribution to educational psychology. Self-efficacy is not the same as self-esteem (general self-worth) — it is task-specific. A student may have high self-efficacy for mathematics but low self-efficacy for writing.",
          "Self-efficacy is shaped by four sources: <strong>Mastery experiences</strong> (past success is the most powerful source). <strong>Vicarious experiences</strong> (seeing similar others succeed: 'If they can do it, I can'). <strong>Social persuasion</strong> (being told by a credible person that one can succeed). <strong>Physiological states</strong> (interpreting anxiety as a sign of inadequacy vs. as excitement reduces efficacy). High self-efficacy predicts effort, persistence, and resilience in the face of difficulty.",
        ],
        exercise: {
          type: 'fill_in',
          prompt: "According to Bandura, the most powerful source of self-efficacy beliefs is ________ experiences — past successful performance of the task.",
          answer: 'mastery',
          explanation: "Mastery experiences — actually succeeding at a task — are the most powerful source of self-efficacy. They create robust beliefs in competence because they are based on personal evidence of capability. Vicarious experience, social persuasion, and physiological states also contribute but are less powerful.",
        },
      },
      {
        heading: 'Educational Implications of Social Learning Theory',
        paragraphs: [
          '<ol><li><strong>Teachers as models:</strong> Students learn attitudes, values, and behaviors by observing teachers. A teacher who demonstrates curiosity, respect, intellectual honesty, and perseverance models these qualities implicitly.</li><li><strong>Peer modelling:</strong> Use peer models deliberately — demonstrating a skill through a student slightly above others can be more motivating than a teacher demonstration ("If they can, I can").</li><li><strong>Build self-efficacy:</strong> Design tasks for successful early experiences, provide specific positive feedback, and ensure students witness peers succeeding. Never undermine a student\'s belief in their capacity with negative predictions.</li><li><strong>Vicarious reinforcement:</strong> Praise and recognise desired behaviors publicly — other students learn that those behaviors are valued and rewarded.</li><li>Monitor media and environmental models: what children watch and are exposed to shapes their behavior through observational learning.</li></ol>',
        ],
        exercise: {
          type: 'theory',
          prompt: 'Explain how a classroom teacher can use social learning theory to help a student with low self-efficacy in reading improve both their skill and their belief in their ability to read.',
          answer: "Using Bandura's social learning theory, particularly self-efficacy development: 1. Mastery experiences (most powerful): Carefully calibrate reading tasks so the student experiences genuine success at their current level before moving forward. Use books slightly below their frustration level initially to build a success history. Every successful reading experience raises efficacy. 2. Vicarious experience: Have the student observe a peer of similar perceived ability succeed at a reading task: 'Look, Kofi is the same age as you and he just read this passage — I think you can too.' Ensure the peer model is credible (similar to the student). 3. Social persuasion: Provide specific, credible encouragement from a trusted adult: 'Your reading has improved significantly — you read three paragraphs without stopping last week.' Avoid empty praise; base encouragement on observed evidence. 4. Physiological interpretation: Help the student reinterpret reading anxiety as a signal to focus rather than as proof of inability: 'It\'s okay to feel nervous about reading aloud — that feeling means you care. Let\'s practise so it gets easier.' 5. Teacher modelling: Read aloud regularly, including sometimes making mistakes and modelling how to correct them — showing that reading fluency comes with practice, even for skilled readers.",
          explanation: "Social learning theory offers multiple practical levers for improving both academic skill and the self-beliefs that determine whether students invest effort in developing that skill.",
        },
      },
    ],
  },

  // ── LESSON 18 ─────────────────────────────────────────────────────────────
  {
    lessonNumber: 18,
    title: 'Humanistic Theory of Learning',
    tags: ['learning-theory', 'humanistic', 'maslow', 'rogers', 'ebs106'],
    chunks: [
      {
        heading: 'Introduction to Humanistic Psychology',
        illustration: {
          src: IMG.maslow,
          alt: "Diagram of Maslow's Hierarchy of Needs",
          caption: "Maslow's hierarchy places physiological and safety needs at the base — unmet lower needs prevent higher learning.",
          credit: 'Wikimedia Commons',
          mobile_position: 'between_paragraph_0_1',
          desktop_align: 'right',
        },
        paragraphs: [
          "Humanistic psychology emerged in the 1950s–60s as a 'third force' in psychology, rejecting the determinism of behaviorism (behavior is controlled by the environment) and psychoanalysis (behavior is controlled by unconscious forces). Humanists argued that humans are inherently growth-oriented, capable of choice, and motivated by a desire for meaning and self-actualisation.",
          "Major humanistic theorists include Abraham Maslow and Carl Rogers. Both stressed the whole person — not just observable behavior or unconscious drives — and the importance of dignity, autonomy, and positive relationships in learning.",
        ],
        exercise: {
          type: 'multiple_choice',
          prompt: "Humanistic psychology is sometimes called the 'third force' because it rejected which two dominant approaches?",
          options: [
            'Cognitive psychology and social learning theory',
            'Behaviorism and psychoanalysis',
            'Structuralism and functionalism',
            'Nativism and constructivism',
          ],
          answer: 'Behaviorism and psychoanalysis',
          explanation: "Humanistic psychology emerged as a 'third force' by rejecting behaviorism's environmental determinism and psychoanalysis's focus on unconscious drives. Instead, humanists focused on conscious experience, free will, growth, and the whole person.",
        },
      },
      {
        heading: "Maslow's Hierarchy of Needs",
        paragraphs: [
          "Abraham Maslow (1908–1970) proposed a hierarchy of human needs arranged in five levels, from most basic to highest: <strong>1. Physiological needs</strong> — food, water, shelter, sleep. <strong>2. Safety needs</strong> — security, stability, freedom from fear. <strong>3. Love and belonging needs</strong> — affection, friendship, a sense of belonging. <strong>4. Esteem needs</strong> — self-respect, recognition, achievement. <strong>5. Self-actualisation</strong> — realising one's full potential, creativity, meaning.",
          "Maslow's key insight for education: <em>unmet lower-level needs prevent engagement with higher-level learning</em>. A student who is hungry, afraid, or socially isolated cannot focus on intellectual growth. Teachers must attend to the whole child — not just the academic dimension.",
        ],
        exercise: {
          type: 'true_false',
          prompt: "According to Maslow, a student who feels socially isolated and unloved can still engage fully with self-actualisation-level academic learning if the teacher provides interesting enough lessons.",
          options: ['True', 'False'],
          answer: 'False',
          explanation: "Maslow's hierarchy is sequential — unmet lower needs (belonging, safety) prevent engagement with higher needs (esteem, self-actualisation). A student who feels isolated or unsafe cannot effectively pursue academic self-actualisation, regardless of lesson quality.",
        },
      },
      {
        heading: "Rogers' Person-Centred Approach",
        paragraphs: [
          "Carl Rogers (1902–1987) developed person-centred therapy and applied it to education through his concept of <strong>facilitative teaching</strong>. Rogers argued that the most significant learning occurs when learners are allowed to pursue what is personally meaningful to them. The teacher's role is to create conditions that release the student's natural desire to learn.",
          "Rogers identified three core facilitative conditions: <strong>Genuineness (congruence)</strong> — the teacher is authentic and honest, not hiding behind a professional role. <strong>Unconditional positive regard</strong> — the teacher accepts and values the student as a person, regardless of behavior or performance. <strong>Empathic understanding</strong> — the teacher understands and communicates understanding of the student's experience from the student's perspective.",
        ],
        exercise: {
          type: 'fill_in',
          prompt: "Rogers argued that genuine, meaningful learning is most likely to occur when the teacher creates an environment of ________ positive regard — accepting and valuing each learner as a person.",
          answer: 'unconditional',
          explanation: "Unconditional positive regard means the teacher accepts and values the student regardless of their behavior or academic performance. This creates the psychological safety necessary for genuine learning and risk-taking.",
        },
      },
      {
        heading: 'Educational Implications of Humanistic Theory',
        paragraphs: [
          '<ol><li><strong>Address the whole child:</strong> Check that basic needs (food, safety, belonging) are met before expecting academic engagement. Work with school counsellors, parents, and support services when basic needs are unmet.</li><li><strong>Create belonging:</strong> Every student should feel genuinely welcomed, known, and valued in the classroom. This meets the love/belonging need that Maslow places above safety.</li><li><strong>Build student autonomy:</strong> Allow students some voice in what and how they learn — choice increases intrinsic motivation and engagement (Rogers\' self-directed learning).</li><li><strong>Provide specific feedback that builds esteem:</strong> Esteem needs (Maslow) require genuine recognition. Hollow praise is not enough; specific, honest recognition of real achievement builds authentic self-worth.</li><li><strong>Be genuinely present:</strong> Rogers\' facilitative conditions — genuineness, positive regard, empathy — are not techniques but dispositions. Students know when a teacher is genuinely interested in them.</li></ol>',
        ],
        exercise: {
          type: 'theory',
          prompt: "A student in your class regularly falls asleep during lessons and struggles to engage with classwork. Using Maslow's hierarchy of needs, analyse possible reasons and describe how you would respond.",
          answer: "Using Maslow's hierarchy, persistent sleepiness and disengagement suggest that basic or lower-level needs may be unmet: 1. Physiological needs (bottom level): The student may be genuinely hungry (not eating breakfast or lunch), sleep-deprived (working at night, unstable home environment), or ill. Without physiological needs met, the brain cannot sustain attention and learning. 2. Safety needs: The student may feel emotionally or physically unsafe — at home, on the way to school, or in the classroom. Chronic stress from an unsafe environment impairs cognitive function. 3. Belonging needs: The student may feel socially isolated, unwelcome, or invisible in the class — disengagement is sometimes a response to feeling like one doesn't belong. How I would respond: 1. Private check-in: Have a caring, non-judgmental conversation. 'I've noticed you seem tired in class — is everything okay? Is there anything making it hard to concentrate?' 2. Connect the student with support services: If food or safety needs are identified, refer to the school's welfare officer or social worker. 3. Adjust expectations temporarily: Demanding academic performance while basic needs are unmet is counterproductive. Maintain connection and presence rather than escalating consequences. 4. Examine the classroom climate: Ensure the student feels genuinely welcomed — assign them a meaningful classroom role, use their name warmly, and check that they are not excluded socially.",
          explanation: "Maslow's hierarchy provides a framework for understanding student disengagement that goes beyond willingness or effort. Teachers who address the whole child — including basic and belonging needs — enable academic learning.",
        },
      },
    ],
  },

  // ── LESSON 19 ─────────────────────────────────────────────────────────────
  {
    lessonNumber: 19,
    title: 'Motivation in Learning',
    tags: ['learning', 'motivation', 'intrinsic', 'extrinsic', 'ebs106'],
    chunks: [
      {
        heading: 'The Concept of Motivation',
        illustration: {
          src: IMG.motivation,
          alt: 'Diagram comparing intrinsic and extrinsic motivation',
          caption: 'Motivation drives the initiation, direction, intensity, and persistence of learning behavior.',
          credit: 'Wikimedia Commons',
          mobile_position: 'between_paragraph_0_1',
          desktop_align: 'right',
        },
        paragraphs: [
          'Motivation is the internal state that drives a person to initiate, direct, sustain, and persist in goal-directed behavior. In education, motivation determines whether a student chooses to engage with a learning task, how much effort they invest, and how long they persist when encountering difficulty.',
          'Motivation is not simply present or absent — it varies in type, intensity, and source. Understanding what motivates different students to learn is one of the most important skills a teacher can develop.',
        ],
        exercise: {
          type: 'multiple_choice',
          prompt: 'Which of the following best describes motivation in the context of learning?',
          options: [
            'The intelligence level that determines how quickly a student learns',
            'An internal state that drives the initiation, direction, and persistence of learning behavior',
            'The amount of praise a teacher provides during a lesson',
            'A fixed trait that cannot be changed by the classroom environment',
          ],
          answer: 'An internal state that drives the initiation, direction, and persistence of learning behavior',
          explanation: 'Motivation is an internal state that affects how students initiate, sustain, and persist in learning. It is not fixed — it is influenced by teacher behavior, classroom climate, task design, and many other factors.',
        },
      },
      {
        heading: 'Intrinsic and Extrinsic Motivation',
        paragraphs: [
          '<strong>Intrinsic motivation</strong> refers to engagement driven by internal factors — genuine interest, curiosity, enjoyment, or a sense of personal challenge. Intrinsically motivated students engage with learning because the activity itself is rewarding. Research consistently shows that intrinsic motivation produces deeper learning, greater creativity, and more durable skill development.',
          '<strong>Extrinsic motivation</strong> refers to engagement driven by external factors — grades, rewards, praise, fear of punishment, or social approval. Extrinsic motivation can initiate behavior effectively, but it rarely produces deep engagement and can undermine intrinsic motivation if overused. Overjustification effect: receiving external rewards for activities children already enjoy can reduce their natural interest in those activities.',
        ],
        exercise: {
          type: 'true_false',
          prompt: 'Research shows that providing external rewards for tasks children already intrinsically enjoy always increases their long-term motivation for those tasks.',
          options: ['True', 'False'],
          answer: 'False',
          explanation: "The overjustification effect shows that external rewards for intrinsically enjoyable activities can reduce intrinsic motivation. Children begin to attribute their engagement to the reward rather than their own interest, leading to decreased engagement when rewards are removed.",
        },
      },
      {
        heading: 'Key Theories of Motivation',
        paragraphs: [
          "<strong>Self-Determination Theory (Deci & Ryan):</strong> Identifies three basic psychological needs that, when met, promote intrinsic motivation: <em>Autonomy</em> (feeling in control of one's own behavior and goals), <em>Competence</em> (feeling effective and capable), and <em>Relatedness</em> (feeling connected to others). Classroom environments that satisfy these needs produce higher intrinsic motivation and deeper engagement.",
          '<strong>Achievement Goal Theory:</strong> Students may adopt learning goals (mastery goals — seeking to genuinely understand and improve) or performance goals (seeking to demonstrate ability relative to others). Students with mastery goals tend to be more resilient, more engaged, and achieve more than those with performance goals. Classroom competition and norm-referenced assessment push students toward performance goals.',
        ],
        exercise: {
          type: 'fill_in',
          prompt: "According to Self-Determination Theory, the three basic psychological needs that promote intrinsic motivation are autonomy, competence, and ________.",
          answer: 'relatedness',
          explanation: "Self-Determination Theory (Deci & Ryan) proposes that intrinsic motivation flourishes when three needs are met: autonomy (self-direction), competence (feeling effective), and relatedness (feeling connected to others). Classrooms that support all three promote deeper, more durable learning motivation.",
        },
      },
      {
        heading: 'Strategies for Motivating Learners',
        paragraphs: [
          '<ol><li><strong>Design meaningful tasks:</strong> Connect learning to students\' lives, interests, and real-world problems. Relevance is one of the strongest predictors of intrinsic motivation.</li><li><strong>Support autonomy:</strong> Allow student choice in topics, formats, and pace where possible. Even small choices increase ownership and engagement.</li><li><strong>Build competence:</strong> Design tasks that are challenging but achievable (in the zone of proximal development). Frequent success experiences build motivation; repeated failure destroys it.</li><li><strong>Foster belonging:</strong> A classroom where students feel known, valued, and safe supports the relatedness need.</li><li><strong>Use praise carefully:</strong> Praise effort and strategy, not intelligence alone. Praise intelligence reduces risk-taking; praise for effort increases resilience.</li><li><strong>Promote mastery goals:</strong> Frame learning around personal improvement, not comparison to others.</li></ol>',
        ],
        exercise: {
          type: 'theory',
          prompt: "Two teachers use different approaches to motivate their students. Teacher A uses prizes, class rankings, and gold stars. Teacher B emphasises personal improvement, gives students some choice in assignments, and uses specific process praise. Using motivation theory, compare the likely long-term effects of these two approaches.",
          answer: "Teacher A's approach relies primarily on extrinsic motivation (prizes, rankings, gold stars). While this may boost short-term engagement, research suggests several long-term risks: 1. Overjustification effect: Students who were intrinsically interested in learning may begin attributing their engagement to the rewards rather than genuine interest — reducing intrinsic motivation over time. 2. Performance goal orientation: Class rankings encourage students to see learning as a competition for status, not a process of understanding. This produces greater anxiety, reduced risk-taking, and lower resilience when performance slips. 3. The disengagement of lower-ranked students: Students consistently at the bottom of rankings may develop learned helplessness and disengage entirely. Teacher B's approach aligns with Self-Determination Theory and mastery goal orientation: 1. Autonomy support (choice in assignments) meets the autonomy need — students feel ownership, increasing engagement and creativity. 2. Process praise ('You found a good strategy for that problem') teaches students that success is a result of effort and strategy — not fixed ability — promoting greater persistence. 3. A focus on personal improvement cultivates mastery goals: students are motivated to genuinely understand, not just outperform peers. 4. Long-term, Teacher B's students are likely to develop more durable motivation, deeper learning, greater resilience, and a more positive relationship with education.",
          explanation: "Understanding motivation theory allows teachers to design approaches that build lasting engagement rather than superficial compliance driven by rewards.",
        },
      },
    ],
  },

  // ── LESSON 20 ─────────────────────────────────────────────────────────────
  {
    lessonNumber: 20,
    title: 'Attribution Theory and Goal Setting',
    tags: ['learning', 'attribution-theory', 'goal-setting', 'motivation', 'ebs106'],
    chunks: [
      {
        heading: 'Attribution Theory (Weiner)',
        illustration: {
          src: IMG.attribution,
          alt: 'Diagram of attribution theory showing internal and external attributions',
          caption: 'How students explain their successes and failures shapes their motivation and future behavior.',
          credit: 'Wikimedia Commons',
          mobile_position: 'after_last_paragraph',
          desktop_align: 'right',
        },
        paragraphs: [
          "Bernard Weiner's attribution theory examines how people explain their successes and failures. According to Weiner, these explanations (attributions) have a powerful effect on motivation and future behavior. The key question is: <em>'Why did I succeed or fail?'</em>",
          "Weiner classified attributions along three dimensions: <strong>Locus</strong> (internal vs. external — was the cause within or outside me?), <strong>Stability</strong> (stable vs. unstable — is the cause permanent or changeable?), and <strong>Controllability</strong> (controllable vs. uncontrollable — can I influence this cause?). The most common attributions are ability, effort, task difficulty, and luck.",
        ],
        exercise: {
          type: 'multiple_choice',
          prompt: "A student who fails an exam and says 'I failed because I am not intelligent' is making an attribution that is:",
          options: [
            'Internal, unstable, and controllable',
            'External, stable, and uncontrollable',
            'Internal, stable, and uncontrollable',
            'External, unstable, and controllable',
          ],
          answer: 'Internal, stable, and uncontrollable',
          explanation: "Attributing failure to lack of intelligence is internal (within oneself), stable (intelligence is perceived as fixed), and uncontrollable (one cannot change intelligence). This is the most damaging attribution pattern — it leads to helplessness and disengagement.",
        },
      },
      {
        heading: 'Types of Attributions and Their Effects',
        paragraphs: [
          '<strong>Effort attributions</strong> (internal, unstable, controllable): "I failed because I didn\'t study enough." These are the most productive attributions — they imply that future effort will produce different outcomes. Students who attribute failure to effort persist more in the face of difficulty.',
          '<strong>Ability attributions</strong> (internal, stable, uncontrollable): "I failed because I\'m not smart." These are the most damaging — they imply that failure is fixed and unavoidable, leading to learned helplessness. <strong>Task difficulty</strong> (external, stable) and <strong>luck</strong> (external, unstable) attributions are less destructive but also less productive because they locate causes outside the student\'s control.',
        ],
        exercise: {
          type: 'true_false',
          prompt: "According to attribution theory, students who attribute their academic failures to insufficient effort are more likely to persist and improve than those who attribute failure to low ability.",
          options: ['True', 'False'],
          answer: 'True',
          explanation: "Effort attributions (internal, unstable, controllable) imply that different behavior (more effort) will produce different outcomes. This belief supports persistence. Ability attributions (internal, stable, uncontrollable) imply failure is fixed, producing helplessness and withdrawal.",
        },
      },
      {
        heading: 'Goal Setting and Achievement Motivation',
        paragraphs: [
          "Goal-setting theory (Locke & Latham) argues that specific, challenging but attainable goals lead to higher performance than vague or easy goals. The principle is: 'Do your best' produces less effort than 'Score 75% or higher on the next test.' Goals direct attention, mobilise effort, increase persistence, and motivate strategy development.",
          "For goal-setting to be effective in education: goals should be <strong>specific and measurable</strong> ('Read 2 chapters and summarise them'), <strong>challenging but achievable</strong> (in the zone of proximal development), and <strong>student-owned</strong> where possible (involvement in setting goals increases commitment). Short-term goals should be embedded within longer-term aspirations.",
        ],
        exercise: {
          type: 'fill_in',
          prompt: "According to goal-setting theory, goals that are ________ and challenging but attainable produce higher performance than vague goals like 'try your best.'",
          answer: 'specific',
          explanation: "Specific, challenging goals — 'answer 20 practice questions and check your answers' rather than 'study more' — direct attention and effort precisely, increasing motivation and performance significantly more than general instructions.",
        },
      },
      {
        heading: 'Educational Implications of Attribution Theory',
        paragraphs: [
          '<ol><li><strong>Reattribution training:</strong> Help students who make helpless (ability) attributions to reframe failure as a function of effort and strategy rather than fixed ability. Use specific feedback: "You missed this because you didn\'t review this section — let\'s revisit it."</li><li><strong>Avoid ability language:</strong> Do not tell students they are "not smart enough" or imply that ability is fixed. Instead, use process language: "You haven\'t mastered this <em>yet</em>."</li><li><strong>Celebrate effort, strategy, and improvement:</strong> These are all controllable — reinforcing them teaches students that they have agency over their learning outcomes.</li><li><strong>Teach students to set their own goals:</strong> Help students identify specific, short-term targets and reflect on progress. This builds metacognitive awareness and motivation.</li><li>Model productive failure attribution: When you make a mistake, name it, reflect on it, and show how you\'d do differently — modelling the effort attribution openly.</li></ol>',
        ],
        exercise: {
          type: 'theory',
          prompt: "A student consistently fails quizzes and has started saying 'I give up — I'm just bad at this subject.' Using attribution theory, analyse the student's current attribution pattern and design a teacher response that promotes more productive attributions.",
          answer: "Analysis: The student is making an internal, stable, uncontrollable attribution — attributing failure to fixed low ability. This is the most psychologically damaging attribution pattern because it implies that no amount of effort will produce a different outcome. The result is learned helplessness — the student stops trying because they believe trying is futile. Teacher response: 1. Reattribution: Have a private, affirming conversation that offers an alternative explanation for the failures. 'I've looked at your last three quizzes. You're consistently missing questions from the section on [specific content]. This tells me you need more time with that section — not that you can't do this.' This shifts the attribution from stable ability to specific, addressable knowledge gaps. 2. Strategy focus: Offer concrete study strategies for the gap areas. Show that the cause is strategic (how they are preparing) and therefore controllable. 3. Design a success experience: Give the student a task at a level they can succeed at. The experience of success is the most powerful way to challenge an ability attribution — it is hard to believe you 'can't do it' after you've just done it. 4. Specific praise for effort: 'You sat with that difficult problem for 10 minutes and kept working — that's exactly what improvement looks like.' This reinforces the belief that effort produces results. 5. Long-term: Monitor language. Every time the student uses ability language ('I'm bad at this'), gently redirect: 'You haven't mastered this yet — but you will with practice.'",
          explanation: "Attribution retraining — shifting students from ability to effort and strategy attributions — is one of the most evidence-backed motivational interventions available to teachers.",
        },
      },
    ],
  },

  // ── LESSON 21 ─────────────────────────────────────────────────────────────
  {
    lessonNumber: 21,
    title: 'Intelligence: Theories and Implications',
    tags: ['intelligence', 'learning', 'individual-differences', 'gardner', 'ebs106'],
    chunks: [
      {
        heading: 'The Concept of Intelligence',
        illustration: {
          src: IMG.intelligence,
          alt: "Diagram of Gardner's multiple intelligences",
          caption: "Gardner proposed that intelligence is not a single capacity but a profile of multiple distinct abilities.",
          credit: 'Wikimedia Commons',
          mobile_position: 'between_paragraph_0_1',
          desktop_align: 'right',
        },
        paragraphs: [
          "Intelligence is broadly defined as the capacity to learn from experience, solve problems, and adapt effectively to one's environment. Despite its common use, intelligence is one of the most debated concepts in psychology — there is no universally agreed definition.",
          "Conceptions of intelligence have significant educational consequences. A teacher who believes intelligence is fixed will treat students differently than one who believes it is malleable. The dominant view today is that intelligence is shaped by both genetic factors and environmental experience, and that it can be developed through effort and appropriate instruction.",
        ],
        exercise: {
          type: 'multiple_choice',
          prompt: "Which of the following is the most educationally productive belief about intelligence?",
          options: [
            'Intelligence is entirely determined by genetics and cannot change',
            'Intelligence is fixed at birth and revealed by standardised tests',
            'Intelligence is influenced by both genetics and environment, and can be developed through effort',
            'Intelligence is the same across all individuals and requires no special consideration',
          ],
          answer: 'Intelligence is influenced by both genetics and environment, and can be developed through effort',
          explanation: "Research supports an interactive view of intelligence — genetic potential is real, but environment, experience, quality of instruction, and effort significantly shape intellectual development. This view has direct implications for teaching: all students can improve.",
        },
      },
      {
        heading: 'Traditional Theories of Intelligence',
        paragraphs: [
          "Charles Spearman proposed the <strong>two-factor theory</strong>: a general factor (g) that underlies all cognitive tasks, and specific factors (s) for particular abilities. He argued that g is the core of intelligence — high g predicts performance across a wide range of tasks. <strong>Louis Thurstone</strong> challenged this, proposing seven <em>primary mental abilities</em>: verbal comprehension, word fluency, number facility, spatial visualisation, associative memory, perceptual speed, and reasoning.",
          "The debate between 'intelligence as a single general factor' (Spearman) and 'intelligence as multiple specific abilities' (Thurstone) continues in psychological research. Most modern approaches take a middle position: a general factor exists but multiple specific abilities also matter and can be developed independently.",
        ],
        exercise: {
          type: 'true_false',
          prompt: "Spearman's 'g factor' refers to a general intelligence that underlies performance across all cognitive tasks.",
          options: ['True', 'False'],
          answer: 'True',
          explanation: "Spearman's general factor (g) is a broad, underlying cognitive capacity that predicts performance across diverse tasks. He proposed that all intellectual tasks draw on this common factor to varying degrees.",
        },
      },
      {
        heading: "Gardner's Theory of Multiple Intelligences",
        paragraphs: [
          "Howard Gardner (1983) proposed that intelligence is not a single entity but a profile of at least eight distinct intelligences: <strong>Linguistic</strong> (words and language), <strong>Logical-Mathematical</strong> (numbers and reasoning), <strong>Spatial</strong> (visual and spatial judgement), <strong>Musical</strong> (rhythm and melody), <strong>Bodily-Kinesthetic</strong> (body movement and skill), <strong>Interpersonal</strong> (understanding others), <strong>Intrapersonal</strong> (self-understanding), and <strong>Naturalist</strong> (recognising patterns in nature).",
          "Gardner argued that traditional IQ tests measure only linguistic and logical-mathematical intelligence, leaving most human abilities unrecognised. Each person has a unique profile of intelligences, and schools should provide diverse learning pathways that honour different intelligence strengths.",
        ],
        exercise: {
          type: 'fill_in',
          prompt: "Gardner proposed that intelligence consists of at least eight distinct types — for example, linguistic, logical-mathematical, spatial, musical, and ________-kinesthetic.",
          answer: 'bodily',
          explanation: "Bodily-kinesthetic intelligence involves the ability to use one's body skillfully — relevant to athletes, dancers, surgeons, and craftspeople. Gardner argued this is a legitimate form of intelligence not measured by traditional IQ tests.",
        },
      },
      {
        heading: 'Educational Implications of Intelligence Theories',
        paragraphs: [
          '<ol><li><strong>Adopt a growth mindset framing (Dweck):</strong> Treat intelligence as developable rather than fixed. Praise effort, strategy, and improvement rather than innate ability. "You haven\'t mastered this yet" implies growth is possible.</li><li><strong>Use multiple pathways to learning (Gardner):</strong> Design lessons that allow students to engage through diverse intelligences — discussion (linguistic), graphs (spatial), movement (kinesthetic), group work (interpersonal). This increases access and engagement.</li><li><strong>Avoid labelling students by IQ or ability:</strong> Fixed ability grouping (tracking/streaming) consistently disadvantages lower-grouped students and reinforces ability beliefs.</li><li><strong>Identify and celebrate diverse talents:</strong> A student who struggles with academic tasks may excel in music, craft, sport, or social leadership. Recognising these abilities builds esteem and engagement.</li><li>Use formative assessment to understand how students think — not just what score they achieve.</li></ol>',
        ],
        exercise: {
          type: 'theory',
          prompt: "Using Gardner's theory of multiple intelligences, explain how a teacher could design a single lesson on 'The Water Cycle' that reaches learners with different intelligence profiles.",
          answer: "A single lesson on the water cycle can be designed to engage multiple intelligence types: 1. Linguistic intelligence: Students read a short passage about the water cycle and write a paragraph explaining it in their own words. A class discussion explores the vocabulary (evaporation, condensation, precipitation). 2. Logical-mathematical: Students are given a table of temperature and humidity data and asked to identify patterns that explain where evaporation is most rapid. They draw conclusions using reasoning. 3. Spatial: Students draw and label a detailed diagram of the water cycle from memory after viewing a reference image. They also examine satellite cloud maps. 4. Bodily-kinesthetic: Students physically act out the water cycle — some students become 'water molecules' that evaporate (move up), condense (cluster), and precipitate (move down). 5. Musical: The class learns a short mnemonic rhyme or song that encodes the stages of the water cycle for retention. 6. Interpersonal: Small groups create a mini-lesson to teach a section of the water cycle to another group using any method they choose. 7. Naturalist: Students go outside to observe local water bodies, vegetation, and cloud patterns and connect observations to the water cycle. This approach ensures that students whose strength is not linguistic or mathematical still have pathways to understanding and demonstrating knowledge.",
          explanation: "Gardner's multiple intelligences theory challenges teachers to provide diverse learning pathways — ensuring all students have genuine access to the curriculum regardless of their intelligence profile.",
        },
      },
    ],
  },

  // ── LESSON 22 ─────────────────────────────────────────────────────────────
  {
    lessonNumber: 22,
    title: 'Individual Differences in Learning',
    tags: ['individual-differences', 'learning-styles', 'diversity', 'ebs106'],
    chunks: [
      {
        heading: 'Sources of Individual Differences',
        illustration: {
          src: IMG.childStages,
          alt: 'Sequence showing diverse developmental stages in children',
          caption: 'Children differ in intelligence, learning style, pace, interests, and prior experience — even within the same classroom.',
          credit: 'Wikimedia Commons',
          mobile_position: 'after_last_paragraph',
          desktop_align: 'right',
        },
        paragraphs: [
          'Individual differences refer to the ways in which students differ from one another in characteristics relevant to learning. Key sources include: <strong>Cognitive abilities</strong> (intelligence, memory, processing speed), <strong>Prior knowledge and experience</strong>, <strong>Learning styles and preferences</strong>, <strong>Motivation and interest</strong>, <strong>Personality and temperament</strong>, and <strong>Cultural and linguistic background</strong>.',
          "Individual differences are not deficits — they are features of human diversity. The challenge for teachers is to design instruction that is flexible enough to meet a range of learners, rather than expecting all students to fit a single mould.",
        ],
        exercise: {
          type: 'multiple_choice',
          prompt: "Which of the following is the most appropriate teacher response to individual differences in learning?",
          options: [
            'Group all students by ability and teach each group identically within the group',
            'Ignore differences and teach the same lesson in the same way for all students',
            'Design flexible instruction that provides multiple pathways to learning and demonstration of understanding',
            'Focus only on the most able students to maximise academic outcomes',
          ],
          answer: 'Design flexible instruction that provides multiple pathways to learning and demonstration of understanding',
          explanation: "Individual differences require flexible, differentiated instruction — offering varied content, processes, and products so that diverse learners have genuine access to the curriculum and multiple ways to demonstrate understanding.",
        },
      },
      {
        heading: 'Learning Styles and Preferences',
        paragraphs: [
          "Learning style theories suggest that students prefer to receive information through different sensory channels. The VARK model (Fleming) categorises preferences as: <strong>Visual</strong> (diagrams, charts, maps), <strong>Auditory</strong> (lectures, discussion, audio), <strong>Reading/Writing</strong> (notes, text), and <strong>Kinesthetic</strong> (hands-on activity, movement, experiments).",
          "Note: While learning style preferences are real and worth accommodating, the research evidence for the 'meshing hypothesis' (students learn better when taught in their preferred style) is weak. The more robust finding is that varied, multimodal instruction benefits all learners. Teachers should use a variety of methods regardless of perceived student preferences.",
        ],
        exercise: {
          type: 'true_false',
          prompt: "Research strongly supports the 'meshing hypothesis' — the idea that students learn best when instruction is delivered exclusively in their preferred learning style (e.g., visual-only for visual learners).",
          options: ['True', 'False'],
          answer: 'False',
          explanation: "The meshing hypothesis lacks strong empirical support. What research does support is that varied, multimodal instruction benefits all learners. Teachers should use diverse methods, not restrict instruction to any single style.",
        },
      },
      {
        heading: 'Differentiated Instruction',
        paragraphs: [
          "Differentiated instruction (Tomlinson) is a framework for designing teaching that responds to the varied readiness levels, interests, and learning profiles of students. Teachers can differentiate in three dimensions: <strong>Content</strong> (what is taught), <strong>Process</strong> (how students engage with it), and <strong>Product</strong> (how students demonstrate understanding).",
          "Differentiation does not mean creating 30 different lesson plans. It means building in choice, providing scaffolding for those who need it and extension for those who are ready, using flexible grouping, and offering multiple representations of key ideas.",
        ],
        exercise: {
          type: 'fill_in',
          prompt: "Differentiated instruction can involve varying the ________ (what is taught), the process (how students engage), or the product (how students demonstrate understanding) to meet the needs of diverse learners.",
          answer: 'content',
          explanation: "Tomlinson's differentiated instruction framework identifies content, process, and product as the three dimensions teachers can adjust in response to student readiness, interest, and learning profile.",
        },
      },
      {
        heading: 'Teaching Diverse Learners Effectively',
        paragraphs: [
          '<ol><li><strong>Know your students:</strong> Conduct formative assessment early and regularly to understand each student\'s prior knowledge, strengths, and gaps. Use this data to adjust instruction, not to rank students.</li><li><strong>Use flexible grouping:</strong> Vary grouping based on task (sometimes by interest, sometimes by readiness, sometimes randomly). Avoid permanent ability groups that stigmatise lower-placed students.</li><li><strong>Offer scaffolding and extension:</strong> Provide additional support structures (sentence frames, worked examples, visual aids) for students who need them; offer enrichment tasks that deepen thinking for those who progress quickly.</li><li><strong>Use culturally responsive teaching:</strong> Connect content to students\' cultural backgrounds and lived experiences — this increases relevance and reduces barriers for learners from non-dominant cultural groups.</li></ol>',
        ],
        exercise: {
          type: 'theory',
          prompt: "You have a Primary 5 class where some students are reading well above grade level and others are still struggling with basic decoding. Describe how you would differentiate a reading lesson to address this wide range of abilities.",
          answer: "Strategy for differentiating a Primary 5 reading lesson: 1. Pre-assessment: Before the lesson, use a quick informal reading assessment to identify students' approximate reading levels: fluent readers, grade-level readers, and early/struggling readers. 2. Tiered texts (content differentiation): Use the same theme or topic but provide texts at three levels of complexity. All groups read about the same topic (e.g., 'The River') but at appropriately challenging text levels. This maintains dignity — no one knows their text is 'lower' if all books look similar. 3. Varied process: Fluent readers may read independently and annotate for main idea and supporting details. Grade-level readers read in pairs and discuss comprehension questions. Struggling readers read with teacher support or audio assistance, focusing on decoding and basic comprehension. 4. Flexible grouping: After reading, form mixed-ability discussion groups where each student contributes one insight from their reading. This values all contributions. 5. Choice in product: Students may write a summary, draw a story map, or tell the story to a partner — based on which format helps them best demonstrate understanding. 6. Extension for fluent readers: Provide a critical thinking question ('What would happen to the river community if the river dried up?') that requires inference and synthesis beyond literal comprehension.",
          explanation: "Differentiated instruction meets every student where they are — neither leaving struggling learners behind nor failing to challenge advanced learners. It requires planning, flexibility, and knowledge of individual students.",
        },
      },
    ],
  },

  // ── LESSON 23 ─────────────────────────────────────────────────────────────
  {
    lessonNumber: 23,
    title: 'Children with Special Educational Needs',
    tags: ['special-education', 'learning-disabilities', 'gifted', 'inclusion', 'ebs106'],
    chunks: [
      {
        heading: 'Defining Special Educational Needs',
        illustration: {
          src: IMG.specialNeeds,
          alt: 'Symbol representing special education and inclusive support',
          caption: 'Special educational needs encompass a wide range of differences in learning, communication, physical, and emotional functioning.',
          credit: 'Wikimedia Commons',
          mobile_position: 'between_paragraph_0_1',
          desktop_align: 'right',
        },
        paragraphs: [
          "Children with Special Educational Needs (SEN) are those who require additional educational support beyond what is typically provided in a standard classroom. SEN encompasses a broad spectrum: learning disabilities (dyslexia, dyscalculia), physical and sensory impairments, intellectual disabilities, speech and language disorders, autism spectrum conditions, emotional and behavioural difficulties, and giftedness.",
          "The term 'special needs' can be misleading — it is not a fixed category. A child's need for additional support is always relative to the demands of the environment. With the right support, most children with SEN can thrive academically and socially.",
        ],
        exercise: {
          type: 'multiple_choice',
          prompt: "Which of the following groups would typically be considered to have special educational needs?",
          options: [
            'Only children with physical disabilities',
            'Only children with intellectual disabilities',
            'A broad range including children with learning disabilities, sensory impairments, emotional difficulties, and giftedness',
            'Children from low-income families only',
          ],
          answer: 'A broad range including children with learning disabilities, sensory impairments, emotional difficulties, and giftedness',
          explanation: "SEN encompasses a wide spectrum: learning disabilities, sensory and physical impairments, emotional/behavioural difficulties, autism spectrum conditions, speech disorders, and giftedness — all represent differences that may require additional educational support.",
        },
      },
      {
        heading: 'Types of Learning Disabilities',
        paragraphs: [
          '<strong>Dyslexia</strong> — difficulty with accurate and fluent word reading and spelling, despite adequate intelligence and instruction. Children with dyslexia may struggle to decode words, have poor spelling, and read slowly. <strong>Dyscalculia</strong> — difficulty understanding numbers, number relationships, and mathematical operations. <strong>Dysgraphia</strong> — difficulty with written expression, including handwriting, spelling, and organising written work.',
          '<strong>Attention Deficit Hyperactivity Disorder (ADHD)</strong> — characterised by inattention, hyperactivity, and impulsivity. Children with ADHD struggle to sustain attention, manage impulses, and organise tasks. <strong>Autism Spectrum Condition (ASC)</strong> — differences in social communication, sensory processing, and patterns of behavior. Not a deficit — many children with ASC have significant strengths in areas of specific interest.',
        ],
        exercise: {
          type: 'true_false',
          prompt: "Dyslexia is caused by low intelligence, and children with dyslexia will not benefit from regular literacy instruction.",
          options: ['True', 'False'],
          answer: 'False',
          explanation: "Dyslexia is a specific learning difficulty in reading and spelling that is unrelated to overall intelligence. Many children with dyslexia are of average or above-average intelligence. With structured, explicit literacy instruction (particularly phonics-based approaches), most children with dyslexia can make significant progress.",
        },
      },
      {
        heading: 'Gifted and Talented Learners',
        paragraphs: [
          "Gifted and talented learners are those who demonstrate advanced ability, creativity, or motivation in one or more domains above what is expected for their age group. Giftedness may manifest in academic areas (mathematics, literacy, science), creative domains (art, music, writing), leadership, or athletic ability.",
          "Gifted learners are often overlooked in discussions of SEN, but they also have special educational needs: they may be chronically under-challenged, become disruptive through boredom, mask their abilities to fit in socially, or develop perfectionism and anxiety. They need curriculum extension, enrichment opportunities, and intellectual peers.",
        ],
        exercise: {
          type: 'fill_in',
          prompt: "Gifted and talented learners may develop ________ and anxiety when they are consistently under-challenged, or may deliberately hide their abilities to avoid social exclusion from peers.",
          answer: 'perfectionism',
          explanation: "When gifted learners are not appropriately challenged, they may develop unhealthy perfectionism (setting unrealistically high standards and becoming distressed by ordinary mistakes) and anxiety. Social masking (hiding ability) is also common among gifted students seeking peer acceptance.",
        },
      },
      {
        heading: 'Identifying and Supporting Learners with SEN',
        paragraphs: [
          '<ol><li><strong>Early identification:</strong> Watch for patterns of difficulty or exceptional ability that persist across contexts. Early intervention produces significantly better outcomes than delayed support.</li><li><strong>Avoid misattribution:</strong> Do not attribute SEN to laziness, bad character, or poor parenting. Learning difficulties are typically neurological in origin, not motivational.</li><li><strong>Use multi-tiered support:</strong> Begin with high-quality differentiated classroom instruction (Tier 1), add small-group targeted support (Tier 2) for those who need more, and refer for specialist assessment and intervention (Tier 3) for the most significant needs.</li><li><strong>Collaborate with families:</strong> Parents are the experts on their child. Involve them in assessment, planning, and support. Share observations respectfully and listen carefully.</li><li>For gifted learners: provide curriculum compacting (skipping content they already know), enrichment tasks, independent projects, and mentorship.</li></ol>',
        ],
        exercise: {
          type: 'theory',
          prompt: "A Primary 3 student has been in your class for three months. He is bright and verbal but consistently struggles to read and write. He reverses letters, reads very slowly, and his spelling is far below his peers. What might be happening, and how would you respond as his teacher?",
          answer: "What might be happening: The pattern — persistent reading and writing difficulty with letter reversals and slow decoding, combined with apparent intelligence and strong verbal ability — is consistent with dyslexia, a specific learning disability in literacy. Dyslexia is not caused by low intelligence; many dyslexic learners are verbally advanced. The contrast between verbal ability and literacy skills is itself a diagnostic indicator. As his teacher, I would: 1. Document carefully: Keep a dated record of specific literacy behaviors — which letters he reverses, words he consistently misreads, his reading fluency and comprehension. 2. Refer for formal assessment: Share concerns with the head teacher and school's support services. Recommend referral to a specialist (educational psychologist or learning support teacher) for formal dyslexia assessment. 3. Provide immediate classroom support (Tier 1 and 2): Use phonics-based, multisensory reading instruction — tracing letters in sand, associating sounds with mouth movements, using colour-coded vowels. Reduce copying tasks; accept verbal responses where possible. Allow more time for reading and writing. 4. Communicate with family: Have a private, caring conversation with parents. Explain specific observations without using scary labels. Ask what they've noticed at home. Reassure them that this is manageable with support. 5. Protect his dignity: Never correct his reading publicly or draw attention to his difficulties in front of peers.",
          explanation: "Early identification and multi-layered support for SEN — combined with family collaboration and classroom adjustment — dramatically improves outcomes for children with learning disabilities.",
        },
      },
    ],
  },

  // ── LESSON 24 ─────────────────────────────────────────────────────────────
  {
    lessonNumber: 24,
    title: 'Inclusive Education',
    tags: ['inclusive-education', 'special-needs', 'diversity', 'ebs106'],
    chunks: [
      {
        heading: 'Principles of Inclusive Education',
        illustration: {
          src: IMG.inclusion,
          alt: 'Symbol representing inclusive education',
          caption: 'Inclusive education ensures all learners — regardless of ability, background, or need — participate fully in the same learning community.',
          credit: 'Wikimedia Commons',
          mobile_position: 'between_paragraph_0_1',
          desktop_align: 'right',
        },
        paragraphs: [
          "Inclusive education is an approach in which all students — including those with disabilities, learning difficulties, and diverse backgrounds — learn together in the same regular classroom, with appropriate support. It is rooted in the belief that every child has the right to quality education in their community.",
          "The Salamanca Statement (UNESCO, 1994) is the foundational international commitment to inclusive education, asserting that schools should accommodate all children 'regardless of their physical, intellectual, social, emotional, linguistic or other conditions.' Inclusion is both a human rights issue and a pedagogical approach.",
        ],
        exercise: {
          type: 'multiple_choice',
          prompt: "Which of the following best describes inclusive education?",
          options: [
            'Placing all children with disabilities in separate special schools',
            'An approach in which all learners, including those with special needs, learn together in regular classrooms with appropriate support',
            'A system where gifted students are placed in advanced classes separate from others',
            'Ensuring that all students follow exactly the same curriculum without modification',
          ],
          answer: 'An approach in which all learners, including those with special needs, learn together in regular classrooms with appropriate support',
          explanation: "Inclusive education means all learners — including those with disabilities or special needs — participate in regular classrooms with peers, supported by appropriate adaptations and resources. Segregation into separate schools is the antithesis of inclusion.",
        },
      },
      {
        heading: 'Benefits of Inclusive Education',
        paragraphs: [
          'Research on inclusive education shows benefits for all students, not only those with SEN: <strong>For students with SEN:</strong> Better academic outcomes than in segregated settings; improved social skills through interaction with typically-developing peers; higher expectations that stimulate greater achievement; preparation for life in an inclusive society.',
          '<strong>For typically-developing students:</strong> Exposure to human diversity builds empathy, tolerance, and social intelligence. Learning to communicate and collaborate with peers of different abilities is a life skill. Research shows no negative effect on academic achievement for typically-developing students in inclusive classrooms when adequate support is provided.',
        ],
        exercise: {
          type: 'true_false',
          prompt: "Research shows that inclusion of learners with special needs negatively affects the academic achievement of typically-developing students in the same classroom.",
          options: ['True', 'False'],
          answer: 'False',
          explanation: "Research consistently shows that, with adequate support, inclusion does not negatively affect the academic achievement of typically-developing students. In fact, inclusive settings often benefit all students through improved teacher skills, more differentiated instruction, and a more empathetic classroom culture.",
        },
      },
      {
        heading: 'Barriers to Inclusive Education',
        paragraphs: [
          'Common barriers to successful inclusion include: <strong>Attitudinal barriers</strong> — negative beliefs among teachers, families, and communities about the capacity of children with disabilities to learn. <strong>Resource barriers</strong> — inadequate trained personnel, specialist support staff, assistive technology, and adapted materials. <strong>Structural barriers</strong> — inaccessible physical buildings, rigid curriculum, inflexible assessment systems.',
          '<strong>Teacher preparedness</strong> is the most frequently cited barrier. Many teachers feel insufficiently trained to meet diverse needs. Pre-service teacher education and in-service professional development in differentiation, SEN identification, and inclusive strategies are essential to effective inclusion.',
        ],
        exercise: {
          type: 'fill_in',
          prompt: "The most frequently cited barrier to successful inclusive education is inadequate ________ preparedness — teachers who have not received sufficient training in differentiation and special educational needs.",
          answer: 'teacher',
          explanation: "Teachers report insufficient training in inclusive strategies as the greatest barrier to inclusion. Effective inclusive education requires deliberate pre-service and in-service professional development focused on meeting diverse learner needs.",
        },
      },
      {
        heading: 'Strategies for Inclusive Teaching',
        paragraphs: [
          '<ol><li><strong>Universal Design for Learning (UDL):</strong> Design lessons from the outset to be accessible to all — multiple means of representation (how content is presented), action and expression (how students respond), and engagement (how students are motivated). Building in flexibility from the start reduces the need for individual accommodations later.</li><li><strong>Collaborative teaching:</strong> Work with special education teachers, support assistants, and specialists. Collaborative lesson planning and in-class support are more effective than pull-out models alone.</li><li><strong>Peer learning:</strong> Well-structured peer learning and cooperative activities support students with SEN while building social skills for all students.</li><li><strong>Assistive technology:</strong> Text-to-speech software, adapted keyboards, visual schedules, and audio-books make curriculum content accessible for diverse learners.</li><li>Adapt assessment: Allow alternative formats (oral response, extended time, scribes) so SEN students can demonstrate what they know without their disability masking their knowledge.</li></ol>',
        ],
        exercise: {
          type: 'theory',
          prompt: "A Primary 4 class includes a student with moderate hearing loss, a student with ADHD, a student with dyslexia, and a student who is gifted in mathematics. Describe how you would apply Universal Design for Learning (UDL) principles to plan a lesson on multiplication for this class.",
          answer: "Applying UDL principles — multiple means of representation, expression, and engagement — to a multiplication lesson: Multiple means of representation (how content is presented): 1. Verbal explanation with visual support: All teaching is accompanied by written key terms on the board, diagrams, and worked examples — this supports the student with hearing loss (who relies on visual information) and the dyslexic student (who benefits from multimodal input). 2. Provide a visual reference card with multiplication steps and anchor examples for the student with ADHD who may lose track during instruction. 3. Demonstrate multiplication with physical objects (counters, arrays) before moving to symbolic notation — this supports all learners by grounding abstract symbols in concrete experience. Multiple means of action and expression (how students demonstrate understanding): 1. Allow the student with dyslexia to show multiplication understanding using array drawings or counters rather than only written algorithms. 2. For the gifted student: provide a multiplication extension task requiring pattern recognition (e.g., 'What do you notice about all multiples of 9?') while others consolidate the core skill. 3. Allow oral responses for students who struggle with written expression. Multiple means of engagement (how students are motivated): 1. ADHD: Use short task intervals (5 minutes) with physical movement between tasks (e.g., walk to a partner to compare answers). 2. Offer a real-world multiplication problem all students find relevant. 3. Use collaborative pair work for practice so students with varied strengths support each other.",
          explanation: "UDL designs access for all learners from the outset — reducing the need for individual retrofits and ensuring all students can participate, learn, and demonstrate understanding.",
        },
      },
    ],
  },

  // ── LESSON 25 ─────────────────────────────────────────────────────────────
  {
    lessonNumber: 25,
    title: 'Family, Community, and Child Development',
    tags: ['family', 'community', 'development', 'culture', 'ebs106'],
    chunks: [
      {
        heading: 'The Role of Family in Development',
        illustration: {
          src: IMG.family,
          alt: 'Illustration of a family unit with children',
          caption: 'The family is the first and most enduring context of child development.',
          credit: 'Wikimedia Commons',
          mobile_position: 'between_paragraph_0_1',
          desktop_align: 'right',
        },
        paragraphs: [
          "The family is the primary context of child development — it is the first environment in which children develop language, values, attachment, social behaviour, and a sense of self. Bronfenbrenner's ecological systems theory places the family at the innermost ring of the child's developmental environment (the microsystem), recognising it as the most immediate and powerful influence.",
          "Family structure varies widely across cultures — nuclear families, extended families, single-parent households, foster families, and multi-generational arrangements all serve as developmental contexts. The quality of relationships within the family — particularly warmth, responsiveness, and consistency — matters more than family structure.",
        ],
        exercise: {
          type: 'multiple_choice',
          prompt: "According to Bronfenbrenner's ecological systems theory, which system represents the child's most immediate environment, including family, school, and peer group?",
          options: [
            'Macrosystem',
            'Exosystem',
            'Microsystem',
            'Chronosystem',
          ],
          answer: 'Microsystem',
          explanation: "The microsystem is the innermost ring of Bronfenbrenner's model — it includes the settings the child directly participates in (family, school, peer group, neighbourhood). It is the most immediate and powerful context of development.",
        },
      },
      {
        heading: 'Parenting Styles and Their Effects',
        paragraphs: [
          "Diana Baumrind (1966) identified three parenting styles based on the dimensions of <strong>demandingness</strong> (how much parents control and set expectations) and <strong>responsiveness</strong> (how much parents accept and support their children): <strong>Authoritative:</strong> High demandingness + high responsiveness. Parents set clear expectations with warmth and reasoning. <strong>Authoritarian:</strong> High demandingness + low responsiveness. Parents control through strict rules and punishment. <strong>Permissive:</strong> Low demandingness + high responsiveness. Parents are warm but set few limits.",
          "Research consistently shows that authoritative parenting produces the best developmental outcomes across cultures: higher academic achievement, better emotional regulation, stronger social skills, and greater self-esteem. Authoritarian parenting is associated with lower self-esteem and higher anxiety. Permissive parenting is associated with impulsivity and difficulty with self-regulation.",
        ],
        exercise: {
          type: 'true_false',
          prompt: "Research shows that authoritative parenting — combining high warmth with clear expectations — consistently produces better child outcomes than authoritarian or permissive approaches.",
          options: ['True', 'False'],
          answer: 'True',
          explanation: "Cross-cultural research consistently finds that authoritative parenting (high warmth + high expectations + reasoning) produces the best outcomes: academic achievement, emotional regulation, self-esteem, and social competence. This finding holds across diverse cultures.",
        },
      },
      {
        heading: 'Community and Cultural Influences',
        paragraphs: [
          "Vygotsky emphasised that development is fundamentally social and cultural — children develop within cultural communities that shape what skills, values, and knowledge are acquired. The cultural tools a society provides (language, number systems, writing, technology) are internalised by children through social interaction.",
          "Community factors such as neighbourhood safety, access to quality schools, healthcare, recreational facilities, and social networks all shape children's developmental opportunities. Chronic poverty, neighbourhood violence, and community instability are significant risk factors for development. Strong community institutions (religious organisations, community centres, sports clubs) serve as protective factors.",
        ],
        exercise: {
          type: 'fill_in',
          prompt: "Vygotsky argued that children internalise ________ tools provided by their culture — such as language, counting systems, and written symbols — through social interaction with more knowledgeable others.",
          answer: 'cultural',
          explanation: "Vygotsky's sociocultural theory holds that cognitive development is fundamentally shaped by cultural tools (language, writing, number systems, technology) that are transmitted through social interaction. What children learn reflects what their cultural community values and makes available.",
        },
      },
      {
        heading: 'School-Family Collaboration',
        paragraphs: [
          '<ol><li><strong>Communicate regularly and positively:</strong> Build relationships with families before problems arise. Send home positive news as well as concerns. Use the family\'s preferred language and communication channel.</li><li><strong>Respect diverse family structures and values:</strong> Avoid assuming a nuclear family model. Show equal respect for all family configurations and cultural practices.</li><li><strong>Involve families in learning:</strong> Share what children are studying. Encourage home-based learning activities that connect school content to the child\'s cultural context.</li><li><strong>Acknowledge family expertise:</strong> Parents are the experts on their child\'s history, preferences, and home context. Listen as much as you speak in family meetings.</li><li>Recognise family constraints: Many families face time, language, and logistical barriers to school involvement. Provide flexible times and translation support where needed.</li></ol>',
        ],
        exercise: {
          type: 'theory',
          prompt: "Research shows that parental involvement in education significantly improves children's academic outcomes. Describe three practical strategies a primary school teacher could use to build stronger partnerships with the families of their students.",
          answer: "Practical strategies for building family-school partnerships: 1. Regular, two-way communication: Send home a brief weekly note (or SMS) sharing one specific positive observation about each child's week and one area of growth. This builds trust before difficult conversations are needed. Invite families to respond. Use a communication log to track contact and ensure no family is consistently missed. 2. Family learning events: Host a termly 'learning showcase' where students present their work to families. Design it so families can engage rather than just observe — e.g., station activities where parents work with their child on a short task. This builds understanding of what children are learning and reduces the alienation many families feel from formal schooling. 3. Home-school activity bags: Send home weekly 'family learning bags' with simple, culturally connected activities that invite parents to discuss a topic with their child (e.g., 'Interview an elder in your family about their childhood school experience'). This acknowledges that learning happens at home and that family knowledge is valued. All three strategies share key principles: they are relationship-building (not just problem-reporting), they acknowledge family expertise, and they reduce barriers to involvement by making participation accessible within diverse family circumstances.",
          explanation: "Family-school partnerships that are respectful, culturally sensitive, and genuinely two-way significantly improve children's academic engagement, attendance, and achievement.",
        },
      },
    ],
  },

  // ── LESSON 26 ─────────────────────────────────────────────────────────────
  {
    lessonNumber: 26,
    title: "The Teacher's Role in Child and Adolescent Development",
    tags: ['teacher-role', 'child-development', 'classroom-practice', 'ebs106'],
    chunks: [
      {
        heading: "Understanding Developmental Needs in the Classroom",
        illustration: {
          src: IMG.teacher,
          alt: 'Teacher interacting with students in a classroom',
          caption: "A developmentally informed teacher adapts instruction, environment, and relationships to meet learners' needs at each stage.",
          credit: 'Wikimedia Commons',
          mobile_position: 'between_paragraph_0_1',
          desktop_align: 'right',
        },
        paragraphs: [
          "Understanding child and adolescent development is not an academic exercise — it is practical knowledge that shapes every decision a teacher makes: what to teach, how to teach it, how to organise the classroom, how to respond to behaviour, and how to support learners who are struggling.",
          "A developmentally informed teacher recognises that student behaviour always has a developmental context. A 6-year-old who cannot sit still, a 9-year-old who is intensely rule-focused, a 14-year-old who is preoccupied with peer opinion — all are behaving in developmentally predictable ways. Responding with patience, strategy, and knowledge is what separates effective teaching from mere management.",
        ],
        exercise: {
          type: 'multiple_choice',
          prompt: "A developmentally informed teacher who notices a 14-year-old student constantly seeking peer approval would most likely interpret this as:",
          options: [
            'A disciplinary problem requiring immediate punishment',
            'A sign of low intelligence',
            'A developmentally normal expression of adolescent social development',
            'Evidence of poor parenting',
          ],
          answer: 'A developmentally normal expression of adolescent social development',
          explanation: "Seeking peer approval and peer validation is a hallmark of adolescent development — it reflects the Identity vs. Role Confusion stage (Erikson), the imaginary audience (Piaget/Elkind), and the heightened peer orientation of adolescence. It is developmentally normal and calls for understanding, not punishment.",
        },
      },
      {
        heading: 'Creating Developmentally Appropriate Classrooms',
        paragraphs: [
          "A developmentally appropriate classroom is one where the physical environment, instructional approaches, expectations, and relationships are calibrated to the developmental stage of the learners. For primary-age children, this means concrete materials, movement, play-based learning, and predictable routines. For adolescents, it means autonomy, meaningful challenge, peer collaboration, and authentic tasks.",
          "Developmentally appropriate practice (DAP) is not 'dumbing down' — it is ensuring that instruction is accessible at the child's current level while supporting growth to the next. This requires ongoing formative assessment, flexibility, and knowledge of development.",
        ],
        exercise: {
          type: 'true_false',
          prompt: "Developmentally appropriate practice means teaching only what students already know and avoiding any challenging content.",
          options: ['True', 'False'],
          answer: 'False',
          explanation: "Developmentally appropriate practice means calibrating instruction to learners' current developmental level while supporting growth to the next — it is about the right challenge at the right time. It is not about avoiding difficulty; it is about ensuring challenge is appropriately scaffolded.",
        },
      },
      {
        heading: 'Assessment and Observation of Development',
        paragraphs: [
          'Observation is a fundamental professional skill for teachers. Systematic observation of how children play, interact, communicate, solve problems, and respond to setbacks provides insight into developmental level, learning style, social-emotional wellbeing, and emerging difficulties that formal tests cannot capture.',
          'Assessment for development should be: <strong>Ongoing</strong> (not just at the end of term), <strong>Multidimensional</strong> (cognitive, social, emotional, physical), <strong>Contextualised</strong> (observed in natural settings, not just test conditions), and <strong>Used to adjust instruction</strong> (not just to assign grades). Portfolio-based assessment, anecdotal records, and structured observation tools are all valuable instruments.',
        ],
        exercise: {
          type: 'fill_in',
          prompt: "Systematic ________ of how children interact, play, communicate, and solve problems provides insight into developmental level and emerging difficulties that formal assessments alone cannot capture.",
          answer: 'observation',
          explanation: "Observation is a core professional skill for teachers. It provides a window into development — cognitive, social, emotional, and physical — in natural contexts. Combined with formal assessment, it gives a fuller picture of each child.",
        },
      },
      {
        heading: 'Professional Responsibilities of the Developmentally Informed Teacher',
        paragraphs: [
          '<ol><li><strong>Commit to continuous learning:</strong> Child development research continues to advance. Teachers have a professional responsibility to remain current — reading, attending professional development, and reflecting on practice in the light of new evidence.</li><li><strong>Collaborate with colleagues:</strong> Share observations, strategies, and concerns about individual learners. No teacher supports development alone — it requires a whole-school approach.</li><li><strong>Act as a protective factor:</strong> For many children facing adversity at home or in the community, a caring, consistent teacher is the most powerful protective factor in their lives. Relationships matter as much as instruction.</li><li><strong>Refer appropriately:</strong> Recognise the limits of your role. When developmental concerns exceed classroom support capacity, refer promptly to counsellors, special educators, health workers, or social services.</li><li>Model the dispositions you want to develop in children: curiosity, honesty, perseverance, care for others, and intellectual humility.</li></ol>',
        ],
        exercise: {
          type: 'theory',
          prompt: "Reflect on the statement: 'A teacher who understands child and adolescent development is a better teacher.' Drawing on at least three concepts from this course, explain and justify this claim.",
          answer: "The statement is well-supported by evidence across the course: 1. Developmental readiness (maturation): A teacher who understands maturation knows not to introduce tasks a child is not yet developmentally ready for. They recognise frustration as a possible sign of unreadiness rather than laziness, and adjust instruction accordingly. This produces less stress, more success, and more genuine learning. 2. Psychosocial needs (Erikson): A teacher who understands that primary school children are navigating Industry vs. Inferiority knows to design achievable challenges, celebrate genuine competence, and protect children from humiliation. They create the conditions for children to develop a sense of capability — which is foundational to academic confidence. 3. Motivation (self-determination theory, attribution theory): A teacher who understands motivation knows that effort-focused praise promotes resilience, that autonomy increases engagement, and that repeated failure without support produces learned helplessness. They design instruction and feedback accordingly — producing students who try harder and persist longer. 4. Social-emotional development: A teacher who understands emotional development knows that children cannot learn in emotionally unsafe environments. They invest in relationships, validate feelings, and address conflict constructively. The resulting classroom climate enables all students to take the cognitive risks that learning requires. In each case, developmental knowledge translates directly into better decisions — about what to teach, how to teach it, how to respond to behaviour, and how to build the relationships that make learning possible.",
          explanation: "Developmental knowledge is practical professional knowledge. A teacher who understands how children grow — physically, cognitively, socially, emotionally, and morally — is equipped to create environments where all children can develop and learn.",
        },
      },
    ],
  },

];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const wrapHtml = (text) => (String(text).trimStart().startsWith('<') ? text : `<p>${text}</p>`);
const stripHtml = (v = '') => String(v).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const buildLessonDocument = (lesson) => ({
  schema_version: 'lesson_document.v2',
  source: 'ebs106_seed',
  lesson_number: lesson.lessonNumber,
  main_topic: lesson.title,
  lesson_details: { main_topic: lesson.title },
  chunks: lesson.chunks.map((chunk, idx) => ({
    id: `chunk_${idx}`,
    heading: chunk.heading,
    chunk_head: chunk.heading,
    illustration: chunk.illustration || null,
    paragraphs: chunk.paragraphs.map((p, pi) => ({ id: `par_${pi}`, body_html: wrapHtml(p) })),
    chunk_content: chunk.paragraphs.reduce((acc, p, pi) => {
      acc[`par_${pi}`] = { id: `par_${pi}`, body_html: wrapHtml(p) };
      return acc;
    }, {}),
  })),
});

const buildExercises = (lesson) =>
  lesson.chunks.map((chunk, idx) => ({
    id: `L${lesson.lessonNumber}C${idx}`,
    chunk_id: `chunk_${idx}`,
    ...chunk.exercise,
  }));

const summarise = (lesson) => {
  for (const c of lesson.chunks) {
    for (const p of c.paragraphs) {
      const t = stripHtml(p);
      if (t) return t.slice(0, 240);
    }
  }
  return lesson.title;
};

const wordCount = (doc) =>
  stripHtml(doc.chunks.flatMap((c) => c.paragraphs.map((p) => p.body_html)).join(' '))
    .split(/\s+/).filter(Boolean).length;

const jsonContains = (key, value) =>
  db.sequelize.where(
    db.sequelize.cast(db.sequelize.col('metadata'), 'jsonb'),
    '@>',
    JSON.stringify({ [key]: value })
  );

async function upsertMeta(contentId, metadata) {
  const ex = await db.ContentMetadata.findOne({ where: { content_id: contentId } });
  const payload = { course: metadata.course || null, topic: metadata.topic || null, level: metadata.level || null, subject: metadata.category || null, metadata };
  if (ex) await ex.update(payload);
  else await db.ContentMetadata.create({ content_id: contentId, ...payload });
}

async function ensureStats(contentId) {
  const ex = await db.ContentStats.findOne({ where: { content_id: contentId } });
  if (!ex) await db.ContentStats.create({ content_id: contentId, total_views: 0, last_updated: new Date() });
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  await db.sequelize.authenticate();

  const COURSE_CODE_VAL = 'EBS 106';
  const COURSE_TITLE_VAL = 'Child and Adolescent Development and Learning';

  const course = await db.Course.findOne({
    where: { [Op.or]: [{ code: COURSE_CODE_VAL }, { title: COURSE_TITLE_VAL }, { key: COURSE_KEY }] },
    include: [{ model: db.CourseOffering, as: 'offerings', attributes: ['level', 'semester'], required: false }],
  });

  if (!course) throw new Error('Course not found. Run seed_ebs106_child_development.js first to create the course.');

  const courseLevel = course.offerings?.[0]?.level || '100';
  const courseSemester = course.offerings?.[0]?.semester || '2';

  const creator = await db.User.findOne({
    where: { role: { [Op.in]: ['admin', 'contributor', 'lecturer', 'student'] } },
    order: [['created_at', 'ASC']],
  });
  if (!creator) throw new Error('No user found to assign as lesson creator.');

  for (const lesson of LESSONS) {
    const lessonDocument = buildLessonDocument(lesson);
    const exercises = buildExercises(lesson);
    const description = summarise(lesson);
    const words = wordCount(lessonDocument);
    const duration = Math.max(6, Math.round(words / 160));

    const metadata = {
      slug: `ebs106-lesson-${lesson.lessonNumber}`,
      category: COURSE_TITLE_VAL,
      topic: lesson.title,
      course: COURSE_TITLE_VAL,
      course_id: course.id,
      course_title: COURSE_TITLE_VAL,
      course_name: COURSE_TITLE_VAL,
      course_code: COURSE_CODE_VAL,
      level: courseLevel,
      semester: courseSemester,
      lesson_number: lesson.lessonNumber,
      sequence: lesson.lessonNumber,
      summary: description,
      reading_time: duration,
      duration_minutes: duration,
      source: 'ebs106_seed',
      lesson_document: lessonDocument,
      exercises,
      objectives: [
        `Explain the core concepts in "${lesson.title}".`,
        'Connect the lesson content to practical classroom teaching decisions.',
      ],
    };

    let existing = await db.Lesson.findOne({
      where: {
        title: lesson.title,
        [Op.or]: [
          { course_id: course.id },
          db.sequelize.where(
            db.sequelize.cast(db.sequelize.col('metadata'), 'jsonb'),
            '@>',
            JSON.stringify({ course_id: course.id })
          ),
        ],
      },
    });
    if (!existing) {
      existing = await db.Lesson.findOne({
        where: {
          title: lesson.title,
          [Op.or]: [
            db.sequelize.where(
              db.sequelize.cast(db.sequelize.col('metadata'), 'jsonb'),
              '@>',
              JSON.stringify({ course_code: COURSE_CODE_VAL })
            ),
            db.sequelize.where(
              db.sequelize.cast(db.sequelize.col('metadata'), 'jsonb'),
              '@>',
              JSON.stringify({ course: COURSE_TITLE_VAL })
            ),
          ],
        },
      });
    }

    if (existing) {
      await existing.update({
        description,
        status: 'published',
        is_premium: false,
        creator_id: existing.creator_id || creator.id,
        duration_minutes: duration,
        word_count: words,
        tags: Array.from(new Set([...(existing.tags || []), ...lesson.tags, 'lesson', 'ebs106'])),
        lesson_document: lessonDocument,
        exercises,
        objectives: metadata.objectives,
        course_id: course.id,
        lesson_number: lesson.lessonNumber,
        level: courseLevel,
        semester: courseSemester,
        metadata: { ...(existing.metadata || {}), ...metadata },
        published_at: existing.published_at || new Date(),
      });
      await upsertMeta(existing.id, { ...(existing.metadata || {}), ...metadata });
      await ensureStats(existing.id);
      console.log(`  Updated  L${lesson.lessonNumber}: ${lesson.title}`);
    } else {
      const created = await db.Lesson.create({
        title: lesson.title,
        description,
        course_id: course.id,
        lesson_number: lesson.lessonNumber,
        creator_id: creator.id,
        status: 'published',
        is_premium: false,
        duration_minutes: duration,
        word_count: words,
        tags: [...lesson.tags, 'lesson', 'ebs106'],
        lesson_document: lessonDocument,
        exercises,
        objectives: metadata.objectives,
        level: courseLevel,
        semester: courseSemester,
        slug: metadata.slug,
        source: 'ebs106_seed',
        metadata,
        published_at: new Date(),
      });
      await upsertMeta(created.id, metadata);
      await ensureStats(created.id);
      console.log(`  Created  L${lesson.lessonNumber}: ${lesson.title}`);
    }
  }

  console.log(`\nDone — seeded ${LESSONS.length} lessons (14–26) for ${COURSE_TITLE_VAL}.`);
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => db.sequelize.close());
