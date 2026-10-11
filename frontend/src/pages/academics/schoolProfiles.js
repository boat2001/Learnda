export const SCHOOL_CATEGORIES = [
  { key: 'kg-primary', label: 'KG & Primary', description: 'Early years and primary learning.' },
  { key: 'jhs', label: 'JHS', description: 'Junior High and international lower secondary.' },
  { key: 'shs', label: 'SHS', description: 'Senior High and international upper secondary.' },
];

// Public directory profiles, not platform partnerships. Add verified sources
// alongside new school information; use category keys from SCHOOL_CATEGORIES.
export const SCHOOL_PROFILES = [
  {
    slug: 'morning-star-basic-school', name: 'Morning Star Basic School', initials: 'MS',
    location: 'Cantonments, Accra', categories: ['kg-primary', 'jhs'],
    levels: 'Nursery, Kindergarten, Primary & Junior High',
    description: 'A private basic school on Cantonments Road in Accra, offering learning from nursery through Junior High.',
    highlights: [{ title: 'School setting', body: 'The basic school is in Accra. The Morning Star group also has a separate high-school campus in Dodowa.' }],
    sources: [{ label: 'School admissions', href: 'https://mostarschool.edu.gh/admission/' }, { label: 'School locations', href: 'https://mostarschool.edu.gh/contact-us/' }],
  },
  {
    slug: 'university-basic-school-legon', name: 'University Basic School, Legon', initials: 'UB',
    location: 'Legon, Accra', categories: ['kg-primary', 'jhs'], levels: 'Kindergarten, Primary & Junior High',
    description: 'The University of Ghana basic school in Legon has Kindergarten, Primary, and Junior High departments.',
    highlights: [{ title: 'School background', body: 'Established as the University Primary School in 1955, with a Junior Secondary department added in 1987.' }],
    sources: [{ label: 'University of Ghana school information', href: 'https://www.ug.edu.gh/hrodd/vacancy/vacancy-announcement-head-university-basic-school' }],
  },
  {
    slug: 'jack-and-jill-school', name: 'Jack & Jill School', initials: 'JJ',
    location: 'Roman Ridge, Accra', categories: ['kg-primary', 'jhs'], levels: 'Preschool, Kindergarten, Primary & Junior High',
    description: 'A school in Roman Ridge offering preschool, primary, and Junior High learning for children aged 2 to 14.',
    highlights: [{ title: 'Curriculum', body: 'The school states that it uses the GES-prescribed curriculum.' }],
    sources: [{ label: 'School admissions & location', href: 'https://jnjschool.org/admissions' }, { label: 'School curriculum', href: 'https://jnjschool.org/curriculum/' }],
  },
  {
    slug: 'ghana-international-school', name: 'Ghana International School', initials: 'GIS',
    location: 'Cantonments, Accra', categories: ['kg-primary', 'jhs', 'shs'], levels: 'Infant, Junior, Lower Secondary & Upper Secondary',
    description: 'A private, coeducational international school in Cantonments, with early-years, primary, and secondary pathways.',
    highlights: [{ title: 'Curriculum', body: 'The school publishes Cambridge Early Years, Primary, and Secondary pathways leading to IGCSE and A Level, alongside a Pearson BTEC pathway.' }],
    sources: [{ label: 'School overview & curriculum', href: 'https://gis.edu.gh/' }],
  },
  {
    slug: 'achimota-school', name: 'Achimota School', initials: 'AS',
    location: 'Achimota, Accra', categories: ['shs'], levels: 'SHS 1–SHS 3',
    description: 'A public coeducational senior high school in Accra, offering academic programmes alongside practical skills and character education.',
    highlights: [{ title: 'Programmes', body: 'Published programmes include General Science, General Arts, Agricultural Science, Visual Arts, and Home Economics.' }],
    sources: [{ label: 'School overview', href: 'https://www.achimota.edu.gh/' }, { label: 'School academics', href: 'https://www.achimota.edu.gh/academics' }],
  },
  {
    slug: 'prempeh-college', name: 'Prempeh College', initials: 'PC',
    location: 'Kumasi, Ashanti Region', categories: ['shs'], levels: 'Senior High',
    description: 'A senior high school in Kumasi, with published academic programme information and an active robotics tradition.',
    highlights: [{ title: 'Programmes', body: 'The school lists General Science, General Arts, Business, and Visual Arts among its programme areas.' }],
    sources: [{ label: 'School overview & programmes', href: 'https://prempehcollege.edu.gh/' }],
  },
];

export const SCHOOL_PROFILE_REVIEW_DATE = '10 October 2026';
