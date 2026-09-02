/* eslint-disable no-console */
/**
 * Seed: EBS 106 — Child and Adolescent Development and Learning
 * 26 lessons · lesson_document.v2 schema · mixed exercise types
 */
const { Op } = require('sequelize');
const db = require('../models');

const COURSE_CODE = 'EBS 106';
const COURSE_TITLE = 'Child and Adolescent Development and Learning';
const COURSE_KEY = 'ebs106-child-adolescent-development';

// Wikimedia Commons images via Special:Redirect (no hash needed)
const img = (filename) =>
  `https://commons.wikimedia.org/w/index.php?title=Special%3ARedirect%2Ffile%2F${encodeURIComponent(filename)}&width=480`;

const IMG = {
  growth:       img('Human_growth_curve.svg'),
  childStages:  img('Developmental_stages_of_a_young_child.jpg'),
  prenatal:     img('Prenatal_development_table.svg'),
  piaget:       img('Piaget_theory.svg'),
  language:     img('Language_acquisition_device.svg'),
  workingMem:   img('Baddeley_working_memory.svg'),
  social:       img('Children_playing_in_Uganda.jpg'),
  emotions:     img('Basic_emotions.svg'),
  kohlberg:     img('Kohlbergs_stages_of_moral_development.svg'),
  erikson:      img('Eriksons_stages_of_psychosocial_development.png'),
  adolescence:  img('Adolescence.jpg'),
  identity:     img('Identity_formation.svg'),
  play:         img('Children_playing_on_grass.jpg'),
  pavlov:       img('Classical_conditioning_diagram.svg'),
  skinner:      img('Operant_conditioning_diagram.svg'),
  bandura:      img('Social_cognitive_theory.svg'),
  maslow:       img('MaslowsHierarchyOfNeeds.svg'),
  motivation:   img('Intrinsic_and_extrinsic_motivation.svg'),
  attribution:  img('Attribution_theory.svg'),
  intelligence: img('Gardner_multiple_intelligences.svg'),
  specialNeeds: img('Special_education_symbol.svg'),
  inclusion:    img('Inclusion_symbol.svg'),
  family:       img('Family_portrait.svg'),
  teacher:      img('Teacher_and_students.jpg'),
};

const COURSE_PRELIMS = {
  outline:
    'This course examines the physical, cognitive, social, emotional, and moral development of children and adolescents, connecting developmental theories to practical classroom teaching decisions.',
  description:
    'Child and Adolescent Development and Learning equips student teachers to understand how learners grow and change across the lifespan, bridging developmental science and everyday classroom practice.',
  requirements:
    'Engage critically with developmental theories, connect concepts to classroom practice, and compare developmental stages rather than memorising isolated definitions.',
  big_picture:
    'A teacher who understands child and adolescent development can create age-appropriate learning environments, set realistic expectations, and respond sensitively to each learner. This course builds that foundational understanding.',
  introduction:
    'Welcome to Child and Adolescent Development and Learning. These lessons examine how children and adolescents grow physically, think cognitively, relate socially, feel emotionally, and develop moral judgement — and what those patterns mean for teachers in real classrooms.',
};

// ─── LESSONS ──────────────────────────────────────────────────────────────────

