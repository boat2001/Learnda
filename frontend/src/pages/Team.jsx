import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import CelebrationContributors from '../components/common/CelebrationContributors';
import { FiArrowRight, FiFacebook, FiGithub, FiInstagram, FiLinkedin, FiLink, FiMail, FiPhone, FiTwitter, FiX, FiYoutube } from 'react-icons/fi';
import { FaWhatsapp, FaTelegramPlane } from 'react-icons/fa';
import { SiTiktok } from 'react-icons/si';
import { useAuth } from '../hooks/useAuth';
import { lockBodyScroll } from '../utils/bodyScrollLock';
import api, { resolveUploadUrl } from '../services/api';
import './SharedPages.css';
import './Team.css';

const ACCENTS = ['#38bdf8', '#34d399', '#f97316'];

const SOCIAL_ICONS = {
  twitter:   FiTwitter,
  x:         FiTwitter,
  instagram: FiInstagram,
  facebook:  FiFacebook,
  linkedin:  FiLinkedin,
  youtube:   FiYoutube,
  tiktok:    SiTiktok,
  whatsapp:  FaWhatsapp,
  telegram:  FaTelegramPlane,
  github:    FiGithub,
  website:   FiLink,
};
const ACCENT_GRADIENTS = [
  'linear-gradient(135deg, #38bdf8 0%, #34d399 100%)',
  'linear-gradient(135deg, #34d399 0%, #f97316 100%)',
  'linear-gradient(135deg, #f97316 0%, #38bdf8 100%)',
];

const BASE_ASSET = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');

