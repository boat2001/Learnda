const facts = [
  ['Why recall beats rereading', 'Did you know? Trying to retrieve an answer from memory usually strengthens later recall more than simply reading the same material again.', 'https://en.wikipedia.org/wiki/Testing_effect'],
  ['Why spacing works', 'Did you know? Study sessions spread across several days usually produce longer-lasting learning than the same study time packed into one sitting.', 'https://en.wikipedia.org/wiki/Spacing_effect'],
  ['Sleep and learning', 'Did you know? Sleep after learning helps the brain stabilize and reorganize new memories, which is one reason an all-night study session can backfire.', 'https://en.wikipedia.org/wiki/Memory_consolidation'],
  ['Working memory has limits', 'Did you know? Working memory can handle only a small amount of unfamiliar information at once, so breaking explanations into meaningful chunks can reduce overload.', 'https://en.wikipedia.org/wiki/Working_memory'],
  ['Mistakes can support learning', 'Did you know? A mistake followed by timely correction can become a powerful learning event because it draws attention to the difference between an idea and the correct explanation.', 'https://en.wikipedia.org/wiki/Error-driven_learning'],
  ['Questions reveal more than silence', 'Did you know? Asking learners to explain their reasoning can reveal misconceptions that a correct final answer may hide.', 'https://en.wikipedia.org/wiki/Formative_assessment'],
  ['Wait time changes answers', 'Did you know? Giving learners a few quiet seconds after asking a question can increase participation and produce more thoughtful classroom responses.', 'https://en.wikipedia.org/wiki/Wait_time'],
  ['Feedback needs direction', 'Did you know? Feedback is more useful when it tells a learner what was successful, what needs improvement, and what practical step to try next.', 'https://en.wikipedia.org/wiki/Feedback'],
  ['Prior knowledge can help or mislead', 'Did you know? Learners interpret new information through what they already believe, so prior knowledge can accelerate understanding or reinforce a misconception.', 'https://en.wikipedia.org/wiki/Prior_knowledge_for_learning'],
  ['Explaining improves understanding', 'Did you know? Explaining an idea in your own words can expose gaps that remain hidden while reading notes.', 'https://en.wikipedia.org/wiki/Self-explanation'],
  ['The brain remains adaptable', 'Did you know? The brain can change its connections in response to experience and practice throughout life, a capacity called neuroplasticity.', 'https://en.wikipedia.org/wiki/Neuroplasticity'],
  ['Emotion affects attention', 'Did you know? Emotion can influence what receives attention and what is remembered, which is why a safe classroom climate matters for learning.', 'https://en.wikipedia.org/wiki/Emotion_and_memory'],
  ['Stress has two sides', 'Did you know? Brief, manageable stress may sharpen attention, while intense or prolonged stress can interfere with concentration and memory.', 'https://en.wikipedia.org/wiki/Effects_of_stress_on_memory'],
  ['Movement supports the mind', 'Did you know? Regular physical activity is associated with benefits for mood, attention, and several aspects of cognitive performance.', 'https://en.wikipedia.org/wiki/Neurobiological_effects_of_physical_exercise'],
  ['Teaching can deepen learning', 'Did you know? Preparing to teach a concept often encourages learners to organize ideas and identify connections more carefully.', 'https://en.wikipedia.org/wiki/Learning_by_teaching'],
  ['Mixed practice can be productive', 'Did you know? Mixing related types of problems during practice can feel harder than repeating one type, yet it can improve a learner’s ability to choose the right strategy later.', 'https://en.wikipedia.org/wiki/Interleaving_(psychology)'],
  ['Belonging affects participation', 'Did you know? Learners who feel respected and included are generally more willing to ask questions, attempt difficult work, and recover from mistakes.', 'https://en.wikipedia.org/wiki/School_belonging'],
  ['Names carry classroom power', 'Did you know? Learning and correctly using a student’s name can communicate recognition and help strengthen classroom belonging.', 'https://en.wikipedia.org/wiki/School_belonging'],
  ['Examples need variation', 'Did you know? Seeing varied examples can help learners recognize the deeper rule behind a concept instead of memorizing one surface pattern.', 'https://en.wikipedia.org/wiki/Transfer_of_learning'],
  ['A quiz can be practice', 'Did you know? A low-stakes quiz can improve learning even when it contributes little or nothing to a final grade, because retrieval itself is practice.', 'https://en.wikipedia.org/wiki/Testing_effect'],
  ['Confidence is not mastery', 'Did you know? Familiar notes can create a feeling of knowing even when a learner cannot recall or apply the material without looking.', 'https://en.wikipedia.org/wiki/Metacognition'],
  ['Classroom routines save attention', 'Did you know? Predictable classroom routines reduce repeated decision-making and preserve more time and attention for learning.', 'https://en.wikipedia.org/wiki/Classroom_management'],
  ['Pictures need purpose', 'Did you know? A relevant diagram can support understanding, while a decorative image can consume attention without improving the lesson.', 'https://en.wikipedia.org/wiki/Multimedia_learning'],
  ['Learning transfers imperfectly', 'Did you know? Knowing a skill in one setting does not guarantee that a learner will recognize when to use it in a new setting; transfer needs varied practice.', 'https://en.wikipedia.org/wiki/Transfer_of_learning'],
  ['Teacher expectations matter', 'Did you know? Expectations can subtly affect the opportunities, feedback, and encouragement learners receive, so teachers benefit from checking their assumptions.', 'https://en.wikipedia.org/wiki/Pygmalion_effect'],
  ['Hand signals widen participation', 'Did you know? Simple response systems such as hand signals or answer cards can let a teacher check the whole class instead of hearing only the quickest volunteers.', 'https://en.wikipedia.org/wiki/Formative_assessment'],
  ['Rest is part of professional practice', 'Did you know? Persistent teacher burnout can affect wellbeing, relationships, and classroom practice; recovery and collegial support are professional needs, not rewards for finishing everything.', 'https://en.wikipedia.org/wiki/Teacher_burnout'],
  ['Novices notice different things', 'Did you know? Experienced teachers often recognize meaningful classroom patterns more quickly, while novices may focus on isolated events; guided observation helps build that professional vision.', 'https://en.wikipedia.org/wiki/Teacher_education'],
  ['Retrieval should be effortful, not hopeless', 'Did you know? Memory practice is often most useful when recall requires effort but the learner still has a realistic chance of succeeding or receiving corrective feedback.', 'https://en.wikipedia.org/wiki/Desirable_difficulty'],
  ['A misconception is evidence', 'Did you know? A wrong answer can show the rule a learner is currently using, giving the teacher evidence for a more precise explanation.', 'https://en.wikipedia.org/wiki/Misconception']
];