const LESSONS = [

  // ── LESSON 1 ──────────────────────────────────────────────────────────────
  {
    lessonNumber: 1,
    title: 'The Concept of Growth and Development',
    tags: ['child-development', 'growth', 'development', 'maturation', 'ebs106'],
    chunks: [
      {
        heading: 'The Meaning of Growth',
        illustration: {
          src: IMG.growth,
          alt: 'Diagram illustrating the human growth curve from infancy to adulthood',
          caption: 'Growth follows a predictable curve — rapid early in life, slower through childhood, and peaking in late adolescence.',
          credit: 'Wikimedia Commons',
          mobile_position: 'between_paragraph_0_1',
          desktop_align: 'right',
        },
        paragraphs: [
          'Growth is the increase in size and structure of parts of the body. It refers to the permanent increase in the number of cells acquired by an organism during development — for example, an increase in height, weight, or the size of any body organ.',
          'Growth is primarily physical and can therefore be observed, compared, and measured. It is quantitative in nature and is typically expressed in grams or centimetres. Common statements like "Kojo has grown tall" or "Ama is gaining weight rapidly" describe growth.',
        ],
        exercise: {
          type: 'multiple_choice',
          prompt: 'Which of the following best describes the nature of growth?',
          options: [
            'Growth is qualitative and cannot be directly measured',
            'Growth refers to a permanent increase in size and structure, and is quantitative',
            'Growth and development refer to the same phenomenon',
            'Growth involves psychological changes in behaviour',
          ],
          answer: 'Growth refers to a permanent increase in size and structure, and is quantitative',
          explanation: 'Growth is quantitative — it can be measured in grams or centimetres and refers to permanent increases in cell number or body size. Development is the broader qualitative concept.',
        },
      },
      {
        heading: 'The Meaning of Development',
        paragraphs: [
          'Development refers to the qualitative changes an individual undergoes over the course of their lifespan. It implies an increase in one\'s ability to function efficiently. A baby who once crawled and can now walk demonstrates a qualitative change in functionality — this is development.',
          'Development is broader than growth. It involves qualitative and quantitative changes across physical, cognitive, social, emotional, and moral dimensions. A child\'s ability to walk or speak depends on a certain level of physical growth or maturation.',
        ],
        exercise: {
          type: 'true_false',
          prompt: 'Development refers only to physical changes and can always be directly measured.',
          options: ['True', 'False'],
          answer: 'False',
          explanation: 'Development is broader than physical change. It includes qualitative changes across cognitive, emotional, social, and moral dimensions, and cannot always be directly measured.',
        },
      },
      {
        heading: 'Differences Between Growth and Development',
        paragraphs: [
          '<ol><li>Growth is quantitative and directly measurable; development involves qualitative changes that are not always measurable.</li><li>Growth refers to physical changes in size and structure; development encompasses all dimensions of change in a person.</li><li>Growth may stop at a certain point (e.g., height ceases in adulthood); development continues throughout life.</li><li>Growth is a component of development — development requires some degree of physical growth to proceed.</li></ol>',
        ],
        exercise: {
          type: 'fill_in',
          prompt: 'While growth is ________ in nature and can be directly measured, development involves qualitative changes across multiple dimensions of the person.',
          answer: 'quantitative',
          explanation: 'Growth is quantitative — it is expressed in measurable units. Development is qualitative, referring to changes in ability and function that may not always be directly measured.',
        },
      },
      {
        heading: 'The Meaning of Maturation',
        paragraphs: [
          'Maturation is the process of gradually bringing an individual\'s physical, physiological, and psychological features to full development. It occurs across the sense organs, nervous system, psychomotor abilities, intellectual functions, and emotional responses.',
          'Maturation is largely biologically driven and follows a predictable sequence, though the rate varies among individuals. It leads to increasingly complex behaviours as organs and systems develop in structure and function.',
        ],
        exercise: {
          type: 'theory',
          prompt: 'Explain the concept of maturation and describe two ways it affects a child\'s readiness to learn in the classroom.',
          answer: 'Maturation is the biologically driven process of bringing physical, physiological, and psychological features to full development. It follows a predictable sequence controlled largely by genetics. Example 1: A child\'s hand muscles must mature before they can grip a pencil correctly for writing. Example 2: The brain\'s language areas must mature sufficiently before a child can benefit from formal reading instruction. Teachers must match tasks to the child\'s level of maturation to avoid frustration and promote learning.',
          explanation: 'Maturation creates developmental readiness — the point at which a child can benefit from a particular type of instruction or activity. Teaching ahead of maturation leads to frustration; teaching in alignment with it leads to rapid progress.',
        },
      },
      {
        heading: 'Key Notes for Teachers: Readiness and Maturation',
        paragraphs: [
          '<ol><li><strong>Match instruction to maturation:</strong> Teachers should ensure that teaching aligns with the child\'s developmental stage, not just chronological age.</li><li><strong>Recognise signs of readiness:</strong> Frustration and refusal often signal that a child is not yet mature enough for a task. Rapid progress signals that readiness has been reached.</li><li><strong>Avoid premature instruction:</strong> Do not introduce tasks the child is not yet mature enough to handle. Doing so creates negative associations with learning.</li></ol>',
        ],
        exercise: {
          type: 'multiple_choice',
          prompt: 'A Grade 1 teacher notices that a student becomes frustrated when asked to write in cursive. Based on the concept of maturation, the most appropriate response is to:',
          options: [
            'Penalise the student for poor effort',
            'Assess whether the child\'s fine motor development supports the task',
            'Move the child to a lower class immediately',
            'Increase the amount of cursive practice',
          ],
          answer: 'Assess whether the child\'s fine motor development supports the task',
          explanation: 'Frustration can signal developmental unreadiness. The teacher should first assess whether the child\'s fine motor maturation supports cursive writing before assuming the issue is effort.',
        },
      },
    ],
  },

  // ── LESSON 2 ──────────────────────────────────────────────────────────────
  {
    lessonNumber: 2,
    title: 'Principles and Patterns of Development',
    tags: ['child-development', 'principles', 'patterns', 'ebs106'],
    chunks: [
      {
        heading: 'Development is Continuous and Cumulative',
        illustration: {
          src: IMG.childStages,
          alt: 'Sequence showing developmental stages of a young child',
          caption: 'Development is continuous — each stage builds on what came before.',
          credit: 'Wikimedia Commons',
          mobile_position: 'after_last_paragraph',
          desktop_align: 'right',
        },
        paragraphs: [
          'Development is a continuous process that begins at conception and continues throughout life. There are no abrupt breaks; each stage builds on previous stages. A child\'s ability to speak depends on earlier babbling, which depended on earlier vocalisations.',
          'Development is also cumulative — skills and abilities acquired early serve as the foundation for more complex skills later. Early language exposure, for example, shapes reading readiness and academic achievement years later.',
        ],
        exercise: {
          type: 'multiple_choice',
          prompt: 'Which principle of development states that early experiences form the foundation for later abilities?',
          options: [
            'Development is discontinuous',
            'Development is cumulative and continuous',
            'Development is uniform across individuals',
            'Development is only biological',
          ],
          answer: 'Development is cumulative and continuous',
          explanation: 'Development is continuous (no abrupt breaks) and cumulative (each stage builds on the previous). Early experiences and skills lay the groundwork for later, more complex development.',
        },
      },
      {
        heading: 'Development Follows a Predictable Sequence',
        paragraphs: [
          'Development follows an orderly and predictable sequence, though individuals differ in pace. Children learn to sit before they stand, stand before they walk, and walk before they run. Similarly, children can count objects before they can perform arithmetic.',
          'Two important principles describe this sequence: <strong>cephalocaudal development</strong> (from head to tail — control of the head and neck develops before control of the legs) and <strong>proximodistal development</strong> (from the centre outward — control of the shoulder precedes control of the fingers).',
        ],
        exercise: {
          type: 'true_false',
          prompt: 'Cephalocaudal development means that motor control develops from the extremities (hands and feet) toward the centre of the body.',
          options: ['True', 'False'],
          answer: 'False',
          explanation: 'Cephalocaudal development means control develops from head to tail — the head and upper body gain control before the lower body. Proximodistal means development proceeds from the centre outward to the extremities.',
        },
      },
      {
        heading: 'Individual Differences in Development',
        paragraphs: [
          'Although development follows a predictable sequence, the rate of development varies considerably from child to child. Two children of the same age may be at different developmental stages — one may walk at 10 months and another at 14 months, yet both are within the normal range.',
          'Individual differences arise from a combination of hereditary factors (genes) and environmental factors (nutrition, stimulation, relationships, culture). Teachers must recognise these differences and avoid treating developmental milestones as rigid deadlines.',
        ],
        exercise: {
          type: 'fill_in',
          prompt: 'Although development follows a ________ sequence, the rate at which individuals progress through that sequence varies considerably.',
          answer: 'predictable',
          explanation: 'Development follows a predictable order (e.g., sitting before standing), but the pace varies between individuals due to hereditary and environmental factors.',
        },
      },
      {
        heading: 'Heredity and Environment in Development',
        paragraphs: [
          'Development is shaped by an interaction between heredity (nature) and environment (nurture). Heredity provides the genetic blueprint — it sets potential ranges for physical growth, intelligence, and temperament. Environment determines how much of that potential is actualised.',
          'Factors such as nutrition, healthcare, family relationships, schooling, and cultural practices all influence development. Neither heredity nor environment alone determines outcomes; both work together in complex, ongoing ways throughout a child\'s life.',
        ],
        exercise: {
          type: 'theory',
          prompt: 'Using specific examples, explain how both heredity and environment interact to influence a child\'s development.',
          answer: 'Heredity provides the genetic blueprint for development — for example, a child may inherit genes that predispose them to tall stature or high intellectual potential. However, environment determines whether that potential is realised: a genetically tall child who is severely malnourished may not reach their potential height; a child with high intellectual potential who lacks stimulation may not develop it fully. Another example: a child may inherit a predisposition to anxiety, but warm and responsive parenting can mitigate its expression. Development is always the result of nature and nurture working together.',
          explanation: 'The nature-nurture interaction is fundamental to understanding development. Neither genes nor environment alone determines outcomes. Teachers should focus on creating positive environments that help all children realise their potential.',
        },
      },
    ],
  },

  // ── LESSON 3 ──────────────────────────────────────────────────────────────
  {
    lessonNumber: 3,
    title: 'Physical Development of the Child',
    tags: ['child-development', 'physical-development', 'motor-development', 'ebs106'],
    chunks: [
      {
        heading: 'Overview of Physical Development',
        paragraphs: [
          'Physical development refers to changes in height, weight, bone thickness, muscles, teeth, hair, the brain, and the sense organs (eyes, ears, nose). Motor skills such as learning to walk and write are also part of physical development.',
          'Physical development is rapid during infancy and again during puberty (adolescence). Between these periods, it proceeds more slowly and steadily. Teachers must understand these patterns to set appropriate physical activity expectations at each stage.',
        ],
        exercise: {
          type: 'multiple_choice',
          prompt: 'Which of the following is NOT typically included in the study of physical development?',
          options: [
            'Changes in height and weight',
            'Development of gross and fine motor skills',
            'Changes in personality and identity',
            'Development of the brain and sense organs',
          ],
          answer: 'Changes in personality and identity',
          explanation: 'Physical development covers bodily changes — height, weight, bone, muscle, brain, and motor skills. Personality and identity are aspects of psychosocial development, not physical development.',
        },
      },
      {
        heading: 'Motor Development: Gross and Fine Skills',
        paragraphs: [
          'Motor development involves the child\'s ability to control and coordinate body movements. <strong>Gross motor skills</strong> involve large muscle groups and include running, jumping, throwing, and climbing. <strong>Fine motor skills</strong> involve smaller muscles — particularly in the fingers — and include writing, knitting, lacing shoes, and threading beads.',
          'Gross motor skills develop before fine motor skills, consistent with the cephalocaudal and proximodistal principles. Most children can walk (gross motor) long before they can hold a pencil correctly (fine motor).',
        ],
        exercise: {
          type: 'true_false',
          prompt: 'Fine motor skills, such as running and jumping, develop before gross motor skills in young children.',
          options: ['True', 'False'],
          answer: 'False',
          explanation: 'Gross motor skills (running, jumping, climbing) develop before fine motor skills (writing, threading beads). This follows the cephalocaudal and proximodistal principles of development.',
        },
      },
      {
        heading: 'Stages in Physical Growth and Changes',
        paragraphs: [
          'During <strong>infancy (birth–2 years)</strong>, the average baby weighs about 3 kg and is roughly 50 cm long. Growth is rapid — weight and height often double by four months. Bones are soft and cartilaginous. By the end of infancy, the senses reach near-adult levels.',
          'During <strong>childhood (2–11 years)</strong>, growth slows relative to infancy. Limb growth accelerates in middle childhood, and permanent teeth begin appearing around age six. During <strong>adolescence (11–18 years)</strong>, a rapid growth spurt occurs alongside puberty. Boys develop deeper voices and muscle mass; girls develop breasts and wider hips. Both sexes develop body hair.',
        ],
        exercise: {
          type: 'fill_in',
          prompt: 'During infancy, an average baby weighs about 3 kilograms and is approximately ________ centimetres in length at birth.',
          answer: '50',
          explanation: 'At birth, the average infant weighs about 3 kg and is approximately 50 cm in length. Growth during infancy is the most rapid period of postnatal physical development.',
        },
      },
      {
        heading: 'Educational Implications of Physical Development',
        paragraphs: [
          '<ol><li>Recognise individual differences in height, weight, and physical ability when assigning tasks — avoid comparing children\'s bodies publicly.</li><li>Provide regular opportunities for gross motor activities (running, jumping, climbing) to support physical and neurological development.</li><li>Use large fonts and adequate lighting in the classroom, especially for younger children whose visual systems are still maturing.</li><li>Provide age-appropriate writing tools — soft chalk or crayons for infants and early childhood, pencils as fine motor skills develop.</li><li>Be sensitive to adolescents\' self-consciousness about physical changes; create a respectful, non-judgmental classroom climate.</li></ol>',
        ],
        exercise: {
          type: 'theory',
          prompt: 'Describe three educational strategies a primary school teacher should use to support children\'s physical development in the classroom.',
          answer: '1. Gross motor activities: Include regular physical activity breaks (running, jumping, ball games) to support motor development and brain health. 2. Fine motor materials: Provide age-appropriate writing tools (crayons for young children, pencils when readiness is shown) and hands-on activities like clay modelling to develop finger dexterity. 3. Classroom environment: Ensure adequate lighting and appropriately sized furniture. Use large text sizes for young readers. Seat children to account for vision and hearing differences. Avoid tasks that require fine motor precision before children have matured sufficiently.',
          explanation: 'Teachers can support physical development through deliberate choice of activities, materials, and classroom environment to match children\'s current physical capabilities.',
        },
      },
    ],
  },

  // ── LESSON 4 ──────────────────────────────────────────────────────────────
  {
    lessonNumber: 4,
    title: 'Prenatal Development',
    tags: ['child-development', 'prenatal', 'conception', 'ebs106'],
    chunks: [
      {
        heading: 'Overview of Prenatal Development',
        illustration: {
          src: IMG.prenatal,
          alt: 'Table showing the stages of prenatal development',
          caption: 'Prenatal development proceeds through three distinct stages: germinal, embryonic, and fetal.',
          credit: 'Wikimedia Commons',
          mobile_position: 'between_paragraph_0_1',
          desktop_align: 'right',
        },
        paragraphs: [
          'Prenatal development is the period of development from conception to birth, lasting approximately 38–40 weeks. It is divided into three stages: the germinal stage, the embryonic stage, and the fetal stage.',
          'Although prenatal development occurs before a child enters the classroom, it has profound long-term effects on physical health, cognitive capacity, and emotional regulation. Understanding this stage helps teachers appreciate the origins of individual differences.',
        ],
        exercise: {
          type: 'multiple_choice',
          prompt: 'In which order do the stages of prenatal development occur?',
          options: [
            'Fetal → Embryonic → Germinal',
            'Embryonic → Germinal → Fetal',
            'Germinal → Embryonic → Fetal',
            'Germinal → Fetal → Embryonic',
          ],
          answer: 'Germinal → Embryonic → Fetal',
          explanation: 'Prenatal development proceeds from the germinal stage (0–2 weeks), to the embryonic stage (3–8 weeks), to the fetal stage (9 weeks to birth).',
        },
      },
      {
        heading: 'The Germinal Stage (0–2 Weeks)',
        paragraphs: [
          'The germinal stage begins at fertilisation, when a sperm and egg unite to form a zygote. The zygote undergoes rapid cell division (mitosis) as it travels from the fallopian tube to the uterus. By the end of the second week, the cluster of cells (blastocyst) implants in the uterine wall.',
          'The germinal stage is complete once implantation is successful. From this point, the developing organism receives nutrients and oxygen directly from the mother. Failure to implant results in a very early pregnancy loss, often before the woman is aware she is pregnant.',
        ],
        exercise: {
          type: 'true_false',
          prompt: 'The germinal stage begins at birth and lasts until the child\'s first two weeks of life.',
          options: ['True', 'False'],
          answer: 'False',
          explanation: 'The germinal stage begins at fertilisation (conception) and lasts approximately two weeks, ending with the implantation of the blastocyst in the uterine wall — well before birth.',
        },
      },
      {
        heading: 'The Embryonic Stage (3–8 Weeks)',
        paragraphs: [
          'The embryonic stage spans weeks 3 to 8 of prenatal development. During this period, all major body systems and organs begin to form: the heart, brain, spinal cord, eyes, ears, arms, and legs. The embryo grows from a tiny cluster of cells to about 2.5 cm in length.',
          'This is the most critical period for structural development. Exposure to harmful substances (teratogens) — including alcohol, drugs, infections, or radiation — during this stage can cause serious birth defects because organs are forming rapidly and are highly vulnerable.',
        ],
        exercise: {
          type: 'fill_in',
          prompt: 'The embryonic stage is considered the most critical period for structural development because all major organs and body systems are ________ during weeks 3–8.',
          answer: 'forming',
          explanation: 'During the embryonic stage, all major body systems (heart, brain, spinal cord, limbs) form rapidly. Exposure to teratogens during this time can cause permanent structural defects.',
        },
      },
      {
        heading: 'The Fetal Stage and Prenatal Influences',
        paragraphs: [
          'The fetal stage spans from the 9th week to birth. The organs formed in the embryonic stage now grow in size and complexity. The fetus develops reflexes, responds to sounds, and by the third trimester, opens its eyes and can distinguish light from dark.',
          'Factors that can harm prenatal development include: <strong>teratogens</strong> (alcohol, cigarettes, drugs, certain medications); <strong>maternal nutrition</strong> (deficiencies in folic acid, iron, and protein); <strong>infections</strong> (rubella, HIV); and <strong>stress</strong>. Positive factors include adequate nutrition, prenatal care, and a safe home environment.',
        ],
        exercise: {
          type: 'theory',
          prompt: 'Identify three factors that can negatively affect prenatal development and explain why teachers should be aware of prenatal influences.',
          answer: '1. Teratogens (alcohol, drugs, nicotine): These substances cross the placental barrier and can disrupt organ formation, particularly during the embryonic stage. Fetal Alcohol Spectrum Disorders (FASD), for example, permanently affect cognitive and behavioural development. 2. Maternal malnutrition: Deficiencies in folic acid cause neural tube defects; iron deficiency causes anaemia affecting oxygen supply to the developing brain. 3. Maternal infection: Rubella during the first trimester can cause deafness, blindness, and heart defects. Teachers should be aware of prenatal influences because many children\'s learning difficulties, sensory impairments, and behavioural challenges have prenatal origins. This knowledge promotes empathy and helps teachers seek appropriate support rather than attributing challenges to poor effort or character.',
          explanation: 'Prenatal experiences shape cognitive, physical, and behavioural development in ways that follow children into the classroom. Teacher awareness supports better understanding of individual differences.',
        },
      },
    ],
  },

  // ── LESSON 5 ──────────────────────────────────────────────────────────────
  {
    lessonNumber: 5,
    title: 'Cognitive Development: Jean Piaget',
    tags: ['child-development', 'cognitive-development', 'piaget', 'ebs106'],
    chunks: [
      {
        heading: 'Introduction to Cognitive Development',
        illustration: {
          src: IMG.piaget,
          alt: 'Diagram of Piaget\'s four stages of cognitive development',
          caption: 'Piaget identified four stages of cognitive development, each representing a qualitatively different way of thinking.',
          credit: 'Wikimedia Commons',
          mobile_position: 'between_paragraph_0_1',
          desktop_align: 'right',
        },
        paragraphs: [
          'Cognitive development refers to the progression of a child\'s ability to process information and adapt to the environment. It includes attention, perception, memory, imagination, thinking, problem-solving, and the growth of intelligence and language.',
          'Jean Piaget (1896–1980), a Swiss psychologist, proposed the most influential theory of cognitive development. Through careful observation of children, Piaget concluded that children think qualitatively differently from adults, not just less efficiently, and that thinking changes in fundamental ways as children mature.',
        ],
        exercise: {
          type: 'multiple_choice',
          prompt: 'According to Piaget, a child in the pre-operational stage (2–7 years) is most likely to:',
          options: [
            'Think abstractly and form hypotheses',
            'Show egocentrism and animism',
            'Successfully conserve volume and number',
            'Use deductive reasoning consistently',
          ],
          answer: 'Show egocentrism and animism',
          explanation: 'Pre-operational children are egocentric (unable to take another\'s perspective) and show animism (attributing life to inanimate objects). Conservation and abstract/deductive reasoning develop in later stages.',
        },
      },
      {
        heading: 'Sensorimotor and Pre-operational Stages',
        paragraphs: [
          '<strong>Sensorimotor stage (birth–2 years):</strong> Children learn through the senses and physical action. They begin with reflexes and gradually develop intentional, goal-directed behaviour. The key achievement is <em>object permanence</em> — understanding that objects continue to exist when out of sight (developed around 8–12 months).',
          '<strong>Pre-operational stage (2–7 years):</strong> Children begin using symbols (words and images) to represent objects. Language develops rapidly. However, thinking remains egocentric (children assume others see the world as they do), and children show animism, artificialism, and centration (focusing on one aspect of a situation at a time). They struggle with conservation tasks.',
        ],
        exercise: {
          type: 'true_false',
          prompt: 'Object permanence — the understanding that objects continue to exist when out of sight — is a key achievement of the pre-operational stage.',
          options: ['True', 'False'],
          answer: 'False',
          explanation: 'Object permanence is a key achievement of the sensorimotor stage (birth–2 years), developing around 8–12 months. The pre-operational stage (2–7 years) is characterised by symbolic thinking, egocentrism, and language development.',
        },
      },
      {
        heading: 'Concrete and Formal Operational Stages',
        paragraphs: [
          '<strong>Concrete operational stage (7–11 years):</strong> Thinking becomes more logical. Children master conservation (understanding that quantity does not change when shape changes), reversibility (actions can be mentally reversed), seriation (ordering objects by size), and classification (grouping by common properties). However, thinking remains tied to concrete, physical objects.',
          '<strong>Formal operational stage (11 years and older):</strong> Adolescents can think abstractly, reason hypothetically, and engage in deductive reasoning. They can consider multiple variables simultaneously and reflect on their own thinking (metacognition). Not all individuals reach this stage fully.',
        ],
        exercise: {
          type: 'fill_in',
          prompt: 'The ability to understand that the amount of liquid remains the same when poured into a differently shaped container is called ________, and it is mastered during the concrete operational stage.',
          answer: 'conservation',
          explanation: 'Conservation is the understanding that quantity does not change when shape or appearance changes. It develops during the concrete operational stage (7–11 years).',
        },
      },
      {
        heading: 'Educational Implications of Piaget\'s Theory',
        paragraphs: [
          '<ol><li>Match teaching activities to the child\'s current developmental stage — concrete objects for 7–11-year-olds, abstract concepts for adolescents.</li><li>Allow children to explore and discover: Piaget believed children construct knowledge through active interaction with their environment.</li><li>Encourage verbal participation and peer discussion to challenge existing thinking and support cognitive growth.</li><li>Do not rush abstract reasoning with young children — symbolic understanding must precede abstract thought.</li><li>Recognise that children in the same classroom may be at different Piagetian stages despite similar ages.</li></ol>',
        ],
        exercise: {
          type: 'theory',
          prompt: 'A JHS 2 teacher wants to introduce the concept of chemical reactions. Using Piaget\'s theory, explain what approach the teacher should take and why.',
          answer: 'JHS 2 students are approximately 13–14 years old, placing most of them in the formal operational stage. At this stage, students can think abstractly, form hypotheses, and reason deductively. The teacher should: (1) Begin with a concrete demonstration (mixing vinegar and baking soda to show a reaction), then move to the abstract concept of chemical equations. (2) Encourage hypothesis testing: "What do you think will happen if we change the temperature?" (3) Use deductive reasoning tasks: "If all acids react with bases, and this is an acid, what will happen?" (4) Allow metacognitive discussion: "How did your thinking change after the experiment?" This approach respects the formal operational capability while scaffolding abstract understanding through initial concrete experience.',
          explanation: 'Applying Piaget means staging instruction from concrete to abstract, allowing active discovery, and matching cognitive demands to the student\'s developmental stage.',
        },
      },
    ],
  },

  // ── LESSON 6 ──────────────────────────────────────────────────────────────
  {
    lessonNumber: 6,
    title: 'Language Development in Children',
    tags: ['child-development', 'language-development', 'communication', 'ebs106'],
    chunks: [
      {
        heading: 'The Nature of Language',
        illustration: {
          src: IMG.language,
          alt: 'Diagram showing the language acquisition device concept',
          caption: 'Language is a complex system of symbols that allows human beings to communicate meaning.',
          credit: 'Wikimedia Commons',
          mobile_position: 'after_last_paragraph',
          desktop_align: 'left',
        },
        paragraphs: [
          'Language is a complex, organised system of symbols — words, gestures, or signs — governed by rules (grammar) that allows human beings to communicate thoughts, feelings, and information. It involves listening, speaking, reading, and writing.',
          'Language is a uniquely human capacity and is central to cognitive development, social interaction, and academic learning. Without adequate language development, children face significant challenges in school across all subjects.',
        ],
        exercise: {
          type: 'multiple_choice',
          prompt: 'Which of the following best describes language?',
          options: [
            'A random collection of sounds and gestures',
            'A rule-governed system of symbols for communicating meaning',
            'An innate ability that develops identically in all children',
            'A cognitive skill unrelated to social development',
          ],
          answer: 'A rule-governed system of symbols for communicating meaning',
          explanation: 'Language is a complex, rule-governed (grammatical) system of symbols that allows communication of thoughts and information. It is shaped by both biological readiness and social experience.',
        },
      },
      {
        heading: 'Stages of Language Development',
        paragraphs: [
          'Language development follows a predictable sequence: <strong>Pre-linguistic stage (birth–12 months)</strong> — crying, cooing, and babbling. Infants produce sounds without meaning but begin to distinguish the sounds of their home language. <strong>One-word stage (12–18 months)</strong> — children produce single words (holophrases) that carry the meaning of whole sentences (e.g., "milk" meaning "I want milk").',
          '<strong>Two-word stage (18–24 months)</strong> — children combine two words to express relationships ("mama go," "more juice"). <strong>Telegraphic speech (2–3 years)</strong> — short sentences with mostly content words. <strong>Complex language (3 years onwards)</strong> — vocabulary expands rapidly, grammar becomes more sophisticated, and children begin to use questions, negatives, and complex sentences.',
        ],
        exercise: {
          type: 'true_false',
          prompt: 'The one-word stage (holophrases) occurs before babbling in the sequence of language development.',
          options: ['True', 'False'],
          answer: 'False',
          explanation: 'Babbling occurs during the pre-linguistic stage (birth–12 months) and precedes the one-word stage (12–18 months). The sequence is: crying/cooing → babbling → one-word → two-word → telegraphic → complex language.',
        },
      },
      {
        heading: 'Theories of Language Acquisition',
        paragraphs: [
          '<strong>Behaviourist view (Skinner):</strong> Children learn language through imitation, reinforcement, and shaping. Adults reinforce correct pronunciations and grammatical forms, gradually shaping the child\'s speech. This view is criticised for not explaining how children produce novel sentences they have never heard.',
          '<strong>Nativist view (Chomsky):</strong> Chomsky proposed that children are born with a Language Acquisition Device (LAD) — an innate, biological mechanism that allows them to acquire the grammatical rules of any language. This explains why children acquire language rapidly despite limited input. <strong>Interactionist view:</strong> Language acquisition involves both biological readiness and rich social interaction. Children need both the capacity and the conversational experience.',
        ],
        exercise: {
          type: 'fill_in',
          prompt: 'Noam Chomsky proposed that children are born with a ________ that provides them with an innate capacity to acquire the grammar of any human language.',
          answer: 'Language Acquisition Device (LAD)',
          explanation: 'Chomsky\'s Language Acquisition Device (LAD) is a proposed innate biological mechanism that enables children to rapidly acquire the grammatical rules of their native language. It explains the universality and speed of language acquisition.',
        },
      },
      {
        heading: 'Educational Implications of Language Development',
        paragraphs: [
          '<ol><li>Provide a language-rich classroom environment: label objects, use varied vocabulary, read aloud regularly, and encourage storytelling.</li><li>Engage children in dialogue — ask open-ended questions and give children time to formulate and express their thoughts.</li><li>Recognise that children who enter school with limited exposure to formal language may need additional support — this is not an indicator of intelligence.</li><li>Use the child\'s home language as a bridge to the language of instruction, especially in multilingual classrooms.</li><li>Encourage reading for pleasure — it is the most reliable way to expand vocabulary and develop advanced language structures.</li></ol>',
        ],
        exercise: {
          type: 'theory',
          prompt: 'You are teaching a Primary 1 class in a multilingual community. Many children arrive speaking only their local language. Describe three language development strategies you would use.',
          answer: '1. Bridge from home language: Allow children to express ideas in their home language first, then introduce the equivalent in the language of instruction. This validates children\'s linguistic identity and provides cognitive scaffolding. 2. Language-rich environment: Label classroom objects in both languages. Use songs, rhymes, and stories daily. Read picture books aloud and pause to discuss vocabulary. 3. Structured oral activities: Use peer discussion, show-and-tell, and role-play to build spoken confidence. Give children opportunities to narrate events and describe objects before introducing formal reading and writing. All three strategies are grounded in the interactionist view — language develops through biological readiness combined with rich social interaction.',
          explanation: 'Language development is foundational to academic learning. Teachers who create rich, supportive language environments help all children — including multilingual learners — to acquire the language skills they need for school success.',
        },
      },
    ],
  },

  // ── LESSON 7 ──────────────────────────────────────────────────────────────
  {
    lessonNumber: 7,
    title: 'Memory and Information Processing',
    tags: ['child-development', 'memory', 'cognition', 'information-processing', 'ebs106'],
    chunks: [
      {
        heading: 'Types of Memory',
        illustration: {
          src: IMG.workingMem,
          alt: 'Diagram of Baddeley\'s working memory model',
          caption: 'Working memory holds information temporarily for active processing — it is central to academic learning.',
          credit: 'Wikimedia Commons',
          mobile_position: 'between_paragraph_0_1',
          desktop_align: 'right',
        },
        paragraphs: [
          'Memory is the cognitive system that encodes, stores, and retrieves information. It operates across three main stores: <strong>sensory memory</strong>, <strong>short-term (working) memory</strong>, and <strong>long-term memory</strong>. Information flows through these stores in sequence, and much is lost at each transition.',
          'Understanding how memory works is crucial for teachers because it reveals why children forget lesson content and what strategies help information move into durable long-term storage.',
        ],
        exercise: {
          type: 'multiple_choice',
          prompt: 'In the information-processing model, what is the correct order in which information is processed?',
          options: [
            'Long-term memory → Short-term memory → Sensory memory',
            'Sensory memory → Short-term memory → Long-term memory',
            'Short-term memory → Sensory memory → Long-term memory',
            'Sensory memory → Long-term memory → Short-term memory',
          ],
          answer: 'Sensory memory → Short-term memory → Long-term memory',
          explanation: 'Information enters through the senses (sensory memory), is attended to and held briefly in working/short-term memory, and if processed deeply, is encoded into long-term memory for durable storage.',
        },
      },
      {
        heading: 'Sensory and Short-term (Working) Memory',
        paragraphs: [
          '<strong>Sensory memory</strong> holds raw sensory information (sights, sounds, touch) for a fraction of a second. Most of this information is lost immediately unless attention is directed to it. Only what is attended to moves into short-term memory.',
          '<strong>Short-term/working memory</strong> holds information for approximately 15–30 seconds without rehearsal, and has a limited capacity of about 7 ± 2 items (Miller\'s Law). Baddeley\'s working memory model describes it as having multiple components: a phonological loop (verbal information), a visuospatial sketchpad (visual/spatial information), and a central executive (attention control).',
        ],
        exercise: {
          type: 'true_false',
          prompt: 'Working memory has an unlimited capacity and can hold information for several hours without rehearsal.',
          options: ['True', 'False'],
          answer: 'False',
          explanation: 'Working memory is severely limited in both capacity (about 7 ± 2 items) and duration (15–30 seconds without rehearsal). Overloading working memory prevents learning and causes cognitive fatigue.',
        },
      },
      {
        heading: 'Long-term Memory',
        paragraphs: [
          'Long-term memory is the permanent storage system. Unlike working memory, it has essentially unlimited capacity and duration. Information is stored in long-term memory as <strong>explicit memory</strong> (conscious, declarative knowledge — facts and events) and <strong>implicit memory</strong> (unconscious procedural knowledge — skills and habits).',
          'For information to move from working memory to long-term memory, it must be processed meaningfully — through elaboration, organisation, repetition, and emotional engagement. The more connections made between new and existing knowledge, the stronger and more accessible the memory becomes.',
        ],
        exercise: {
          type: 'fill_in',
          prompt: 'Information is more likely to move from working memory into long-term memory when it is processed ________, through strategies such as elaboration, organisation, and connection to prior knowledge.',
          answer: 'meaningfully',
          explanation: 'Meaningful processing — making connections, elaborating, organising, and relating new information to what is already known — is the key to durable long-term memory formation.',
        },
      },
      {
        heading: 'Implications for Teaching and Learning',
        paragraphs: [
          '<ol><li><strong>Reduce cognitive load:</strong> Present information in manageable chunks. Avoid overloading working memory by introducing too many new concepts simultaneously.</li><li><strong>Use repetition and retrieval practice:</strong> Revisiting material over spaced intervals (spaced practice) strengthens long-term memory significantly more than massed practice ("cramming").</li><li><strong>Make learning meaningful:</strong> Connect new concepts to what children already know. Use examples, analogies, and stories.</li><li><strong>Use multimodal instruction:</strong> Engage both the phonological loop and visuospatial sketchpad by combining verbal explanations with diagrams, gestures, and concrete objects.</li><li><strong>Teach memory strategies:</strong> Chunking, mnemonics, and mind-mapping help children organise and retain information more effectively.</li></ol>',
        ],
        exercise: {
          type: 'theory',
          prompt: 'Explain why a student who studied the night before an exam may perform poorly, using what you know about memory and information processing.',
          answer: 'Last-minute cramming fails for several memory-related reasons: 1. Working memory overload: Attempting to process large amounts of new information in a short time overloads working memory\'s limited capacity, preventing adequate encoding into long-term memory. 2. Lack of meaningful processing: Cramming tends to be shallow (rote repetition) rather than deep (elaboration, connection to prior knowledge). Shallow processing produces weak, fragile memories that fade quickly. 3. Sleep deprivation: Memory consolidation occurs during sleep. Studying very late and sleeping little deprives the brain of the consolidation process needed to stabilise newly learned information in long-term memory. 4. No spaced repetition: Effective long-term retention requires spaced practice across multiple sessions. One session, however long, cannot replicate the benefits of distributed practice over days or weeks.',
          explanation: 'Cramming violates the principles of effective memory: it overloads working memory, promotes shallow encoding, disrupts sleep-based consolidation, and provides no spaced repetition. Effective study is distributed, active, and meaningful.',
        },
      },
    ],
  },

  // ── LESSON 8 ──────────────────────────────────────────────────────────────
  {
    lessonNumber: 8,
    title: 'Social Development',
    tags: ['child-development', 'social-development', 'peer-relationships', 'ebs106'],
    chunks: [
      {
        heading: 'Nature of Social Development',
        illustration: {
          src: IMG.social,
          alt: 'Children playing together in an outdoor setting',
          caption: 'Social development occurs through interaction with peers, family, and community.',
          credit: 'Wikimedia Commons',
          mobile_position: 'after_last_paragraph',
          desktop_align: 'right',
        },
        paragraphs: [
          'Social development refers to the process by which children learn to interact with others, form relationships, and understand social rules and roles. It includes the development of social skills, empathy, cooperation, and the ability to function effectively in groups.',
          'Social development is deeply intertwined with cognitive and emotional development. Children who develop strong social skills tend to perform better academically, manage conflict more effectively, and have stronger mental health outcomes throughout life.',
        ],
        exercise: {
          type: 'multiple_choice',
          prompt: 'Which of the following best describes social development?',
          options: [
            'The process of learning academic skills like reading and arithmetic',
            'The process of learning to interact, form relationships, and function effectively in groups',
            'The biological process of physical growth and maturation',
            'The development of long-term memory and information processing',
          ],
          answer: 'The process of learning to interact, form relationships, and function effectively in groups',
          explanation: 'Social development is about interpersonal skills, relationships, empathy, and social norms. It is distinct from cognitive, physical, or academic development, though all are interrelated.',
        },
      },
      {
        heading: 'Social Development in Infancy and Early Childhood',
        paragraphs: [
          'In infancy, social development begins with the formation of <strong>attachment</strong> — the close emotional bond between infant and caregiver. John Bowlby argued that secure attachment is the foundation for all later relationships. Infants who form secure attachments are more confident explorers and develop better social skills.',
          'In early childhood (2–6 years), children begin parallel play (playing alongside but not with peers) and gradually move to cooperative play. They become aware of gender roles, family roles, and simple social rules. Socialisation within the family is the primary influence during this period.',
        ],
        exercise: {
          type: 'true_false',
          prompt: 'According to Bowlby, secure attachment in infancy is unrelated to later social and emotional development.',
          options: ['True', 'False'],
          answer: 'False',
          explanation: 'Bowlby argued that secure attachment is the foundation for later social and emotional development. Securely attached children are more confident, show greater empathy, and form healthier relationships throughout life.',
        },
      },
      {
        heading: 'Social Development in Middle Childhood and Adolescence',
        paragraphs: [
          'In middle childhood (6–12 years), peer relationships become increasingly important. Children form friendships based on shared interests, trust, and loyalty. Peer group acceptance becomes a powerful influence on self-esteem and behaviour. Gender segregation in peer groups is common during this period.',
          'In adolescence, peer relationships reach peak influence. Adolescents seek peer approval, experiment with social identities, and often experience peer pressure. Romantic relationships begin to emerge. At the same time, healthy adolescent development requires both peer connection and continued family support.',
        ],
        exercise: {
          type: 'fill_in',
          prompt: 'In middle childhood, ________ relationships become increasingly important, and peer group acceptance has a powerful influence on self-esteem and behaviour.',
          answer: 'peer',
          explanation: 'Middle childhood (6–12 years) is marked by growing peer influence. Children form friendships based on shared interests and trust, and peer acceptance becomes central to their social development.',
        },
      },
      {
        heading: 'Educational Implications of Social Development',
        paragraphs: [
          '<ol><li>Build a classroom community: Use collaborative activities, group projects, and class meetings to foster belonging and social skills.</li><li>Teach and model prosocial behaviour: Cooperation, empathy, conflict resolution, and respect should be explicitly taught and practised.</li><li>Be aware of peer influence on behaviour — especially in adolescence — and use it constructively through peer learning and positive peer models.</li><li>Address bullying and social exclusion promptly; these experiences have lasting effects on development and learning.</li><li>Create opportunities for all children to contribute and be valued — social marginalisation harms academic engagement and mental health.</li></ol>',
        ],
        exercise: {
          type: 'theory',
          prompt: 'Describe three strategies a classroom teacher can use to promote positive social development in a primary school class.',
          answer: '1. Cooperative learning: Assign group tasks that require all members to contribute to a shared goal. This develops communication, negotiation, and empathy. Rotate group membership so children interact with diverse peers. 2. Explicit social skills instruction: Teach children how to take turns, listen actively, resolve disagreements peacefully, and include others. Use role-play and discussion to practise these skills. 3. A caring classroom climate: Use morning circles, class agreements, and restorative conversations to build trust. Acknowledge and celebrate acts of kindness and cooperation. Promptly but sensitively address unkind behaviour to protect all children\'s sense of belonging.',
          explanation: 'Social development does not happen automatically in school — teachers must create deliberate opportunities for children to practise social skills in a safe and structured environment.',
        },
      },
    ],
  },

  // ── LESSON 9 ──────────────────────────────────────────────────────────────
  {
    lessonNumber: 9,
    title: 'Emotional Development',
    tags: ['child-development', 'emotional-development', 'emotions', 'ebs106'],
    chunks: [
      {
        heading: 'Nature of Emotions',
        illustration: {
          src: IMG.emotions,
          alt: 'Chart showing basic human emotions',
          caption: 'Emotions shape attention, memory, motivation, and social behaviour throughout development.',
          credit: 'Wikimedia Commons',
          mobile_position: 'between_paragraph_0_1',
          desktop_align: 'left',
        },
        paragraphs: [
          'Emotions are complex psychological and physiological states that influence attention, perception, behaviour, and decision-making. They are adaptive — they help organisms respond to important events in the environment. Basic emotions (happiness, sadness, fear, anger, surprise, disgust) appear universally across cultures.',
          'Emotional development involves learning to identify, express, and regulate emotions. Children who develop strong emotional competence are better able to build relationships, focus on learning, and cope with stress.',
        ],
        exercise: {
          type: 'multiple_choice',
          prompt: 'Which of the following is the best description of emotional development?',
          options: [
            'Learning to suppress and hide all negative emotions',
            'The process of learning to identify, express, and regulate emotions',
            'The biological maturation of the nervous system alone',
            'Memorising the names of emotions from a textbook',
          ],
          answer: 'The process of learning to identify, express, and regulate emotions',
          explanation: 'Emotional development is about developing emotional competence — the ability to recognise, express appropriately, and regulate one\'s emotions. Suppression or denial of emotions is not healthy development.',
        },
      },
      {
        heading: 'Emotional Development in Infancy',
        paragraphs: [
          'From birth, infants express basic emotions through crying, smiling, and facial expressions. <strong>Social smiling</strong> — smiling in response to a human face — emerges around 6–8 weeks and marks the beginning of intentional social interaction.',
          'By 8–10 months, infants show <strong>stranger anxiety</strong> (distress at unfamiliar people) and <strong>separation anxiety</strong> (distress when separated from a primary caregiver). These are signs of healthy attachment and cognitive development (the infant now recognises familiar vs. unfamiliar faces and understands that people continue to exist even when absent).',
        ],
        exercise: {
          type: 'true_false',
          prompt: 'Stranger anxiety in infants is a sign of insecure attachment and indicates a developmental problem.',
          options: ['True', 'False'],
          answer: 'False',
          explanation: 'Stranger anxiety (8–10 months) is a sign of healthy attachment and cognitive development. It shows the infant can distinguish familiar from unfamiliar faces and has formed important attachments. It is developmentally normal.',
        },
      },
      {
        heading: 'Emotional Development in Childhood and Adolescence',
        paragraphs: [
          'In early childhood (2–6 years), children develop <strong>self-conscious emotions</strong> such as pride, shame, guilt, and embarrassment — emotions that require self-awareness and awareness of social standards. They also begin to understand that others have feelings different from their own (emotional perspective-taking).',
          'In adolescence, emotions intensify due to hormonal changes and heightened social awareness. Adolescents experience stronger emotional highs and lows and are more sensitive to peer evaluation. The capacity for emotional regulation improves through late adolescence and into early adulthood, supported by continued development of the prefrontal cortex.',
        ],
        exercise: {
          type: 'fill_in',
          prompt: 'Emotions such as pride, shame, guilt, and embarrassment are called ________ emotions because they require self-awareness and awareness of social norms.',
          answer: 'self-conscious',
          explanation: 'Self-conscious emotions (pride, shame, guilt, embarrassment) emerge in early childhood when children develop self-awareness and begin to internalise social standards and evaluate their own behaviour against those standards.',
        },
      },
      {
        heading: 'Educational Implications of Emotional Development',
        paragraphs: [
          '<ol><li>Create an emotionally safe classroom: Children learn best when they feel secure, valued, and free from ridicule or shame.</li><li>Validate emotions: Acknowledge children\'s feelings without judgement. Saying "I can see you\'re frustrated" is more helpful than "Stop crying."</li><li>Teach emotional vocabulary: Help children name their emotions. Children who can name emotions are better able to manage them.</li><li>Model emotional regulation: Teachers who remain calm under pressure demonstrate and teach self-regulation skills implicitly.</li><li>Be alert to signs of emotional difficulties: Persistent withdrawal, aggression, or frequent emotional outbursts may indicate a child who needs additional support.</li></ol>',
        ],
        exercise: {
          type: 'theory',
          prompt: 'Explain why emotional safety in the classroom is important for learning. Give two practical examples of how a teacher can create emotional safety.',
          answer: 'Emotional safety is important for learning because: 1. Stress impairs cognition. When children feel unsafe, threatened, or ashamed, the brain\'s stress response (amygdala activation) interferes with working memory, attention, and rational thinking — all of which are essential for learning. 2. Risk-taking requires safety. Learning involves making mistakes, asking questions, and attempting unfamiliar tasks. Children only do these things when they feel safe from mockery or criticism. Practical examples: Example 1: Establish clear class agreements about respect at the start of the year. Include rules like "We help, not mock" and "All questions are welcome." Review and practise these consistently. Example 2: Use inclusive questioning strategies. Instead of cold-calling, ask children to first discuss with a partner. This reduces the fear of public failure and increases participation from all learners, including those who are emotionally vulnerable.',
          explanation: 'The emotional climate of the classroom directly shapes children\'s ability and willingness to learn. Teachers are responsible for creating conditions where all children feel safe enough to engage fully.',
        },
      },
    ],
  },

  // ── LESSON 10 ─────────────────────────────────────────────────────────────
  {
    lessonNumber: 10,
    title: 'Moral Development',
    tags: ['child-development', 'moral-development', 'kohlberg', 'piaget', 'ebs106'],
    chunks: [
      {
        heading: 'Introduction to Moral Development',
        illustration: {
          src: IMG.kohlberg,
          alt: 'Diagram of Kohlberg\'s stages of moral development',
          caption: 'Kohlberg proposed six stages of moral reasoning, organised into three levels of increasing sophistication.',
          credit: 'Wikimedia Commons',
          mobile_position: 'between_paragraph_0_1',
          desktop_align: 'right',
        },
        paragraphs: [
          'Moral development refers to the process through which children develop a sense of right and wrong, form values and ethical standards, and learn to regulate their behaviour in accordance with social and moral norms.',
          'Two foundational theories of moral development are those of Jean Piaget and Lawrence Kohlberg. Both propose that moral reasoning develops in stages, moving from simple, rule-based thinking to more complex, principle-based reasoning.',
        ],
        exercise: {
          type: 'multiple_choice',
          prompt: 'Which of the following best describes moral development?',
          options: [
            'The process of memorising a list of rules and regulations',
            'The development of a sense of right and wrong and the ability to reason about ethical issues',
            'The biological process of brain maturation only',
            'The learning of social etiquette in formal settings',
          ],
          answer: 'The development of a sense of right and wrong and the ability to reason about ethical issues',
          explanation: 'Moral development is a cognitive-social process involving the internalisation of values, the development of ethical reasoning, and the regulation of behaviour according to moral principles.',
        },
      },
      {
        heading: 'Piaget\'s Theory of Moral Development',
        paragraphs: [
          'Piaget described two stages of moral development: <strong>Heteronomous morality (up to about age 10):</strong> Children view rules as fixed, sacred, and set by authority. They judge actions by their consequences (the amount of damage done), not by intent. A child who broke 15 cups accidentally is seen as naughtier than one who broke 1 cup intentionally.',
          '<strong>Autonomous morality (from about age 10):</strong> Children understand that rules are social agreements that can be changed by mutual consent. They judge actions by intent, not just consequences. Moral reasoning becomes flexible and considers context.',
        ],
        exercise: {
          type: 'true_false',
          prompt: 'In Piaget\'s heteronomous stage, children judge the morality of an action based primarily on the intention behind it rather than the amount of damage caused.',
          options: ['True', 'False'],
          answer: 'False',
          explanation: 'In the heteronomous stage, children judge actions by their consequences (the extent of damage), not by intent. Intention-based moral reasoning develops in the autonomous stage, around age 10 and beyond.',
        },
      },
      {
        heading: 'Kohlberg\'s Theory of Moral Development',
        paragraphs: [
          'Lawrence Kohlberg extended Piaget\'s work, identifying six stages across three levels: <strong>Level 1 — Pre-conventional:</strong> Stage 1 — Obedience and punishment (avoid punishment). Stage 2 — Self-interest (follow rules to gain rewards). <strong>Level 2 — Conventional:</strong> Stage 3 — Good interpersonal relationships (be a good person to gain approval). Stage 4 — Maintaining social order (follow laws to maintain order).',
          '<strong>Level 3 — Post-conventional:</strong> Stage 5 — Social contract (rules are social agreements that should reflect individual rights). Stage 6 — Universal principles (act on self-chosen ethical principles, even if they conflict with laws). Kohlberg used moral dilemmas (like the "Heinz Dilemma") to assess moral reasoning stage.',
        ],
        exercise: {
          type: 'fill_in',
          prompt: 'In Kohlberg\'s theory, the highest level of moral reasoning is called the ________ level, where individuals are guided by self-chosen ethical principles that may transcend social laws.',
          answer: 'post-conventional',
          explanation: 'The post-conventional level (Stages 5 and 6) involves reasoning based on social contracts and universal ethical principles. It is the highest level of moral development and is not reached by all individuals.',
        },
      },
      {
        heading: 'Educational Implications of Moral Development',
        paragraphs: [
          '<ol><li>Use moral dilemmas and discussions to stimulate moral reasoning — asking "What do you think is right, and why?" is more powerful than simply stating rules.</li><li>Model ethical behaviour consistently; children at the conventional level look to authority figures as moral models.</li><li>Create a democratic classroom culture with shared rule-making, which supports the transition from heteronomous to autonomous morality.</li><li>Avoid purely punitive discipline — help children understand the reasons behind rules and the impact of their actions on others.</li><li>Recognise that students in the same class may be at different moral reasoning levels and respond differently to moral appeals.</li></ol>',
        ],
        exercise: {
          type: 'theory',
          prompt: 'Using Kohlberg\'s theory, explain how a teacher might respond to a student who was caught cheating on a test in a way that promotes moral development beyond simple punishment.',
          answer: 'A purely punitive response ("You get zero and detention") operates at the pre-conventional level — it teaches the child to avoid punishment, not to develop genuine moral understanding. A developmentally informed response would: 1. Have a private conversation that explores the reasoning: "Tell me what happened. What were you thinking?" This respects the child\'s dignity and opens genuine dialogue. 2. Ask the child to consider impact: "How does this affect you, the other students, and the class?" This promotes movement from self-interest toward interpersonal and social reasoning (Stages 3–4). 3. Involve the child in deciding a fair consequence — for example, re-taking the test. This builds a sense of fairness and social contract. 4. Revisit study support needs: often cheating reflects anxiety and inadequate preparation. Address the root cause. This approach moves the student toward conventional and eventually post-conventional reasoning — not merely away from punishment.',
          explanation: 'Discipline that engages moral reasoning — asking why, exploring impact, involving students in consequences — is more developmentally effective than punishment alone.',
        },
      },
    ],
  },

  // ── LESSON 11 ─────────────────────────────────────────────────────────────
  {
    lessonNumber: 11,
    title: "Erikson's Psychosocial Theory of Development",
    tags: ['child-development', 'erikson', 'psychosocial', 'identity', 'ebs106'],
    chunks: [
      {
        heading: "Overview of Erikson's Theory",
        illustration: {
          src: IMG.erikson,
          alt: "Diagram of Erikson's eight stages of psychosocial development",
          caption: "Erikson proposed eight stages across the lifespan, each presenting a specific psychosocial crisis to be resolved.",
          credit: 'Wikimedia Commons',
          mobile_position: 'between_paragraph_0_1',
          desktop_align: 'right',
        },
        paragraphs: [
          "Erik Erikson (1902–1994) proposed an eight-stage theory of psychosocial development spanning the entire lifespan. Each stage presents a specific developmental crisis — a turning point with two possible outcomes. Healthy resolution leads to the development of a virtue (strength); unhealthy resolution produces an enduring weakness.",
          "Unlike Freud's psychosexual theory, Erikson emphasised social relationships and cultural context as drivers of development, and he acknowledged that development continues beyond childhood into adulthood and old age.",
        ],
        exercise: {
          type: 'multiple_choice',
          prompt: "In Erikson's theory, what happens when a developmental crisis is NOT successfully resolved?",
          options: [
            'The child automatically resolves it at the next stage',
            'Development is complete and no further growth is needed',
            "An enduring weakness or difficulty in that psychosocial domain persists into later stages",
            'The child skips that stage and moves directly to the next',
          ],
          answer: "An enduring weakness or difficulty in that psychosocial domain persists into later stages",
          explanation: "Each of Erikson's stages must be navigated. Unhealthy resolution creates a psychological vulnerability that affects later stages. For example, unresolved mistrust in infancy can affect an individual's ability to form relationships throughout life.",
        },
      },
      {
        heading: 'Stages 1–4: Trust to Industry',
        paragraphs: [
          '<ol><li><strong>Trust vs. Mistrust (birth–18 months):</strong> Infants develop trust if caregivers are responsive and consistent; mistrust if care is neglectful or unpredictable. Virtue: Hope.</li><li><strong>Autonomy vs. Shame and Doubt (18 months–3 years):</strong> Children explore independence. Supportive environments build autonomy; excessive control creates shame. Virtue: Will.</li><li><strong>Initiative vs. Guilt (3–6 years):</strong> Children begin to plan, lead, and initiate activities. Encouragement builds initiative; constant criticism creates guilt. Virtue: Purpose.</li></ol>',
          '<ol start="4"><li><strong>Industry vs. Inferiority (6–12 years):</strong> Children develop competence through academic and social tasks. Success builds industriousness; repeated failure creates a sense of inferiority. Virtue: Competence. This stage is directly relevant to primary school classrooms.</li></ol>',
        ],
        exercise: {
          type: 'true_false',
          prompt: "According to Erikson, the stage most directly relevant to primary school children (ages 6–12) is Identity vs. Role Confusion.",
          options: ['True', 'False'],
          answer: 'False',
          explanation: "The stage most relevant to primary school children (6–12 years) is Industry vs. Inferiority. Identity vs. Role Confusion is the adolescent stage (12–18 years).",
        },
      },
      {
        heading: 'Stages 5–8: Identity to Integrity',
        paragraphs: [
          '<ol start="5"><li><strong>Identity vs. Role Confusion (12–18 years):</strong> Adolescents explore who they are — their values, beliefs, vocational direction, and social roles. Successful exploration leads to a coherent identity; failure leads to role confusion. Virtue: Fidelity.</li><li><strong>Intimacy vs. Isolation (young adulthood):</strong> Forming close, committed relationships. Success brings intimacy; failure brings loneliness. Virtue: Love.</li></ol>',
          '<ol start="7"><li><strong>Generativity vs. Stagnation (middle adulthood):</strong> Contributing to society through work and parenting. Virtue: Care.</li><li><strong>Integrity vs. Despair (late adulthood):</strong> Reflecting on life with satisfaction (integrity) or regret (despair). Virtue: Wisdom.</li></ol>',
        ],
        exercise: {
          type: 'fill_in',
          prompt: "In Erikson's theory, the psychosocial crisis of adolescence is ________ vs. Role Confusion, and the virtue gained through its successful resolution is Fidelity.",
          answer: 'Identity',
          explanation: "The adolescent stage (12–18 years) in Erikson's theory is Identity vs. Role Confusion. Adolescents who successfully explore and commit to an identity develop fidelity — loyalty and a sense of self.",
        },
      },
      {
        heading: "Educational Implications of Erikson's Theory",
        paragraphs: [
          '<ol><li><strong>Industry vs. Inferiority (primary school):</strong> Give children regular opportunities to experience genuine competence. Avoid excessive competition that creates repeated losers. Provide achievable challenges that stretch but do not overwhelm.</li><li><strong>Initiative vs. Guilt (early childhood):</strong> Encourage children\'s ideas and leadership in play and projects. Avoid excessive criticism that makes children feel their ideas are worthless.</li><li><strong>Identity vs. Role Confusion (JHS/SHS):</strong> Create space for student voice, self-expression, and exploration of interests. Career guidance, mentorship, and exposure to role models support healthy identity development.</li><li>Trust that is established in the classroom (or not) echoes Erikson\'s earliest stage — students must trust the teacher for genuine learning to occur.</li></ol>',
        ],
        exercise: {
          type: 'theory',
          prompt: "A Primary 4 teacher notices that several students consistently refuse to attempt difficult tasks, saying 'I can't do it' and giving up quickly. Using Erikson's Industry vs. Inferiority stage, explain what may be happening and how the teacher should respond.",
          answer: "These students may be developing a sense of inferiority — the unhealthy resolution of Erikson's Industry vs. Inferiority crisis. This often occurs when children experience repeated failure, harsh criticism, or unfavourable comparisons with peers. What may be happening: The students have learned to expect failure and protect their self-esteem by not trying. This learned helplessness is a symptom of unresolved inferiority. How the teacher should respond: 1. Provide appropriately challenging tasks — tasks that are difficult enough to feel meaningful, but achievable with effort, so success is possible. 2. Use specific, process-focused praise: 'You got further than last time' or 'The way you organised your work was very clear.' This builds competence beliefs without false praise. 3. Reframe mistakes as part of learning, not proof of inability. 4. Identify and celebrate each child's areas of strength — every child should experience genuine competence in the classroom. 5. Reduce public comparison (avoiding class rankings or reading scores aloud), which exacerbates feelings of inferiority.",
          explanation: "Industry vs. Inferiority is directly enacted in the classroom. Teachers who create achievable challenges, celebrate effort, and protect children from humiliation support healthy competence development.",
        },
      },
    ],
  },

  // ── LESSON 12 ─────────────────────────────────────────────────────────────
  {
    lessonNumber: 12,
    title: 'Adolescent Development',
    tags: ['child-development', 'adolescence', 'puberty', 'ebs106'],
    chunks: [
      {
        heading: 'Nature and Characteristics of Adolescence',
        illustration: {
          src: IMG.adolescence,
          alt: 'Photograph of adolescents in a school setting',
          caption: 'Adolescence is a period of rapid physical, cognitive, social, and emotional transformation.',
          credit: 'Wikimedia Commons',
          mobile_position: 'between_paragraph_0_1',
          desktop_align: 'right',
        },
        paragraphs: [
          'Adolescence is the transitional period between childhood and adulthood, spanning approximately 11–18 years. It is characterised by rapid physical changes (puberty), cognitive advances (abstract thinking), social changes (peer emphasis, identity exploration), and emotional intensity.',
          "G. Stanley Hall described adolescence as a period of 'storm and stress' — heightened emotional volatility, risk-taking, and conflict with authority. While many adolescents navigate this period without major crises, teachers should recognise it as genuinely demanding and deserving of patience and understanding.",
        ],
        exercise: {
          type: 'multiple_choice',
          prompt: 'Which of the following best describes adolescence?',
          options: [
            'A period of social and physical stability between childhood and adulthood',
            'A transitional period marked by rapid physical, cognitive, social, and emotional change',
            'A period when cognitive development is complete and the brain has fully matured',
            'A stage characterised exclusively by peer conflict and family breakdown',
          ],
          answer: 'A transitional period marked by rapid physical, cognitive, social, and emotional change',
          explanation: "Adolescence is defined by rapid, simultaneous change across all domains of development — physical (puberty), cognitive (abstract thinking), social (peer focus, identity), and emotional (intensity). It is neither purely stable nor uniformly stormy.",
        },
      },
      {
        heading: 'Physical Changes in Adolescence (Puberty)',
        paragraphs: [
          'Puberty refers to the biological changes of sexual maturation. In girls, it typically begins between 8–13 years: breast development, pubic hair, widening of hips, and the onset of menstruation. In boys, puberty typically begins 2 years later: testicular and penile growth, pubic hair, voice deepening, and the development of muscle mass.',
          'The timing of puberty varies considerably. Early-maturing girls and late-maturing boys often experience more social difficulties, as their physical development does not align with the norm of their peer group. Teachers should handle puberty-related discussions with sensitivity and normalise the wide range of development.',
        ],
        exercise: {
          type: 'true_false',
          prompt: 'Boys typically begin puberty at an earlier age than girls.',
          options: ['True', 'False'],
          answer: 'False',
          explanation: 'Girls typically begin puberty earlier — between 8–13 years. Boys begin approximately 2 years later, around 10–15 years. Early maturation in girls and late maturation in boys is associated with greater social difficulties.',
        },
      },
      {
        heading: 'Cognitive Changes in Adolescence',
        paragraphs: [
          "Adolescence marks the transition into Piaget's formal operational stage. Adolescents can think abstractly, reason hypothetically (if-then logic), consider multiple variables simultaneously, and engage in metacognition (thinking about their own thinking). This opens new possibilities for academic learning across all subjects.",
          'However, adolescent cognition also shows characteristic patterns: <strong>adolescent egocentrism</strong> (a belief that others are constantly observing and judging them — the "imaginary audience") and the <strong>personal fable</strong> (a belief that they are unique and invulnerable to the risks that affect others). These patterns explain many adolescent risk behaviours.',
        ],
        exercise: {
          type: 'fill_in',
          prompt: "The adolescent cognitive pattern where a teenager believes that others are always watching and evaluating them is called the ________ audience.",
          answer: 'imaginary',
          explanation: "The imaginary audience is a form of adolescent egocentrism where teenagers believe they are constantly observed and judged by others. It contributes to heightened self-consciousness and sensitivity to peer opinion.",
        },
      },
      {
        heading: 'Social, Emotional, and Educational Implications',
        paragraphs: [
          'Adolescents increasingly prioritise peer relationships over family relationships. They seek autonomy while still needing parental support. Peer influence on attitudes, dress, behaviour, and academic engagement peaks during this period. Healthy adolescent development requires authentic connection with at least one caring adult.',
          '<ol><li>Treat adolescents with respect — they are acutely sensitive to condescension and public humiliation.</li><li>Provide structured opportunities for autonomy and genuine decision-making in the classroom.</li><li>Use collaborative and discussion-based learning to leverage their social orientation.</li><li>Be alert to signs of depression, risk-taking, or social withdrawal, which are more common during adolescence.</li><li>Build a classroom culture that values intellectual effort and curiosity over social performance.</li></ol>',
        ],
        exercise: {
          type: 'theory',
          prompt: "An SHS student often disrupts class when called upon to answer a question. Using your understanding of adolescent development, explain possible reasons for this behaviour and describe how the teacher could respond.",
          answer: "Possible developmental explanations: 1. Imaginary audience: The student may be acutely self-conscious about giving a wrong answer in front of peers, fearing ridicule or embarrassment. The disruption may be a face-saving strategy — better to seem unwilling than to appear unintelligent. 2. Peer performance: Adolescents may deliberately underperform academically to maintain social status in peer groups where academic effort is stigmatised. 3. Identity exploration: The student may be testing authority boundaries as part of normal adolescent autonomy development. How the teacher should respond: 1. Avoid public confrontation that escalates the situation — address the behaviour privately and respectfully. 2. Reduce the stakes of public answering: use think-pair-share so students can formulate and discuss answers with a partner before sharing with the class. 3. Build a class culture where mistakes are valued as learning opportunities. Praise thoughtful attempts, not just correct answers. 4. Privately check in with the student about what is making class difficult for them. 5. Provide opportunities for the student to demonstrate competence in areas of strength.",
          explanation: "Understanding adolescent development — particularly egocentrism, peer influence, and identity exploration — allows teachers to respond to difficult behaviour with empathy and strategy rather than simple punishment.",
        },
      },
    ],
  },

  // ── LESSON 13 ─────────────────────────────────────────────────────────────
  {
    lessonNumber: 13,
    title: 'Identity Formation in Adolescence',
    tags: ['child-development', 'identity', 'adolescence', 'marcia', 'ebs106'],
    chunks: [
      {
        heading: 'The Concept of Identity',
        illustration: {
          src: IMG.identity,
          alt: 'Diagram illustrating the concept of identity formation',
          caption: 'Identity formation is the central developmental task of adolescence — answering the question: Who am I?',
          credit: 'Wikimedia Commons',
          mobile_position: 'after_last_paragraph',
          desktop_align: 'right',
        },
        paragraphs: [
          "Identity refers to a person's stable sense of self — their values, beliefs, vocational goals, and sense of how they fit into the world. Erikson proposed that identity formation is the central psychosocial task of adolescence. The key question of this stage is: 'Who am I?'",
          'Identity is not formed all at once. It develops through a process of exploration (trying out different roles, beliefs, and commitments) and eventual commitment (settling on a consistent, coherent sense of self). The process is deeply influenced by culture, family, peer relationships, and opportunity.',
        ],
        exercise: {
          type: 'multiple_choice',
          prompt: "According to Erikson, the central psychosocial task of adolescence is:",
          options: [
            'Developing industry and a sense of competence',
            'Forming close, intimate relationships with others',
            'Developing a stable, coherent sense of personal identity',
            'Achieving physical maturity through puberty',
          ],
          answer: 'Developing a stable, coherent sense of personal identity',
          explanation: "Erikson's Identity vs. Role Confusion stage places identity formation — answering 'Who am I?' in terms of values, beliefs, roles, and direction — as the central task of adolescence. Industry is the primary school task; intimacy is young adulthood.",
        },
      },
      {
        heading: "Marcia's Identity Statuses",
        paragraphs: [
          "James Marcia extended Erikson's work by identifying four identity statuses based on two dimensions — exploration (has the person actively explored different options?) and commitment (has the person made a stable decision?): <strong>Identity Diffusion:</strong> No exploration, no commitment. The adolescent has not yet engaged with identity questions. <strong>Identity Foreclosure:</strong> Commitment without exploration. The adolescent has adopted an identity (usually from parents or authority) without questioning it.",
          "<strong>Identity Moratorium:</strong> Active exploration, no commitment yet. The adolescent is in the midst of identity searching. <strong>Identity Achievement:</strong> Exploration followed by commitment. The adolescent has worked through options and arrived at a personally meaningful identity. Identity achievement is the healthiest outcome and is associated with psychological well-being and adaptability.",
        ],
        exercise: {
          type: 'true_false',
          prompt: "In Marcia's theory, identity foreclosure is considered the healthiest identity status because the adolescent has made a commitment.",
          options: ['True', 'False'],
          answer: 'False',
          explanation: "Identity foreclosure involves commitment without exploration — the adolescent adopts an identity prescribed by others without questioning it. Identity achievement (exploration followed by commitment) is the healthiest status because the commitment is personally meaningful and freely chosen.",
        },
      },
      {
        heading: 'Factors Influencing Identity Development',
        paragraphs: [
          'Identity development is shaped by multiple factors: <strong>Family relationships</strong> — supportive families that allow exploration while providing emotional security promote healthy identity development. Overly controlling or emotionally distant families may lead to foreclosure or diffusion. <strong>Peers</strong> — peer groups expose adolescents to alternative values and lifestyles, fuelling identity exploration.',
          '<strong>Culture and society</strong> — cultural norms shape what identity options are available and valued. In some cultures, certain vocational paths or religious commitments are prescribed, narrowing individual exploration. <strong>Opportunity and exposure</strong> — broader life experiences (travel, diverse education, mentors) expand the range of possible identities an adolescent can consider.',
        ],
        exercise: {
          type: 'fill_in',
          prompt: "According to Marcia, an adolescent who is actively trying out different values, beliefs, and career options but has not yet made a commitment is in a state of identity ________.",
          answer: 'moratorium',
          explanation: "Identity moratorium describes active exploration without yet having made a commitment. It is a necessary and healthy phase — the searching process itself builds self-knowledge that eventually supports identity achievement.",
        },
      },
      {
        heading: 'Educational Implications of Identity Development',
        paragraphs: [
          '<ol><li>Provide diverse learning experiences — exposure to different subjects, careers, role models, and cultural perspectives supports identity exploration.</li><li>Create space for student voice and opinion — class discussions on values, current events, and ethical dilemmas help adolescents clarify their beliefs.</li><li>Offer career guidance and mentorship programmes to help students move from moratorium toward identity achievement.</li><li>Avoid labelling students permanently — identity is still forming during the school years and students are capable of profound change.</li><li>Support students who seem directionless (diffusion) with structured opportunities for exploration rather than pressure to commit prematurely.</li></ol>',
        ],
        exercise: {
          type: 'theory',
          prompt: "A Form 2 student tells you she has no idea what she wants to do after school and finds it hard to commit to any one direction. Using Marcia's identity statuses, analyse her situation and suggest how you, as her teacher, could support her.",
          answer: "This student appears to be in identity diffusion — she has neither engaged actively in exploration nor made any commitments about her future. This is concerning if she remains in diffusion, as it is associated with low self-esteem, apathy, and difficulty coping with adult responsibilities. However, diffusion is not permanent — with the right support, she can move into moratorium and eventually achievement. As her teacher, I would: 1. Create structured exploration opportunities: Connect her to career fairs, guest speakers from diverse fields, and job shadowing opportunities. Exploration requires exposure to options. 2. Use interest inventories or values clarification activities to help her identify what matters to her — this is the starting point for identity exploration. 3. Have a private, non-judgmental conversation: 'What subjects or activities do you enjoy most? Is there anything you\'ve thought about trying?' This signals that her direction matters and that she is not alone. 4. Provide encouraging feedback that builds her sense of competence in areas of strength — identity development is supported by feeling capable. 5. Avoid pressuring her to commit prematurely; the goal is moratorium (active exploration), not forced foreclosure.",
          explanation: "Teachers play a significant role in identity development by providing diverse experiences, genuine adult attention, and space for adolescents to explore rather than foreclose prematurely or remain in diffusion.",
        },
      },
    ],
  },

];