const resolveTeamPhoto = (photo) => {
  if (!photo) return null;
  if (/^https?:\/\//i.test(photo)) return photo;
  if (photo.startsWith('/uploads/')) return resolveUploadUrl(photo);
  return `${BASE_ASSET}${photo.replace(/^\//, '')}`;
};

const getInitials = (name = '') =>
  name.split(' ').map((w) => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase();

function TeamAvatar({ name, photo, className }) {
  const [errored, setErrored] = useState(false);
  const src = resolveTeamPhoto(photo);
  if (src && !errored) {
    return (
      <img
        src={src}
        alt={name}
        className={`${className} tm-avatar--photo`}
        onError={() => setErrored(true)}
        loading="lazy"
        decoding="async"
      />
    );
  }
  return <div className={className}>{getInitials(name)}</div>;
}

const FALLBACK_TEAM = {
  core_team: [
  {
    id: 'boateng',
    name: 'Kwabena Boateng Adjei',
    aka: 'Boatenberg',
    role: 'Founder & CEO',
    color: '#38bdf8',
    gradient: 'linear-gradient(135deg, #38bdf8 0%, #34d399 55%, #f97316 100%)',
    photo: '/team/members/boateng.jpg',
    contact: { email: 'adjekwaboat@gmail.com', phone: '0591661816' },
    social: { twitter: '', instagram: '', linkedin: '', github: '' },
    bio: [
      "I'm a self-taught software engineer with a passion for technology and innovation. With an ever-increasing knowledge spanning PHP, HTML, CSS, JavaScript, Python and more — my goal is always to become better at making things. My vision: to build technologies that make the world an easier and more exciting place to live.",
      "Venturing into education at Fosco deepened my already strong interest in learning and the impartation of knowledge. Believing that everyone can learn led me to build this platform — to help people learn in a genuinely interesting way. Sharether exists to give every student an equal opportunity to grow.",
      "I also served as the SRC Academic Coordinator for Fosco College of Education in 2023/24.",
      "I am an educator by training and an engineer by practice.",
    ],
  },
  {
    id: 'think',
    name: 'Enock Awuah',
    aka: 'Think Twice-Official',
    role: 'Files Editor',
    color: '#34d399',
    gradient: 'linear-gradient(225deg, #f97316 0%, #34d399 50%, #38bdf8 100%)',
    photo: '/team/members/think.jpg',
    contact: { email: 'www.awuahenock5@gmail.com', phone: '0558139031', phone2: '0201001656' },
    social: {},
    bio: [
      "A past student of the Bachelor of Education in Social Studies program at Foso College of Education (FOSCO) in Assin Foso, located in the Central Region of Ghana. His educational journey began at Anyinam Kotoku D/A Junior High School in the Eastern Region (Birim South District), where he completed his junior high education and served as an assistant school prefect during the 2016/2017 academic year.",
      "After junior high school, he attended Achiase Senior High School (ACHISEC) in Akim Achiase, also in the Eastern Region (Birim South District). During the 2020/2021 academic year, he held the position of class representative for the entire General Arts 3 cohort of 244 students, and served as president of the ATSAG Association, facilitating the college application process for junior students. He continued his education at FOSCO with an aspiration to become a leading information disseminator among the 49 public and 18 private colleges in Ghana, and has since taken on the role of Files Editor for Sharether.com.",
    ],
  },
  {
    id: 'isaac',
    name: 'Isaac Appiah',
    aka: 'Former SRC President, Foso COE',
    role: 'Executive Member',
    color: '#f97316',
    gradient: 'linear-gradient(45deg, #34d399 0%, #f97316 50%, #38bdf8 100%)',
    photo: '/team/members/isaac.jpg',
    contact: {},
    social: {},
    bio: [
      "Leader | Agent of Change | 21st Century Facilitator",
      "I lead with purpose, serve with responsibility, and build for what's next. I turn voices into action — shaping policies, programs, and opportunities that create real impact on the ground.",
      "I'm an agent of change because I believe systems should work for people. I challenge outdated structures, create space for new ideas, and follow through until solutions reach the people who need them. My leadership is rooted in listening first, acting with clarity, and staying accountable for results.",
      "As a 21st century facilitator, I meet education and leadership where they're headed. Through collaboration, technology, and innovation, I build spaces where ideas are shared, skills are built, and people are equipped to lead in a fast-changing world.",
      "In all, I learn, unlearn and relearn.",
    ],
  },
  {
    id: 'sirpaul',
    name: 'Paul Obosu Sagoe',
    aka: 'Pursue Graphics',
    role: 'Graphic Designer',
    color: '#f97316',
    gradient: 'linear-gradient(135deg, #f97316 0%, #38bdf8 55%, #34d399 100%)',
    photo: '/team/members/sirpaul.jpeg',
    contact: {},
    social: {},
    bio: [],
  },
  {
    id: 'muba',
    name: 'Mubarack Jamiu',
    aka: 'King Muba',
    role: 'Programmer & Blogger',
    color: '#38bdf8',
    gradient: 'linear-gradient(315deg, #f97316 0%, #38bdf8 45%, #34d399 100%)',
    photo: '/team/members/muba.png',
    contact: {},
    social: { website: 'https://www.jmonlinepublication.com' },
    bio: [
      "I am Mubarack Jamiu (AKA King Muba), a dynamic facilitator, blogger, graphic designer, Android app developer, web developer, and animator with a strong passion for technology, creativity, and digital innovation.",
      "I am dedicated to using my skills to educate, inspire, and empower young people through technology and digital media.",
      "With experience in Android app development, website creation, animation, graphic design, and content blogging, I combine creativity and technical expertise to build engaging digital solutions and impactful online content.",
      "I am committed to helping businesses, brands, and individuals grow their digital presence through modern technology and innovative ideas.",
    ],
  },
  {
    id: 'eric',
    name: 'Eric K. Baah',
    aka: 'Ericus',
    role: 'Graphic Designer',
    color: '#34d399',
    gradient: 'linear-gradient(135deg, #34d399 0%, #f97316 55%, #38bdf8 100%)',
    photo: '/team/members/eric.jpeg',
    contact: {},
    social: {},
    bio: [
      "Eric K. Baah is a dedicated Ghanaian Creative Arts teacher with experience teaching learners at the Basic School level. He had his training at Foso College of Education. He is passionate about nurturing creativity, practical skills, and cultural appreciation through arts education.",
      "With a strong interest in innovative teaching methods and the integration of local materials in art instruction, Eric K. Baah focuses on making learning practical, engaging, and relevant to everyday life. His teaching approach encourages critical thinking, creativity, teamwork, and self-expression among students.",
      "In addition to classroom teaching, Eric K. Baah is involved in educational research and lesson development aimed at improving the teaching and learning of Creative Arts in Ghanaian basic schools. He is committed to promoting quality education and helping students discover and develop their artistic potential.",
    ],
  },
  {
    id: 'josephine',
    name: 'Josephine Frimpong',
    fullName: 'Josephine Abena Amponsah Frimpong',
    aka: 'Abernaahthemotivator',
    role: 'Executive Member',
    color: '#f97316',
    gradient: 'linear-gradient(135deg, #f97316 0%, #38bdf8 55%, #34d399 100%)',
    photo: '/team/members/josephine.jpeg',
    contact: { phone: '0597983920' },
    social: { tiktok: 'https://www.tiktok.com/@abernaahthemotivator' },
    bio: [
      "I am Josephine Abena Amponsah Frimpong, a proud daughter of Mampong-Benim in the Ashanti Region. The culture, discipline, and hard work of Mampong shaped who I am today.",
      "I am currently a level 400 student-trainee at Foso College of Education, where I am training to become a teacher who inspires the next generation. My dream is to walk into a classroom and make every child believe, 'I can do it.'",
      "What defines me is being a motivator. I believe words can lift people. I love encouraging my colleagues and pupils to try again, even when learning feels hard.",
      "Self-determined — I set goals and I go for them. Being at Foso College is proof that dedication beats every obstacle.",
      "Confident in my capabilities — I trust the gifts God has given me. I know I can teach, lead, and make a difference, one lesson at a time.",
      "Foso College is teaching me skill, and my determination is teaching me that no dream is too big to achieve.",
    ],
  },
  {
    id: 'allinco',
    name: 'Oboy Allinco',
    aka: 'Update Man',
    role: 'Executive Member',
    color: '#f97316',
    gradient: 'linear-gradient(135deg, #f97316 0%, #38bdf8 55%, #34d399 100%)',
    photo: '/team/members/allinco.jpeg',
    contact: {},
    social: {},
    bio: [],
  },
  {
    id: 'shadrach',
    name: 'Otwey Shadrack',
    aka: 'Shadrach',
    role: 'Files Contributor',
    color: '#38bdf8',
    gradient: 'linear-gradient(135deg, #38bdf8 0%, #34d399 55%, #f97316 100%)',
    photo: '/team/members/shadrach.jpeg',
    contact: {},
    social: {},
    bio: [
      "A Level 400 Mathematics and ICT student at Foso College of Education with a keen interest in student support and academic resource accessibility. As a contributor to this platform for UCC affiliated Colleges of Education, he organizes PDF past questions and other learning materials to help students easily access resources for their academic work.",
      "Through this role, he aims to help address the challenge many students face in finding reliable learning materials and is grateful for the opportunity to serve and contribute to student success.",
    ],
  },
  {
    id: 'sarkodie',
    name: 'Sarkodie Godfred',
    aka: 'Sark',
    role: 'Programmer',
    color: '#34d399',
    gradient: 'linear-gradient(45deg, #38bdf8 0%, #34d399 50%, #f97316 100%)',
    photo: '/team/members/sarkodie.jpeg',
    contact: {},
    social: {},
    bio: [
      "My passion for becoming a programmer ignited during my early teenage years when I first encountered the magic of coding at the Senior High School level. I was enrolled in a General Science program and had ICT as one of my elective subjects, which replaced Biology. ICT was not only about theory but also involved intensive practical work.",
      "At first, I did not know if I was on the right path because it seemed different from my initial dream of becoming a medical doctor to save lives and give people a second chance to pursue their goals. However, everything changed when I started studying ICT and became increasingly interested, especially when we covered programming.",
      "The initial spark came from simple curiosity about creating my own program using Quick Beginner All-purpose Symbolic Instruction Code (Q-BASIC) during one of our ICT laboratory lessons. In the same week, while practicing, I also helped a friend debug an error by modifying a line of code in a basic HTML document.",
      "After completing Senior High School, my results came in, but I did not get the chance to apply and move to a tertiary institution that year because I delayed taking the necessary form. The following year, I applied to a teacher training program and gained admission to Foso College of Education.",
      "It was there that I met the person who made this platform possible for me to express my programming journey: Honorable Adjei Boateng, the founder of Sharether. He started Sharether on his own and later introduced the site to me. I felt privileged and did not hesitate to seize the opportunity he offered me to join his team.",
      "Joining the Sharether team has enriched my learning experience immensely and taught me the importance of teamwork, communication, and sharing knowledge.",
      "I hold the belief that success is a journey. Everything I have achieved marks only the beginning, which means there is still more to accomplish and I have to keep doing more.",
    ],
  },
  {
    id: 'akwasi_k',
    name: 'Oppong Boateng Stephen',
    role: 'Executive Member',
    aka: 'Akwasi K',
    color: '#38bdf8',
    gradient: 'linear-gradient(135deg, #38bdf8 0%, #f97316 100%)',
    photo: '/team/members/akwasi k.jpeg',
    contact: {},
    social: {},
    bio: [
      "My name is Oppong Boateng Stephen. I study at Legon. From childhood, I developed a strong passion for creativity in technology, and this drive has motivated me to support Sharether as a Co-investor and as part of the management board.",
      "I genuinely believe Sharether has a bright and promising future ahead. Thank you.",
    ],
  },
  {
    id: 'micheal',
    name: 'Michael Kwabena Aidoo',
    aka: 'Micheal',
    role: 'Executive Member',
    color: '#f97316',
    gradient: 'linear-gradient(135deg, #f97316 0%, #34d399 100%)',
    photo: '/team/members/mike.jpeg',
    contact: {},
    social: {},
    bio: [
      "As a partner, I am proud of Sharether's achievements and growth. I appreciate the dedication and teamwork that have contributed to its success. My wish is for Sharether to continue growing, remain innovative, strengthen its partnerships, and achieve greater success and prosperity in the years ahead.",
    ],
  },
  {
    id: 'gideon',
    name: 'Gideon Ofori',
    aka: 'Gideon',
    role: 'Executive Member',
    color: '#38bdf8',
    gradient: 'linear-gradient(135deg, #38bdf8 0%, #34d399 55%, #f97316 100%)',
    photo: '/team/members/gideon.jpeg',
    contact: {},
    social: {},
    bio: [
      "Gideon Ofori is a graduate of Foso College of Education, where he studied Science and Mathematics and completed his program in the 2025/2026 academic year.",
      "As an Executive Member for Sharether, he is committed to promoting a platform that supports students in their academic journey. Having experienced the challenges and rewards of college education firsthand, he believes Sharether provides a smart and engaging way for students to learn, collaborate, and excel. His goal is to help current students make the most out of the platform and achieve outstanding academic success.",
      "As a former college student, his vision with Sharether is to help promote it as a platform that makes learning engaging and helps students learn the smart way, enabling both individual and group learners to achieve a common goal: passing and excelling at the end of each semester.",
    ],
  },
  ],
  content_support: [
  {
    id: 'philip',
    name: 'Philip Arhin',
    role: 'Files Contributor',
    aka: 'Fosco SRC Academic Coord. (22/23)',
    color: '#38bdf8',
    gradient: 'linear-gradient(135deg, #38bdf8 0%, #34d399 100%)',
    photo: '/team/support/philip.jpeg',
    contact: {},
    bio: [
      'Date of birth: 8 March 2000.',
      "Bachelor's degree in RME and Social Studies.",
    ],
  },
  {
    id: 'abigail',
    name: 'Abigail Quainoo',
    role: 'Files Contributor',
    aka: 'Fosco SRC Academic Coord. (22/23)',
    color: '#34d399',
    gradient: 'linear-gradient(135deg, #34d399 0%, #38bdf8 100%)',
    photo: '/team/support/abigail.jpeg',
    contact: {},
    bio: [
      'I am Abigail Quainoo, a passionate researcher, educator, and technology enthusiast from Ghana with a strong interest in cybersecurity, artificial intelligence, and digital innovation. I am a graduate of Foso College of Education and currently work at the Garrison Education Directorate in the Greater Accra Region.',
      'As a lifelong learner, I continuously seek opportunities to develop my knowledge and professional skills in both education and technology. I have acquired certificates in ISO/IEC 42001 and Fundamentals of Artificial Intelligence, which have strengthened my understanding of AI governance, emerging technologies, and responsible digital transformation. I am also building my skills in cybersecurity, ethical hacking, web development, and digital research through self-learning and professional online programs.',
      'My passion for research and advocacy has led me to focus on issues affecting young people, especially teenage pregnancy and socioeconomic challenges in Ghana. I am interested in exploring how ICT and technology can be used to provide innovative solutions to social and educational problems. I have conducted research on the impact of socioeconomic barriers on teenage pregnancy and continue to work toward making a positive impact through education and technology.',
      'In addition to academics and research, I have experience in cartoon animation, mobile app development, and digital creativity. My long-term goal is to become a lecturer and researcher in cyber law and cybersecurity while contributing to society through education, innovation, mentorship, and advocacy.',
      'I am teachable, highly adaptive, and passionate about making an impact in every situation. Through determination, resilience, and continuous learning, I strive to inspire others and contribute meaningfully to my community and beyond.',
    ],
  },
  { id: 'patricia', name: 'Miss. Patricia Dadzie', role: 'Files Contributor',     aka: 'Fosco SRC Academic Coord. (23/24)', color: '#f97316', gradient: 'linear-gradient(135deg, #f97316 0%, #34d399 100%)', photo: '/team/support/patricia.jpeg', contact: {}, bio: [] },
  {
    id: 'obeng',
    name: 'Amoah Akwasi Obeng',
    role: 'Hosting & SSL Support',
    aka: 'Obengmix',
    color: '#38bdf8',
    gradient: 'linear-gradient(225deg, #38bdf8 0%, #f97316 100%)',
    photo: '/team/support/obeng.jpeg',
    contact: {},
    social: {},
    bio: [
      "Amoah Akwasi Obeng is an S.H.S. graduate. He completed Church of Christ Senior High School, located at Ejisu Adadientem.",
      "He was the Church of Christ Army Cadet Quartermaster and is very much interested in the Ghana Armed Forces. So immediately he completed S.H.S., he bought one of the military forms, and as time goes on, he will become a soldier by profession.",
    ],
  },
  {
    id: 'bilkis',
    name: 'Bilkis Babie Yahya',
    role: 'Files Contributor',
    aka: 'Fosco Academic Coord. (24/25)',
    color: '#34d399',
    gradient: 'linear-gradient(135deg, #34d399 0%, #38bdf8 100%)',
    photo: '/team/support/bilkis.jpeg',
    contact: {},
    social: { instagram: 'https://www.instagram.com/bilkis4732', tiktok: 'https://www.tiktok.com/@bilkis4732' },
    bio: [
      'Bilkis Babie Yahya is a Level 400 Education student who served as the Academic Coordinator in her school, where she played an active role in supporting academic activities and student coordination.',
    ],
  },
  { id: 'bernard',  name: 'Bernard',            role: 'Files Contributor',     aka: 'Fosco Academic Coord. (24/25)',                                  color: '#f97316', gradient: 'linear-gradient(135deg, #f97316 0%, #34d399 100%)', photo: '/team/support/bernard.jpg',   contact: {}, bio: [] },
  ],
  notable_mentions: [
  {
    id: 'rahman',
    name: 'Abdul Rahman Abdullah',
    aka: 'Sir Rahman',
    role: 'Advisor',
    color: '#38bdf8',
    gradient: 'linear-gradient(135deg, #38bdf8 0%, #34d399 100%)',
    photo: '/team/mentions/sir-rahman.jpeg',
    contact: {},
    social: {},
    bio: [
      "Sir Rahman — a curious mind dedicated to the growth of education and technology in Ghana. With a strong background in educational research, content development, and digital learning design, he brings both expertise and passion to his work.",
      "Sir Rahman believes that technology, when thoughtfully applied, can transform the educational experience for learners at all levels. Drawing from research, classroom experience, and a commitment to innovation, he has worked to make learning more accessible, engaging, and impactful for students across Ghana.",
      "As a member of the Sharether team, Sir Rahman's contributions extend beyond content creation — he has been a driving force in developing educational frameworks and resources that support Sharether's mission to simplify and democratize education in Ghana.",
      "His aspiration is simple: a generation of learners empowered by quality content, strong mentorship, and the tools they need to thrive. Sir Rahman continues to work toward making that a reality, one lesson at a time.",
      "Sir Rahman is also a co-founder of the iTech Society on the Foso College of Education campus.",
    ],
  },
  {
    id: 'pedro',
    name: 'Michael Kweku Saikoom',
    aka: 'Pedro',
    role: 'Advisor',
    color: '#34d399',
    gradient: 'linear-gradient(135deg, #34d399 0%, #f97316 100%)',
    photo: '/team/mentions/pedro.jpeg',
    contact: {},
    social: {},
    bio: [
      "I'm interested in education, leadership, and using technology to create impact. With a background in IT and Computer Networking, I enjoy offering practical ideas and guidance. Learning that Sharether was being built outside an IT background encouraged me even more to support it.",
      "I supported Sharether in its early stage by sharing ideas and guidance, and it has been rewarding to watch how far it has come and hoping to see more.",
      "Pedro is also a co-founder of the iTech Society on the Foso College of Education campus.",
    ],
  },
  {
    id: 'sikapa',
    name: 'Godfred Afful Sikapa',
    aka: 'Sikapa',
    role: 'Advisor',
    color: '#f97316',
    gradient: 'linear-gradient(135deg, #f97316 0%, #38bdf8 100%)',
    photo: '/team/mentions/sikapa.jpeg',
    contact: {},
    social: {},
    bio: [
      "Godfred Afful is an educator and aspiring educational researcher. He holds a Bachelor of Education degree in Mathematics and ICT from Foso College of Education, affiliated with the University of Cape Coast.",
      "Godfred is passionate about using technology to enhance education. His contribution to the development of Sharether demonstrates his commitment to helping College of Education students access learning resources more easily and promote collaborative learning.",
      "Throughout his educational journey, he has demonstrated leadership through roles such as Head of Course Representatives and Course Representative for Mathematics and ICT. These experiences have strengthened his communication, teamwork, and leadership skills while deepening his commitment to educational improvement.",
      "Godfred is also a co-founder of the iTech Society on the Foso College of Education campus.",
    ],
  },
  {
    id: 'theo',
    name: 'Baffoe Theophilus',
    aka: 'Theo',
    role: 'Original Eduvhibe Creator',
    shortRole: 'Eduvhibe Creator',
    color: '#34d399',
    gradient: 'linear-gradient(135deg, #34d399 0%, #38bdf8 100%)',
    photo: '/team/mentions/theo.jpg',
    contact: {},
    social: {},
    bio: [
      "Baffoe Theophilus conceived the Eduvhibe idea, built Eduvhibe V1 and V2, and shaped it around course materials, video resources, survival guides, and CGPA tracking.",
      "He offered Eduvhibe to Sharether because most of its operations were cross-cutting with Sharether's learning mission. The integration keeps the original academic purpose while giving students a stronger platform around it.",
    ],
  },
  {
    id: 'chris',
    name: 'Osei Chris',
    aka: 'Prof',
    role: 'Frontend & Backend Developer',
    shortRole: 'Developer',
    color: '#38bdf8',
    gradient: 'linear-gradient(135deg, #38bdf8 0%, #f97316 100%)',
    photo: '/team/mentions/chris.jpg',
    contact: {},
    social: {},
    bio: [
      "My tech journey started right after JHS here in Ghana. What began as basic computing lessons quickly turned into a deep passion for the web. I was entirely self-taught, buying courses and working my way up to mastering HTML, CSS, JavaScript, React, Next.js, and Vite.",
      "My path crossed with Sharether while I was a student at Abetifi Presbyterian College of Education. I wanted to help out, so I started solving past questions and sending them over to be uploaded for the colleges that use the platform.",
      "As I collaborated with the team, I introduced myself as a developer and eventually got the opportunity to code the Eduvibe section for the V3 launch. To me, Sharether is the SAFEST and FASTER place to learn, and I am proud to be part of building it.",
    ],
  },
  {
    id: 'acquah_michael',
    name: 'Acquah Michael',
    role: 'Answers Researcher',
    aka: 'Mike',
    color: '#f97316',
    gradient: 'linear-gradient(135deg, #f97316 0%, #34d399 100%)',
    photo: '/team/mentions/acquah.jpg',
    contact: {},
    social: {},
    bio: [
      "I'm Acquah Michael, a level 200 student from Abetifi College of Education.",
    ],
  },
  {
    id: 'arhinsco',
    name: 'Stephen Agyekum',
    role: 'Content Creator & AI Specialist',
    shortRole: 'AI Specialist',
    aka: 'Arhinsco',
    color: '#34d399',
    gradient: 'linear-gradient(135deg, #34d399 0%, #38bdf8 100%)',
    photo: '/team/mentions/arhinsco.jpeg',
    contact: {},
    social: {
      linkedin: 'https://www.linkedin.com/in/stephen-agyekum-a77336271',
      youtube: 'https://youtube.com/@arhinscosolutech',
      whatsapp: 'https://wa.me/233559428162',
    },
    bio: [
      "Content creator, AI specialist, and social media growth strategist helping brands and individuals build powerful digital presences.",
    ],
  },
  ],
  donors: [
  { id: '1',  name: 'Samuel Heighty',               from: 'Student at Fosco' },
  { id: '2',  name: 'Abigail Frimpong',             from: 'Student at Fosco' },
  { id: '3',  name: 'Kofi Boamah',                  from: 'Student' },
  { id: '4',  name: 'Carlos',                       from: 'Student' },
  { id: '5',  name: 'Christian',                    from: 'Student' },
  { id: '6',  name: 'Francisca Agyenkwah',          from: 'Holy Child COE' },
  { id: '7',  name: 'Sandra Adams',                 from: 'Holy Child COE' },
  { id: '8',  name: 'Lordina K. Dompreh',           from: 'Kibi COE' },
  { id: '9',  name: 'Eric Owusu',                   from: 'Berekum COE' },
  { id: '10', name: 'Richlove Kyerewaa Mensah',     from: 'Abetifi COE' },
  { id: '11', name: 'Dorcas Adoma',                 from: 'Holy Child COE' },
  { id: '12', name: 'Selina Enyonam',               from: "St. Monica's COE" },
  { id: '13', name: 'Usman Mamuda',                 from: 'Atebubu COE' },
  { id: '14', name: 'Mohammed Mawadatu',            from: 'Atebubu COE' },
  { id: '15', name: 'Barbara Asare',                from: 'Kibi COE' },
  { id: '16', name: 'Ellen Amposah',                from: 'OLA COE' },
  { id: '17', name: 'Sandra Agyapong',              from: 'OLA COE' },
  { id: '18', name: 'Mercy Dontoh',                 from: 'Holy Child COE' },
  { id: '19', name: 'Andrew Kakra Amoh',            from: 'Berekum COE' },
  { id: '20', name: 'Precious Ahiable',             from: 'St. Francis COE' },
  { id: '21', name: 'Aduah Christopher',            from: 'Jasikan COE' },
  { id: '22', name: 'Priscilla Cobbinah',           from: 'Holy Child COE' },
  { id: '23', name: 'Philip Darkwah',               from: 'Kibi COE' },
  { id: '24', name: 'Edith Korankye Ahimi',         from: 'OLA COE' },
  { id: '25', name: 'Juliana Asarewaa',             from: 'OLA COE' },
  { id: '26', name: 'Esther Nyarkoa',               from: 'Jasikan COE' },
  { id: '27', name: 'Saniwaah Esther Senior',       from: "St. Teresa's COE" },
  { id: '28', name: 'Veronica Antwiwaa Opuku',      from: "St. Monica's COE" },
  { id: '29', name: 'Oppong Peter Owusu',           from: 'Kibi COE' },
  { id: '30', name: 'Anyoka Mathias Ayarigah',      from: 'Berekum COE' },
  { id: '31', name: 'Rebecca Ofori',                from: 'OLA COE' },
  { id: '32', name: 'Comfort Mbawumia',             from: 'Berekum COE' },
  { id: '33', name: 'Dindomeh Juliana',             from: 'Jasikan COE' },
  { id: '34', name: 'Gyekebea Erica',               from: 'Kibi COE' },
  { id: '35', name: 'Donkor Kingsley',              from: 'Foso COE' },
  { id: '36', name: 'Gbandi Oliva',                 from: 'Jasikan COE' },
  { id: '37', name: 'Laahiru Usman',                from: 'Berekum COE' },
  { id: '38', name: 'Emelia Serwah Antwi',          from: 'Holy Child COE' },
  { id: '39', name: 'Ohenewaa Beatrice Twum',       from: 'Kibi COE' },
  { id: '40', name: 'Alice Yankey',                 from: 'Holy Child COE' },
  { id: '41', name: 'Juliana Mensah Agyeiwaa',      from: 'Kibi COE' },
  { id: '42', name: 'Appiah Florence',              from: 'Jasikan COE' },
  { id: '43', name: 'Vera Boateng',                 from: 'OLA COE' },
  { id: '44', name: 'Elizabeth Amuzu',              from: 'OLA COE' },
  { id: '45', name: 'Kwartemaa Ruth',               from: 'St. Ambrose COE' },
  { id: '46', name: 'Osie Gideon',                  from: 'Berekum COE' },
  { id: '47', name: 'Mary Yawson',                  from: 'OLA COE' },
  { id: '48', name: 'Comfort Nkansah',              from: 'OLA COE' },
  { id: '49', name: 'Asare Love Korkor Korantemaa', from: 'Kibi COE' },
  { id: '50', name: 'Tignanikum Jonas',             from: 'Jasikan COE' },
  { id: '51', name: 'Diana D. Quarcoe',             from: 'Holy Child COE' },
  { id: '52', name: 'Appiah Veron',                 from: 'Berekum COE' },
  { id: '53', name: 'Christabel Arthur',            from: 'Holy Child COE' },
  { id: '54', name: 'Keziah Maame Yaa Sampson',     from: 'OLA COE' },
  { id: '55', name: 'Sophia Akasi Abdulai',         from: 'Holy Child COE' },
  { id: '56', name: 'Victoria Essel',               from: 'Holy Child COE' },
  { id: '57', name: 'Yeboah Beatrice',              from: 'Jasikan COE' },
  { id: '58', name: 'Georgina Owusu Boampong',      from: 'Kibi COE' },
  { id: '59', name: 'Claudine Afi Tugbo',           from: 'Holy Child COE' },
  { id: '60', name: 'Mohammed Musliha Bansi',       from: 'Jasikan COE' },
  { id: '61', name: 'Deborah Kumah',                from: 'Jasikan COE' },
  { id: '62', name: 'Oga Sophia',                   from: 'Jasikan COE' },
  { id: '63', name: 'Nasiru Ayida',                 from: 'Jasikan COE' },
  { id: '64', name: 'Musah Mumuni Zakiratu',        from: 'Jasikan COE' },
  { id: '65', name: 'Comfort Pokuah',               from: "St. Monica's COE" },
  { id: '66', name: 'Evelyn Ninson',                from: 'Jasikan COE' },
  { id: '67', name: 'Kabuja Philip Wuninkpel',      from: 'Jasikan COE' },
  { id: '68', name: 'Adom Samuel',                  from: 'Jasikan COE' },
  { id: '69', name: 'Sakyi Veronica',               from: 'Jasikan COE' },
  { id: '70', name: 'Ntoso Elisha',                 from: 'Jasikan COE' },
  { id: '71', name: 'Antwi Bridget',                from: 'Jasikan COE' },
  { id: '72', name: 'Duboh Jennifer',               from: 'Jasikan COE' },
  { id: '73', name: 'Major Lovia',                  from: 'Jasikan COE' },
  { id: '74', name: 'Kuformah Josphine',            from: 'Jasikan COE' },
  { id: '75', name: 'Agyeiwa Ruth',                 from: 'Jasikan COE' },
  { id: '76', name: 'Amarkwah Esther',              from: 'Jasikan COE' },
  { id: '77', name: 'Adams Fuseni',                 from: 'Jasikan COE' },
  { id: '78', name: 'Worwomyo Felix',               from: 'Jasikan COE' },
  { id: '79', name: 'Dzeha Charlse',                from: 'Jasikan COE' },
  { id: '80', name: 'Boabeng Emmanuel',             from: 'Jasikan COE' },
  { id: '81', name: 'Tadili Solomon',               from: 'Jasikan COE' },
  { id: '82', name: 'Denoo Ruth',                   from: 'Jasikan COE' },
  { id: '83', name: 'Kokah Sampson',                from: 'Jasikan COE' },
  { id: '84', name: 'Adjakah Cynthia',              from: 'Jasikan COE' },
  { id: '85', name: 'Agbenyefia Wisdom',            from: 'Jasikan COE' },
  { id: '86', name: 'Agbemetsi Joseph',             from: 'Jasikan COE' },
  { id: '87', name: 'Dzifa Eric',                   from: 'Jasikan COE' },
  { id: '88', name: 'Amoako Faucette',              from: 'Jasikan COE' },
  { id: '89', name: 'Binangma Maxwell',             from: 'Jasikan COE' },
  { id: '90', name: 'Tamekloe Joyce',               from: 'Jasikan COE' },
  { id: '91', name: 'Allalah Francis',              from: 'Jasikan COE' },
  { id: '92', name: 'Richmond Nikorban',            from: 'Jasikan COE' },
  { id: '93', name: 'Bakam MacLean',                from: 'Jasikan COE' },
  { id: '94', name: 'Yeboah Delight',               from: 'Jasikan COE' },
  ],
};

export default function Team() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null);
  const [team, setTeam] = useState(FALLBACK_TEAM);
  const userDisplayName = user?.full_name || user?.name || user?.email || 'Sharether User';

  useEffect(() => {
    api.siteContent.getTeam()
      .then((res) => {
        if (res?.success && res.team) setTeam(res.team);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) return undefined;
    const release = lockBodyScroll();
    const onKey = (e) => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', onKey);
    return () => { release(); window.removeEventListener('keydown', onKey); };
  }, [selected]);


  return (
    <div className="page-shell team-page">

      {/* Hero */}
      <section className="page-hero hero-theme-mission page-hero-compact">
        <div className="hero-grid">
          <div>
            <span className="hero-tag">The people</span>
            <h1 className="hero-title">Built by students,<br />for students.</h1>
            <p className="hero-subtitle">
               Meet the team turning academic frustration into a platform
              thousands of students learn with everyday.
            </p>
          </div>
        </div>
      </section>

      {/* Celebratory callout */}
      <div className="tm-celebrate">
        <span className="tm-celebrate__mark" aria-hidden="true">&ldquo;</span>
        <blockquote className="tm-celebrate__line">
          Behind every resource downloaded, every lesson completed, every student
          who found what they needed &mdash; there is someone on this page who made
          it happen. This is their platform as much as it is yours. Let's honour them all. 🎉
        </blockquote>
        <div className="tm-celebrate__author">
          <img
            src={resolveTeamPhoto('/team/members/boateng.jpg')}
            alt="Kwabena Boateng"
            className="tm-celebrate__photo"
          />
          <div className="tm-celebrate__author-text">
            <strong className="tm-celebrate__name">Kwabena Boateng Adjei</strong>
            <span className="tm-celebrate__role">Founder &amp; CEO, Sharether</span>
          </div>
        </div>
      </div>

      {/* Section 1: Immediate team */}
      <section className="page-section">
        <div className="section-heading">
          <h2>Immediate team</h2>
          <p>The people who build, curate, and run Sharether.</p>
        </div>
        <div className="tm-grid">
          {(team.core_team || []).map((m, i) => {
            const color = ACCENTS[i % ACCENTS.length];
            const gradient = ACCENT_GRADIENTS[i % ACCENT_GRADIENTS.length];
            return (
            <button
              key={m.id}
              type="button"
              className="tm-card"
              style={{ '--tm-color': color, '--tm-gradient': gradient }}
              onClick={() => setSelected({ member: m, color, gradient })}
            >
              <TeamAvatar name={m.name} photo={m.photo} className="tm-card__avatar" />
              <div className="tm-card__body">
                <span className="tm-badge">{m.role}</span>
                <strong className="tm-card__name">{m.name}</strong>
                <span className="tm-card__aka">&ldquo;{m.aka}&rdquo;</span>
              </div>
              <span className="tm-card__cta">
                View info <FiArrowRight aria-hidden="true" />
              </span>
            </button>
            );
          })}
        </div>
      </section>

      {/* Section 2: Content and Support */}
      <section className="page-section">
        <div className="section-heading">
          <h2>Content and Support</h2>
          <p>People who did unimaginable things for Sharether.</p>
        </div>
        <div className="tm-contrib-grid">
          {(team.content_support || []).map((m, i) => {
            const color = m.color || ACCENTS[i % ACCENTS.length];
            const gradient = m.gradient || ACCENT_GRADIENTS[i % ACCENT_GRADIENTS.length];
            return (
              <button
                key={m.id}
                type="button"
                className="tm-contrib-card"
                style={{ '--tm-color': color }}
                onClick={() => setSelected({ member: m, color, gradient })}
              >
                <div className="tm-contrib-card__top" aria-hidden="true" />
                <TeamAvatar name={m.name} photo={m.photo} className="tm-contrib-avatar" />
                <div className="tm-contrib-body">
                  <strong className="tm-contrib-name">{m.name}</strong>
                  <span className="tm-badge">{m.role}</span>
                  {m.aka && <span className="tm-contrib-aka">{m.aka}</span>}
                </div>
                <span className="tm-card__cta">
                  View profile <FiArrowRight aria-hidden="true" />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Section 3: Notable Mentions */}
      <section className="page-section">
        <div className="section-heading">
          <h2>Notable Mentions</h2>
          <p>People who helped shape what Sharether is today.</p>
        </div>
        <div className="tm-contrib-grid">
          {(team.notable_mentions || []).map((m, i) => {
            const color = m.color || ACCENTS[i % ACCENTS.length];
            const gradient = m.gradient || ACCENT_GRADIENTS[i % ACCENT_GRADIENTS.length];
            return (
              <button
                key={m.id}
                type="button"
                className="tm-contrib-card"
                style={{ '--tm-color': color }}
                onClick={() => setSelected({ member: m, color, gradient })}
              >
                <div className="tm-contrib-card__top" aria-hidden="true" />
                <TeamAvatar name={m.name} photo={m.photo} className="tm-contrib-avatar" />
                <div className="tm-contrib-body">
                  <strong className="tm-contrib-name">{m.name}</strong>
                  {(m.shortRole || m.role) && <span className="tm-badge">{m.shortRole || m.role}</span>}
                  {m.aka && <span className="tm-contrib-aka">{m.aka}</span>}
                </div>
                <span className="tm-card__cta">
                  View profile <FiArrowRight aria-hidden="true" />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* And you */}
      <section className="page-section tm-you-section">
        <div className="section-heading">
          <h2>And you.</h2>
          <p>Every great platform is shaped by many hands. Yours too.</p>
        </div>

        <div className="tm-contrib-grid tm-you-card-outer">
          <div
            className="tm-you-card"
            style={{
              '--tm-color': '#1f7177',
              '--tm-gradient': 'linear-gradient(135deg, #1f7177 0%, #38bdf8 55%, #34d399 100%)',
            }}
          >
            <div className="tm-you-card__top" aria-hidden="true" />
            <TeamAvatar
              name={isAuthenticated && user ? userDisplayName : 'You'}
              photo={isAuthenticated ? user?.avatar_url : null}
              className="tm-you-card__avatar"
            />
            <div className="tm-you-card__body">
              <span className="tm-badge">
                {isAuthenticated ? (user?.role || 'Member') : 'Visitor'}
              </span>
              <strong className="tm-you-card__name">
                {isAuthenticated ? userDisplayName : 'You.'}
              </strong>
              {isAuthenticated && user?.institution && (
                <span className="tm-you-card__college">{user.institution}</span>
              )}
              <p className="tm-you-card__message">
                {isAuthenticated
                  ? `${userDisplayName.split(' ')[0]}, you're not just a user here — you're the reason this platform exists. Every resource you access, every session you show up for, is what makes Sharether worth building.`
                  : "We don't know your name yet. But every single feature on this platform was built with someone exactly like you in mind — curious, determined, and showing up."}
              </p>
              <p className="tm-you-thanks">
                {isAuthenticated && user
                  ? `Thank you, ${userDisplayName.split(' ')[0]}. Genuinely.`
                  : 'Thank you for being here. This place is yours too.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <hr className="tm-section-divider" />

      {/* Contributors — celebration stage */}
      <section className="page-section">
        <div className="section-heading" style={{ textAlign: 'center', alignItems: 'center' }}>
          <h2>Then our superheroes.</h2>
        </div>
        <CelebrationContributors contributors={team.donors || []} totalAmount={1888} />
        <div className="tm-superhero-cta">
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => navigate('/contribute?open=1')}
          >
            Become a superhero too
          </button>
          <p className="tm-superhero-cta__sub">Contribute to join them.</p>
        </div>
      </section>

      {/* Bio modal */}
      {selected && (
        <div
          className="tm-modal-backdrop"
          role="presentation"
          onClick={() => setSelected(null)}
        >
          <div
            className="tm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tm-modal-name"
            style={{ '--tm-color': selected.color, '--tm-gradient': selected.gradient }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="tm-modal__close"
              onClick={() => setSelected(null)}
              aria-label="Close"
            >
              <FiX />
            </button>

            <div className="tm-modal__header">
              <TeamAvatar name={selected.member.name} photo={selected.member.photo} className="tm-modal__avatar" />
              <div className="tm-modal__meta">
                <span className="tm-badge">{selected.member.role}</span>
                <h2 id="tm-modal-name" className="tm-modal__name">{selected.member.fullName || selected.member.name}</h2>
                {selected.member.aka && <p className="tm-modal__aka">&ldquo;{selected.member.aka}&rdquo;</p>}
              </div>
            </div>

            <div className="tm-modal__body">
              {(selected.member.bio || []).map((para, i) => <p key={i}>{para}</p>)}
              {(!selected.member.bio || selected.member.bio.length === 0) && (
                <p style={{ fontStyle: 'italic', color: 'var(--color-text-secondary, #94a3b8)' }}>No bio available yet.</p>
              )}
            </div>

            {(() => {
              const contact = selected.member.contact || {};
              const social = selected.member.social || {};
              const hasEmail = Boolean(contact.email);
              const hasPhone = Boolean(contact.phone);
              const hasPhone2 = Boolean(contact.phone2);
              const socialEntries = Object.entries(social).filter(([, url]) => Boolean(url));
              const hasContact = hasEmail || hasPhone || hasPhone2;
              const hasSocial = socialEntries.length > 0;
              if (!hasContact && !hasSocial) return null;
              return (
                <div className="tm-modal__footer">
                  {hasEmail && (
                    <a href={`mailto:${contact.email}`} className="tm-contact-chip">
                      <FiMail aria-hidden="true" /> {contact.email}
                    </a>
                  )}
                  {hasPhone && (
                    <a href={`tel:${contact.phone}`} className="tm-contact-chip">
                      <FiPhone aria-hidden="true" /> {contact.phone}
                    </a>
                  )}
                  {hasPhone2 && (
                    <a href={`tel:${contact.phone2}`} className="tm-contact-chip">
                      <FiPhone aria-hidden="true" /> {contact.phone2}
                    </a>
                  )}
                  {hasContact && hasSocial && <span className="tm-footer-divider" aria-hidden="true" />}
                  {socialEntries.map(([key, url]) => {
                    const Icon = SOCIAL_ICONS[key];
                    if (!Icon) return null;
                    const isWebsite = key === 'website';
                    return (
                      <a
                        key={key}
                        href={url}
                        className={isWebsite ? 'tm-contact-chip' : 'tm-social-chip'}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={key}
                      >
                        <Icon aria-hidden="true" />
                        {isWebsite ? ` ${url}` : null}
                      </a>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

    </div>
  );
}