const stories = [
  {
    title: 'The Lesson That Ended Too Early',
    body: 'During her first teaching practice, Abena finished a forty-minute lesson in eighteen minutes. She had explained every point in her notebook, yet the class stared back quietly. Her mentor did not call the lesson a failure. He asked her to choose one idea and discover what the pupils understood about it. The next day, Abena brought bottle tops, posed a problem, and let pairs explain their thinking. She covered less content, but heard more learning. On her walk home, she rewrote her lesson plan with questions, examples, and time for pupils to think. She began to understand that completing notes and completing learning were not the same thing.',
    lesson: 'A lesson plan should make room for evidence of learning, not only teacher talk.'
  },
  {
    title: 'Kojo and the Empty Hand',
    body: 'Kojo answered every question with his eyes lowered and one empty hand hidden beneath the desk. Some classmates called him lazy because he rarely copied notes. A student teacher, Mansa, sat beside him during break and learned that his family shared one pen among three children. The next morning she placed a small materials basket where anyone could borrow a pen without explaining why. Kojo began completing his work, but Mansa noticed something else: several pupils used the basket. The problem had never belonged to one child. Her quiet solution protected dignity while opening the lesson to everyone.',
    lesson: 'Before labelling behaviour, look for the barrier a learner may be managing silently.'
  },
  {
    title: 'When the Lights Went Off',
    body: 'Yaw had built his entire microteaching lesson around a projected video. Two minutes before he began, the power went out. His classmates waited while panic erased every sentence he had rehearsed. Then he remembered the market outside campus. He drew three stalls on the board and turned the economics lesson into a negotiation between buyers and sellers. The room became noisy with examples and laughter. His lecturer later praised the activity, then asked the question Yaw remembered most: “Was the projector your lesson, or only one tool for the lesson?” From then on, every plan he wrote included a simple alternative.',
    lesson: 'Good teaching is guided by the learning goal, not dependent on one piece of technology.'
  },
  {
    title: 'The Quiet Group Leader',
    body: 'Esi always selected the most confident pupil to lead group work because it saved time. During one lesson, that pupil was absent, and Esi reluctantly asked quiet Akosua to organize the materials. Akosua assigned roles, invited two overlooked classmates to speak, and summarized the group’s answer clearly. Esi realized that her routine had not revealed leadership; it had repeatedly awarded visibility to the same learner. She began rotating roles and giving pupils time to prepare before speaking. Within weeks, the class had more leaders than she had imagined.',
    lesson: 'Participation structures can uncover abilities that quick volunteering hides.'
  },
  {
    title: 'The Red Ink Evening',
    body: 'After teaching all day, Mr. Mensah carried sixty exercise books home. By midnight, he was writing the same correction on page after page, too tired to notice whether anyone would understand it. The next week, he identified three common errors, prepared a short whole-class activity, and asked pupils to correct one example together before revising their own work. He still checked the books, but his comments became shorter and more specific. The pile no longer measured his commitment. What mattered was whether the feedback changed the next attempt.',
    lesson: 'Effective feedback must be usable; teacher exhaustion is not evidence of better assessment.'
  },
  {
    title: 'Ama’s First Observation',
    body: 'Ama’s supervisor sat at the back of the classroom with a pen and a serious face. Each time he wrote, Ama forgot her next question. After the lesson she defended every decision before he had criticized any of them. The supervisor closed his notebook and asked, “Where did you see learning happen?” Together they replayed one moment when a pupil changed an answer after hearing a partner’s explanation. Ama stopped seeing observation as a search for faults. She began bringing one question to every feedback meeting: what should I notice next time?',
    lesson: 'Professional feedback becomes useful when it is connected to observable learning.'
  },
  {
    title: 'The Example from the Lorry Station',
    body: 'A fractions lesson was going nowhere. The textbook showed unfamiliar objects, and several pupils copied procedures without understanding them. During break, student teacher Kofi noticed drivers grouping passengers for different routes. He returned with a story about twelve passengers sharing seats among three cars. Hands rose immediately. Pupils argued about equal groups, drew their own routes, and then connected the idea back to symbols. Kofi did not make the mathematics less rigorous; he gave the new idea somewhere familiar to stand.',
    lesson: 'Local experience can provide a bridge to abstract knowledge.'
  },
  {
    title: 'The Answer Behind the Wrong Answer',
    body: 'When Adjoa said that one quarter was larger than one half because four was larger than two, the class laughed. Her teacher nearly moved to another pupil, then asked Adjoa to draw what she meant. The drawing revealed a rule she had carried from whole numbers into fractions. The teacher used two equally sized sheets, folded them, and invited the class to compare the pieces. Adjoa corrected herself before anyone supplied the answer. Her mistake became the most useful part of the lesson because the teacher treated it as evidence, not embarrassment.',
    lesson: 'A misconception explains a learner’s reasoning and can guide the next teaching move.'
  },
  {
    title: 'The Day Sir Forgot a Name',
    body: 'For three weeks, a teacher called Abdul “the boy at the back.” Abdul stopped raising his hand. A student teacher noticed and quietly made a seating chart, practising names before each lesson. The first time she said, “Abdul, what do you think?” he looked behind him before answering. His idea moved the discussion forward. Nothing dramatic had changed in the timetable or syllabus, but one learner had been returned to the room. The student teacher kept the chart until every name came naturally.',
    lesson: 'Recognition and belonging are small classroom conditions with large consequences.'
  },
  {
    title: 'The Rain on Teaching Practice Day',
    body: 'Heavy rain left only eleven pupils in a classroom planned for forty-five. Nana considered abandoning the lesson because his group activity no longer made sense. Instead, he formed one circle and asked each pupil to contribute an example from home. The smaller class exposed misunderstandings he might have missed in a crowded room. When attendance returned to normal, he kept one part of the circle routine as an exit discussion. An interrupted day had shown him a way to listen better on ordinary days.',
    lesson: 'Adaptation can turn a disrupted lesson into professional learning.'
  },
  {
    title: 'A Chair for Efua',
    body: 'Efua often stood near the doorway because moving between tightly packed desks was difficult with her crutches. Teachers assumed she preferred the fresh air. During practicum, Selina asked Efua where she could participate most comfortably. Together they rearranged one row and created a clear path without isolating her from friends. Efua began joining group tasks instead of watching them. Selina learned that inclusion was not kindness added after planning; it was planning that asked who might be prevented from taking part.',
    lesson: 'Inclusive teaching removes barriers while protecting a learner’s agency and belonging.'
  },
  {
    title: 'The Question Nobody Answered',
    body: 'Mr. Owusu asked a difficult question and waited less than a second before answering it himself. He repeated this pattern until the class learned that silence required no effort; Sir would rescue them. His trainee observer suggested counting slowly to five after each question. The next lesson, the silence felt painfully long. Then one hand rose, followed by another. The answers were incomplete, but they gave Mr. Owusu something to build on. He discovered that waiting was not empty teaching time. It was thinking time he had previously taken away.',
    lesson: 'Purposeful wait time communicates that learners are expected and trusted to think.'
  },
  {
    title: 'The Weekend Without Marking',
    body: 'Akua believed a serious teacher trainee should always be working. She spent weekdays in school, evenings preparing materials, and weekends rewriting perfect lesson notes. By the fourth week she was impatient with pupils and unable to remember why she had chosen teaching. Her mentor asked her to plan one protected evening, share resources with a peer, and identify tasks that were good enough rather than perfect. Rest did not make Akua less committed. It helped her return attentive enough to notice her learners again.',
    lesson: 'Teacher wellbeing supports professional judgement, patience, and sustainable care.'
  },
  {
    title: 'The Language Under the Answer',
    body: 'A pupil understood the science demonstration but struggled to explain it in formal English. Each hesitation was mistaken for lack of knowledge. Student teacher Ibrahim invited pairs to discuss the observation first in the language they used most confidently, then work together on the English explanation. The pupil who had been silent described the process accurately and learned the required vocabulary through the discussion. Ibrahim saw that language could be a bridge to disciplinary learning rather than a gate that kept understanding outside.',
    lesson: 'Strategic use of familiar language can reveal understanding and support academic language development.'
  },
  {
    title: 'The Test Everyone Passed',
    body: 'Every pupil scored highly on Mrs. Boateng’s Friday quiz, and she felt proud until Monday, when few could solve the same problems in a different order. The quiz had copied the practice examples almost exactly. She redesigned the next assessment with one familiar question, one new context, and a prompt asking pupils to explain their choice of method. Scores were lower, but the answers told her much more. She stopped treating easy success as proof of durable learning.',
    lesson: 'Assessment should reveal whether learners can recall, explain, and transfer what they know.'
  }
];

module.exports = { facts, stories };