// ─── PART 2 OF LESSONS (14–26) will be appended by running the companion script ───
// This file seeds Lessons 1–13. Run seed_ebs106_part2.js for Lessons 14–26.

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const wrapHtml = (text) => (String(text).trimStart().startsWith('<') ? text : `<p>${text}</p>`);

const stripHtml = (value = '') =>
  String(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

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
    paragraphs: chunk.paragraphs.map((p, pi) => ({
      id: `par_${pi}`,
      body_html: wrapHtml(p),
    })),
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

const summariseLesson = (lesson) => {
  for (const chunk of lesson.chunks) {
    for (const p of chunk.paragraphs) {
      const text = stripHtml(p);
      if (text) return text.slice(0, 240);
    }
  }
  return lesson.title;
};

const wordCount = (doc) =>
  stripHtml(
    doc.chunks.flatMap((c) => c.paragraphs.map((p) => p.body_html)).join(' ')
  )
    .split(/\s+/)
    .filter(Boolean).length;

const jsonContains = (key, value) =>
  db.sequelize.where(
    db.sequelize.cast(db.sequelize.col('metadata'), 'jsonb'),
    '@>',
    JSON.stringify({ [key]: value })
  );

async function upsertLessonMetadata(contentId, metadata) {
  const existing = await db.ContentMetadata.findOne({ where: { content_id: contentId } });
  const payload = {
    course: metadata.course || null,
    topic: metadata.topic || null,
    level: metadata.level || null,
    subject: metadata.category || null,
    metadata,
  };
  if (existing) {
    await existing.update(payload);
  } else {
    await db.ContentMetadata.create({ content_id: contentId, ...payload });
  }
}

async function ensureContentStats(contentId) {
  const existing = await db.ContentStats.findOne({ where: { content_id: contentId } });
  if (!existing) {
    await db.ContentStats.create({ content_id: contentId, total_views: 0, last_updated: new Date() });
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  await db.sequelize.authenticate();

  // Find or create the EBS 106 course
  let course = await db.Course.findOne({
    where: {
      [Op.or]: [{ code: COURSE_CODE }, { title: COURSE_TITLE }, { key: COURSE_KEY }],
    },
    include: [{ model: db.CourseOffering, as: 'offerings', attributes: ['level', 'semester'], required: false }],
  });

  if (!course) {
    course = await db.Course.create({
      key: COURSE_KEY,
      title: COURSE_TITLE,
      code: COURSE_CODE,
      credits: '3',
      department: 'Education',
      metadata: COURSE_PRELIMS,
    });
    console.log(`Created course: ${COURSE_TITLE} (${COURSE_CODE})`);
  } else {
    await course.update({
      code: COURSE_CODE,
      key: course.key || COURSE_KEY,
      credits: course.credits || '3',
      metadata: { ...(course.metadata || {}), ...COURSE_PRELIMS },
    });
    console.log(`Found course: ${course.title}`);
  }

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
    const description = summariseLesson(lesson);
    const words = wordCount(lessonDocument);
    const duration = Math.max(6, Math.round(words / 160));

    const metadata = {
      slug: `ebs106-lesson-${lesson.lessonNumber}`,
      category: COURSE_TITLE,
      topic: lesson.title,
      course: COURSE_TITLE,
      course_id: course.id,
      course_title: COURSE_TITLE,
      course_name: COURSE_TITLE,
      course_code: COURSE_CODE,
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
    // Fallback: find by title alone (handles cases where course was re-created with a new UUID)
    if (!existing) {
      existing = await db.Lesson.findOne({
        where: {
          title: lesson.title,
          [Op.or]: [
            db.sequelize.where(
              db.sequelize.cast(db.sequelize.col('metadata'), 'jsonb'),
              '@>',
              JSON.stringify({ course_code: COURSE_CODE })
            ),
            db.sequelize.where(
              db.sequelize.cast(db.sequelize.col('metadata'), 'jsonb'),
              '@>',
              JSON.stringify({ course: COURSE_TITLE })
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
      await upsertLessonMetadata(existing.id, { ...(existing.metadata || {}), ...metadata });
      await ensureContentStats(existing.id);
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
      await upsertLessonMetadata(created.id, metadata);
      await ensureContentStats(created.id);
      console.log(`  Created  L${lesson.lessonNumber}: ${lesson.title}`);
    }
  }

  console.log(`\nDone — seeded ${LESSONS.length} lessons for ${COURSE_TITLE} (${COURSE_CODE}).`);
  console.log('Run seed_ebs106_part2.js to add Lessons 14–26.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.sequelize.close());
