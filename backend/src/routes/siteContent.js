const express = require('express');
const fs = require('fs');
const path = require('path');
const { authenticate, checkRole } = require('../middleware/auth');
const { requireAdminPermission, auditAdminAction } = require('../utils/adminAccess');

const router = express.Router();
const DATA_FILE = path.join(__dirname, '../data/site_content.json');

const DEFAULT_CONTENT = {
  team: {
    core_team: [
      {
        id: 'boateng',
        name: 'Kwabena Boateng Adjei',
        aka: 'Boatenberg',
        role: 'Founder & CEO',
        color: '#38bdf8',
        gradient: 'linear-gradient(135deg, #38bdf8 0%, #34d399 55%, #f97316 100%)',
        photo: '/team/members/boateng.jpg',
        contact: { email: 'adjekwaboat@gmail.com', phone: '' },
        social: { x: '', instagram: '', linkedin: '', whatsapp: 'https://wa.me/233591661816', facebook: '', youtube: '', tiktok: '', telegram: 'https://t.me/Boatenberg', github: '' },
        bio: [
          "I'm a self-taught software engineer with a passion for technology and innovation. With an ever-increasing knowledge spanning PHP, HTML, CSS, JavaScript, Reactjs, PostgreSQL and more — my goal is always to become better at making things. My vision: to build technologies that make the world an easier and more exciting place to live.",
          'Venturing into education at Fosco deepened my already strong interest in learning and the impartation of knowledge. Believing that everyone can learn led me to build this platform to help people learn in a genuinely interesting way. Sharether exists to give every student an equal opportunity to grow.',
          'I also served as the SRC Academic Coordinator for Fosco College of Education in 2023/24.',
          'I am an educator by training and an engineer by practice.',
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
        social: { x: '', instagram: '', linkedin: '', whatsapp: '', facebook: '', youtube: '', tiktok: '', telegram: '', github: '' },
        bio: [
          'A past student of the Bachelor of Education in Social Studies program at Foso College of Education (FOSCO) in Assin Foso, located in the Central Region of Ghana. His educational journey began at Anyinam Kotoku D/A Junior High School in the Eastern Region (Birim South District), where he completed his junior high education and served as an assistant school prefect during the 2016/2017 academic year.',
          'After junior high school, he attended Achiase Senior High School (ACHISEC) in Akim Achiase, also in the Eastern Region (Birim South District). During the 2020/2021 academic year, he held the position of class representative for the entire General Arts 3 cohort of 244 students, and served as president of the ATSAG Association, facilitating the college application process for junior students. He continued his education at FOSCO with an aspiration to become a leading information disseminator among the 49 public and 18 private colleges in Ghana, and has since taken on the role of Files Editor for Sharether.com.',
        ],
      },
      {
        id: 'isaac',
        name: 'Isaac Appiah',
        aka: 'Former SRC President, Fosco',
        role: 'Executive Member',
        color: '#f97316',
        gradient: 'linear-gradient(45deg, #34d399 0%, #f97316 50%, #38bdf8 100%)',
        photo: '/team/members/isaac.jpg',
        contact: { email: '', phone: '' },
        social: { x: '', instagram: '', linkedin: '', whatsapp: '', facebook: '', youtube: '', tiktok: '', telegram: '', github: '' },
        bio: [
          'Leader | Agent of Change | 21st Century Facilitator',
          'I lead with purpose, serve with responsibility, and build for what\'s next. I turn voices into action — shaping policies, programs, and opportunities that create real impact on the ground.',
          'I\'m an agent of change because I believe systems should work for people. I challenge outdated structures, create space for new ideas, and follow through until solutions reach the people who need them. My leadership is rooted in listening first, acting with clarity, and staying accountable for results.',
          'As a 21st century facilitator, I meet education and leadership where they\'re headed. Through collaboration, technology, and innovation, I build spaces where ideas are shared, skills are built, and people are equipped to lead in a fast-changing world.',
          'In all, I learn, unlearn and relearn.',
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
        contact: { email: '', phone: '' },
        social: { x: '', instagram: '', linkedin: '', whatsapp: '', facebook: '', youtube: '', tiktok: '', telegram: '', github: '' },
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
        contact: { email: '', phone: '' },
        social: { x: '', instagram: '', linkedin: '', whatsapp: '', facebook: '', youtube: '', tiktok: '', telegram: '', github: '', website: 'https://www.jmonlinepublication.com' },
        bio: [
          'I am Mubarack Jamiu (AKA King Muba), a dynamic facilitator, blogger, graphic designer, Android app developer, web developer, and animator with a strong passion for technology, creativity, and digital innovation.',
          'I am dedicated to using my skills to educate, inspire, and empower young people through technology and digital media.',
          'With experience in Android app development, website creation, animation, graphic design, and content blogging, I combine creativity and technical expertise to build engaging digital solutions and impactful online content.',
          'I am committed to helping businesses, brands, and individuals grow their digital presence through modern technology and innovative ideas.',
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
        contact: { email: '', phone: '' },
        social: { x: '', instagram: '', linkedin: '', whatsapp: '', facebook: '', youtube: '', tiktok: '', telegram: '', github: '' },
        bio: [
          'Eric K. Baah is a dedicated Ghanaian Creative Arts teacher with experience teaching learners at the Basic School level. He had his training at Foso College of Education. He is passionate about nurturing creativity, practical skills, and cultural appreciation through arts education.',
          'With a strong interest in innovative teaching methods and the integration of local materials in art instruction, Eric K. Baah focuses on making learning practical, engaging, and relevant to everyday life. His teaching approach encourages critical thinking, creativity, teamwork, and self-expression among students.',
          'In addition to classroom teaching, Eric K. Baah is involved in educational research and lesson development aimed at improving the teaching and learning of Creative Arts in Ghanaian basic schools. He is committed to promoting quality education and helping students discover and develop their artistic potential.',
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
        contact: { email: '', phone: '' },
        social: { x: '', instagram: '', linkedin: '', whatsapp: '', facebook: '', youtube: '', tiktok: '', telegram: '', github: '' },
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
        contact: { email: '', phone: '' },
        social: { x: '', instagram: '', linkedin: '', whatsapp: '', facebook: '', youtube: '', tiktok: '', telegram: '', github: '' },
        bio: [
          'A Level 400 Mathematics and ICT student at Foso College of Education with a keen interest in student support and academic resource accessibility. As a contributor to this platform for UCC affiliated Colleges of Education, he organizes PDF past questions and other learning materials to help students easily access resources for their academic work.',
          'Through this role, he aims to help address the challenge many students face in finding reliable learning materials and is grateful for the opportunity to serve and contribute to student success.',
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
        contact: { email: '', phone: '' },
        social: { x: '', instagram: '', linkedin: '', whatsapp: '', facebook: '', youtube: '', tiktok: '', telegram: '', github: '' },
        bio: [
          'My passion for becoming a programmer ignited during my early teenage years when I first encountered the magic of coding at the Senior High School level. I was enrolled in a General Science program and had ICT as one of my elective subjects, which replaced Biology. ICT was not only about theory but also involved intensive practical work.',
          "At first, I did not know if I was on the right path because it seemed different from my initial dream of becoming a medical doctor to save lives and give people a second chance to pursue their goals. However, everything changed when I started studying ICT and became increasingly interested, especially when we covered programming.",
          'The initial spark came from simple curiosity about creating my own program using Quick Beginner All-purpose Symbolic Instruction Code (Q-BASIC) during one of our ICT laboratory lessons. In the same week, while practicing, I also helped a friend debug an error by modifying a line of code in a basic HTML document.',
          'After completing Senior High School, my results came in, but I did not get the chance to apply and move to a tertiary institution that year because I delayed taking the necessary form. The following year, I applied to a teacher training program and gained admission to Foso College of Education.',
          'It was there that I met the person who made this platform possible for me to express my programming journey: Honorable Adjei Boateng, the founder of Sharether. He started Sharether on his own and later introduced the site to me. I felt privileged and did not hesitate to seize the opportunity he offered me to join his team.',
          'Joining the Sharether team has enriched my learning experience immensely and taught me the importance of teamwork, communication, and sharing knowledge.',
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
          'Gideon Ofori is a graduate of Foso College of Education, where he studied Science and Mathematics and completed his program in the 2025/2026 academic year.',
          'As an Executive Member for Sharether, he is committed to promoting a platform that supports students in their academic journey. Having experienced the challenges and rewards of college education firsthand, he believes Sharether provides a smart and engaging way for students to learn, collaborate, and excel. His goal is to help current students make the most out of the platform and achieve outstanding academic success.',
          'As a former college student, his vision with Sharether is to help promote it as a platform that makes learning engaging and helps students learn the smart way, enabling both individual and group learners to achieve a common goal: passing and excelling at the end of each semester.',
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
      { id: 'bernard',  name: 'Bernard', role: 'Files Contributor', aka: 'Fosco Academic Coord. (24/25)', color: '#f97316', gradient: 'linear-gradient(135deg, #f97316 0%, #34d399 100%)', photo: '/team/support/bernard.jpg', contact: {}, bio: [] },
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
  },
  updates: [
    { id: 'upd-1', title: 'PLS folders get smarter', date: 'Nov 14, 2025', tag: 'Product', summary: 'Organize your files with quick labels and recent activity.' },
    { id: 'upd-2', title: 'New exam sprint mode', date: 'Nov 07, 2025', tag: 'Practice', summary: 'Timed sessions now save your progress and reset weekly.' },
    { id: 'upd-3', title: 'Contributor payouts', date: 'Oct 29, 2025', tag: 'Creators', summary: 'Track revenue shares, withdrawals, and earnings history.' },
    { id: 'upd-4', title: 'Community mentorship rooms', date: 'Oct 18, 2025', tag: 'Community', summary: 'Join mentor-led rooms for weekly review sessions.' },
  ],
};

function loadContent() {
  const mergeById = (defaultItems = [], savedItems = []) => {
    const defaultMap = new Map(defaultItems.map((item) => [String(item?.id || ''), item]));
    const savedMap = new Map(savedItems.map((item) => [String(item?.id || ''), item]));
    const orderedIds = [
      ...defaultItems.map((item) => String(item?.id || '')),
      ...savedItems
        .map((item) => String(item?.id || ''))
        .filter((id) => id && !defaultMap.has(id)),
    ];

    return orderedIds
      .filter(Boolean)
      .map((id) => {
        const base = defaultMap.get(id) || {};
        const override = savedMap.get(id) || {};
        return {
          ...base,
          ...override,
          contact: { ...(base.contact || {}), ...(override.contact || {}) },
          social: { ...(base.social || {}), ...(override.social || {}) },
          bio: Array.isArray(override.bio)
            ? override.bio
            : (Array.isArray(base.bio) ? base.bio : []),
        };
      });
  };

  const mergeTeamWithDefaults = (savedTeam = {}) => {
    const defaultTeam = DEFAULT_CONTENT.team || {};
    return {
      ...defaultTeam,
      ...savedTeam,
      core_team: mergeById(defaultTeam.core_team || [], savedTeam.core_team || []),
      content_support: mergeById(defaultTeam.content_support || [], savedTeam.content_support || []),
      notable_mentions: mergeById(defaultTeam.notable_mentions || [], savedTeam.notable_mentions || []),
      donors: mergeById(defaultTeam.donors || [], savedTeam.donors || []),
    };
  };

  try {
    if (!fs.existsSync(DATA_FILE)) return DEFAULT_CONTENT;
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return {
      team: mergeTeamWithDefaults(parsed.team || {}),
      updates: Array.isArray(parsed.updates) ? parsed.updates : DEFAULT_CONTENT.updates,
    };
  } catch {
    return DEFAULT_CONTENT;
  }
}

function saveContent(content) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(content, null, 2));
}

router.get('/team', (_req, res) => res.json({ success: true, team: loadContent().team }));
router.get('/updates', (_req, res) => res.json({ success: true, updates: loadContent().updates }));

router.get('/admin', authenticate, checkRole(['admin']), requireAdminPermission('publishing'), (_req, res) => {
  res.json({ success: true, content: loadContent() });
});

router.put('/admin/:key', authenticate, checkRole(['admin']), requireAdminPermission('publishing'), auditAdminAction('update_site_content', 'publishing'), (req, res) => {
  const { key } = req.params;
  if (!['team', 'updates'].includes(key)) {
    return res.status(400).json({ success: false, error: 'Unsupported site content key.' });
  }
  const content = loadContent();
  content[key] = req.body?.value;
  saveContent(content);
  res.json({ success: true, value: content[key] });
});

module.exports = router;
