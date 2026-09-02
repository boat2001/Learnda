const { Op } = require('sequelize');
const { Content, User, sequelize } = require('../models');

const GUIDE_TAGS = ['eduvhibe', 'eduvhibe_guide'];
const VIDEO_TAGS = ['eduvhibe', 'eduvhibe_video'];

const guides = [
  {
    title: 'Academic Success Guide',
    category: 'Academic',
    source: 'academics.html',
    content: [
      '## Mastering the Art of Learning',
      'Effective study starts with a weekly plan, active recall, and regular review.',
      '- Break large topics into small review blocks.',
      '- Use past questions to test understanding after reading.',
      '- Keep a mistake log and return to it before exams.',
      '### Time management',
      'Plan study blocks around lectures, assignments, peer learning, and rest so academic work stays sustainable.',
    ].join('\n'),
  },
  {
    title: 'Campus Life at Teacher Training College',
    category: 'Lifestyle',
    source: 'campus-life.html',
    content: [
      '## Thriving in a Teacher Training Environment',
      'Campus life works best when academic discipline and professional identity grow together.',
      '- Build relationships with course mates, mentors, and tutors.',
      '- Join learning communities that keep you accountable.',
      '- Balance coursework, teaching practice, rest, and social life.',
    ].join('\n'),
  },
  {
    title: 'Code of Professional Conduct',
    category: 'Campus Hacks',
    source: 'conduct.html',
    content: [
      '## Professional Standards for Teacher Trainees',
      'Teacher trainees are expected to model integrity, responsibility, and respect in academic and social spaces.',
      '- Protect academic integrity in assignments and exams.',
      '- Communicate respectfully with peers, tutors, and learners.',
      '- Treat teaching practice as preparation for real professional service.',
    ].join('\n'),
  },
];

const videos = [
  {
    title: 'What is the Anthropology of Religion?',
    videoUrl: 'https://www.youtube.com/watch?v=2FNZ9t6j4QQ',
    creator: 'Armchair Academics',
    description: 'A clear introduction to how anthropologists study religion, belief systems, rituals, and cultural meaning.',
  },
  {
    title: 'The Map of Physics',
    videoUrl: 'https://www.youtube.com/watch?v=ZihywtixUYo',
    creator: 'Domain of Science',
    description: 'A visual overview of major physics branches, helping students see how mechanics, quantum physics, relativity, and cosmology connect.',
  },
  {
    title: "Freud's Psychoanalytic Theory",
    videoUrl: 'https://www.youtube.com/watch?v=eK43LZfCrJU',
    creator: 'Language and Philosophy',
    description: 'A focused explanation of Freud’s psychoanalytic theory, including the unconscious mind and core ideas used in psychology study.',
  },
  {
    title: 'ALL OF PHYSICS explained in 14 Minutes',
    videoUrl: 'https://www.youtube.com/watch?v=ZAqIoDhornk',
    creator: 'Wacky Science',
    description: 'A fast revision walkthrough of key physics concepts for learners who need a broad refresher before deeper study.',
  },
  {
    title: 'Computer Networking Explained | Cisco CCNA 200-301',
    videoUrl: 'https://www.youtube.com/watch?v=tSodBEAJz9Y',
    creator: 'CertBros',
    description: 'A beginner-friendly networking lesson covering the foundations behind devices, communication, and CCNA-level concepts.',
  },
  {
    title: 'Asante Nkae [Ep. 1] - Akan Child Naming Ceremony',
    videoUrl: 'https://www.youtube.com/watch?v=6M5kEnirY-E',
    creator: 'Ghnewsnow',
    description: 'A cultural studies resource on Akan child naming traditions and the social meaning behind the ceremony.',
  },
  {
    title: 'The hidden meaning behind modern Akan funeral rites in Ghana.',
    videoUrl: 'https://www.youtube.com/watch?v=Vi6PsDX5Khk',
    creator: 'Mickey Agyei',
    description: 'An explainer on Akan funeral rites in Ghana, useful for understanding tradition, symbolism, and contemporary cultural practice.',
  },
  {
    title: 'Skinner’s Operant Conditioning: Rewards & Punishments',
    videoUrl: 'https://www.youtube.com/watch?v=ne6o-uPJarA',
    creator: 'Sprouts',
    description: 'A psychology lesson on operant conditioning, reinforcement, rewards, and punishment in learning behavior.',
  },
  {
    title: 'Basic Integration Formulas - Integral Calculus',
    videoUrl: 'https://www.youtube.com/watch?v=tB3wJ-bwdZc',
    creator: 'GTR Math Tutorial',
    description: 'A mathematics revision video covering basic integration formulas and worked integral calculus examples.',
  },
];

async function getSeedUser() {
  const existing = await User.findOne({
    where: { role: { [Op.in]: ['admin', 'contributor'] } },
    order: [['created_at', 'ASC']],
  });
  if (existing) return existing;

  return User.findOne({ order: [['created_at', 'ASC']] });
}

async function upsertContent({ creatorId, type, title, description, tags, metadata, fileUrl = null, lookupWhere = null }) {
  const existing = await Content.findOne({
    where: lookupWhere || {
      title,
      type,
      tags: { [Op.overlap]: tags },
    },
  });

  const payload = {
    title,
    description,
    type,
    creator_id: creatorId,
    status: 'published',
    tags,
    metadata,
    file_url: fileUrl,
    published_at: new Date(),
  };

  if (existing) {
    await existing.update(payload);
    return existing;
  }

  return Content.create(payload);
}

async function main() {
  const seedUser = await getSeedUser();
  if (!seedUser) {
    throw new Error('Seed requires at least one user to own Eduvhibe content.');
  }

  for (const guide of guides) {
    await upsertContent({
      creatorId: seedUser.id,
      type: 'blog',
      title: guide.title,
      description: guide.content.split('\n').find((line) => line && !line.startsWith('#')) || guide.title,
      tags: GUIDE_TAGS,
      metadata: {
        author: 'Eduvhibe Team',
        category: guide.category,
        content: guide.content,
        read_time: '4 min read',
        source: `backend/uploads/eduvhibe-code/${guide.source}`,
      },
    });
  }

  for (const video of videos) {
    await upsertContent({
      creatorId: seedUser.id,
      type: 'video',
      title: video.title,
      description: video.description,
      tags: VIDEO_TAGS,
      fileUrl: video.videoUrl,
      lookupWhere: {
        type: 'video',
        tags: { [Op.overlap]: VIDEO_TAGS },
        [Op.or]: [
          { file_url: video.videoUrl },
          { title: video.title },
        ],
      },
      metadata: {
        video_url: video.videoUrl,
        level: '100',
        creator: video.creator,
        section: 'eduvhibe',
        source: 'backend/uploads/eduvhibe-code/videoresources.html',
      },
    });
  }

  console.log(`Seeded ${guides.length} Eduvhibe guides and ${videos.length} videos.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
