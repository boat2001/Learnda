const ACADEMIC_CATALOG_VERSION = '2026-05-20-colleges-v2';

const UNIVERSITY_DEFINITIONS = Object.freeze([
  { code: 'UCC', name: 'University of Cape Coast' },
  { code: 'UEW', name: 'University of Education, Winneba' },
  { code: 'UG', name: 'University of Ghana' },
  { code: 'KNUST', name: 'Kwame Nkrumah University of Science and Technology' },
  { code: 'UDS', name: 'University for Development Studies' },
  {
    code: 'AAMUSTED',
    name: 'Akenten Appiah-Menka University of Skills Training and Entrepreneurial Development'
  }
]);

const makeCollege = ({
  name,
  shortName = '',
  collegeCode = '',
  affiliateUniversityCode,
  ownership = 'public',
  location = '',
  region = '',
  programmeCategories = [],
  aliases = [],
  notes = []
}) => ({
  name,
  short_name: shortName || name,
  college_code: collegeCode || null,
  affiliate_university_code: affiliateUniversityCode,
  ownership,
  location,
  region,
  programme_categories: programmeCategories,
  aliases,
  notes
});

const ACADEMIC_CATALOG_COLLEGES = Object.freeze([
  makeCollege({
    name: 'Holy Child College of Education',
    shortName: 'Holy Child',
    collegeCode: 'HCCE',
    affiliateUniversityCode: 'UCC',
    location: 'Takoradi',
    programmeCategories: ['Early Childhood Education', 'Primary Education', 'JHS Education'],
    aliases: ['Holy child']
  }),
  makeCollege({
    name: 'Kibi College of Education',
    shortName: 'Kibi',
    collegeCode: 'KPCE',
    affiliateUniversityCode: 'UCC',
    location: 'Kibi',
    programmeCategories: ['Early Childhood Education', 'Primary Education', 'JHS Education']
  }),
  makeCollege({
    name: 'Berekum College of Education',
    shortName: 'Berekum',
    collegeCode: 'BECE',
    affiliateUniversityCode: 'UCC',
    location: 'Berekum',
    programmeCategories: ['Early Childhood Education', 'Primary Education', 'JHS Education']
  }),
  makeCollege({
    name: 'Abetifi Presbyterian College of Education',
    shortName: 'Abetifi Presbyterian',
    collegeCode: 'APCE',
    affiliateUniversityCode: 'UCC',
    location: 'Abetifi',
    programmeCategories: ['Early Childhood Education', 'Primary Education', 'JHS Education'],
    aliases: ['Abetifi College of Education']
  }),
  makeCollege({
    name: "St. Monica's College of Education",
    shortName: "St. Monica's",
    collegeCode: 'SMCE',
    affiliateUniversityCode: 'UCC',
    location: 'Mampong',
    programmeCategories: ['Early Childhood Education', 'Primary Education', 'JHS Education'],
    aliases: ["St Monica's"]
  }),
  makeCollege({
    name: 'Atebubu College of Education',
    shortName: 'Atebubu',
    collegeCode: 'ATCE',
    affiliateUniversityCode: 'UCC',
    location: 'Atebubu',
    programmeCategories: ['Early Childhood Education', 'Primary Education', 'JHS Education']
  }),
  makeCollege({
    name: 'OLA College of Education, Cape Coast',
    shortName: 'OLA',
    collegeCode: 'OLCE',
    affiliateUniversityCode: 'UCC',
    location: 'Cape Coast',
    programmeCategories: ['Early Childhood Education', 'Primary Education', 'JHS Education']
  }),
  makeCollege({
    name: 'St. Francis College of Education',
    shortName: 'St. Francis',
    collegeCode: 'SFCE',
    affiliateUniversityCode: 'UCC',
    location: 'Hohoe',
    programmeCategories: ['Primary Education', 'JHS Education']
  }),
  makeCollege({
    name: 'Jasikan College of Education',
    shortName: 'Jasikan',
    collegeCode: 'JACE',
    affiliateUniversityCode: 'UCC',
    location: 'Jasikan',
    programmeCategories: ['Early Childhood Education', 'Primary Education', 'JHS Education']
  }),
  makeCollege({
    name: 'Foso College of Education',
    shortName: 'Foso',
    collegeCode: 'FSCE',
    affiliateUniversityCode: 'UCC',
    location: 'Assin Foso',
    programmeCategories: ['Primary Education', 'JHS Education']
  }),
  makeCollege({
    name: "St. Teresa's College of Education",
    shortName: "St. Teresa's",
    collegeCode: 'STCE',
    affiliateUniversityCode: 'UCC',
    location: 'Hohoe',
    programmeCategories: ['Early Childhood Education', 'Primary Education', 'JHS Education']
  }),
  makeCollege({
    name: 'St. Ambrose College of Education',
    shortName: 'St. Ambrose',
    collegeCode: 'SACE',
    affiliateUniversityCode: 'UCC',
    location: 'Dormaa-Akwamu',
    programmeCategories: ['Primary Education', 'JHS Education']
  }),
  makeCollege({
    name: 'UCC College of Education Studies',
    shortName: 'UCC Education Studies',
    affiliateUniversityCode: 'UCC',
    location: 'Cape Coast',
    programmeCategories: ['Early Childhood Education', 'Primary Education', 'JHS Education'],
    aliases: ['College of Education Studies', 'UCC College of Education Studies']
  }),
  makeCollege({
    name: 'Offinso College of Education',
    shortName: 'Offinso',
    collegeCode: 'OFCE',
    affiliateUniversityCode: 'UCC',
    location: 'Offinso',
    programmeCategories: ['Primary Education', 'JHS Education']
  }),
  makeCollege({
    name: 'SDA College of Education, Agona',
    shortName: 'SDA Agona',
    affiliateUniversityCode: 'UCC',
    location: 'Agona',
    programmeCategories: ['Early Childhood Education', 'Primary Education', 'JHS Education'],
    aliases: ['SDA']
  }),
  makeCollege({
    name: 'Nsawkaw College of Education',
    shortName: 'Nsawkaw',
    affiliateUniversityCode: 'UCC',
    ownership: 'private',
    location: 'Nsawkaw',
    region: 'Bono',
    programmeCategories: ['Primary Education'],
    aliases: ['Nsawkaw (private)']
  }),
  makeCollege({
    name: 'Christ the Teacher College of Education',
    shortName: 'Christ the Teacher',
    affiliateUniversityCode: 'UCC',
    ownership: 'private',
    location: 'Kumasi',
    region: 'Ashanti',
    programmeCategories: ['Primary Education', 'JHS Education'],
    aliases: ['Christ the teacher', 'Christ the teacher (private)']
  }),
  makeCollege({
    name: 'Holy Spirit College of Education',
    shortName: 'Holy Spirit',
    affiliateUniversityCode: 'UCC',
    ownership: 'private',
    location: 'Ho',
    region: 'Volta',
    programmeCategories: ['Early Childhood Education', 'Primary Education', 'JHS Education'],
    aliases: ['Holy spirit', 'Holy spirit (private)']
  }),
  makeCollege({
    name: 'St. Louis College of Education',
    shortName: 'St. Louis',
    affiliateUniversityCode: 'UEW',
    location: 'Kumasi',
    programmeCategories: ['Early Childhood Education', 'Primary Education', 'JHS Education'],
    aliases: ['st louis']
  }),
  makeCollege({
    name: "Presbyterian Women's College of Education, Aburi",
    shortName: "Presbyterian Women's, Aburi",
    affiliateUniversityCode: 'UEW',
    location: 'Aburi',
    programmeCategories: ['Early Childhood Education', 'Primary Education', 'JHS Education'],
    aliases: ['presbytarian women', 'presbyterian women']
  }),
  makeCollege({
    name: 'SDA College of Education, Koforidua',
    shortName: 'SDA Koforidua',
    affiliateUniversityCode: 'UEW',
    location: 'Koforidua',
    programmeCategories: ['Early Childhood Education', 'Primary Education', 'JHS Education'],
    aliases: ['sda']
  }),
  makeCollege({
    name: "Agogo Presbyterian Women's College of Education",
    shortName: "Presbyterian Women's, Agogo",
    affiliateUniversityCode: 'UEW',
    location: 'Agogo',
    programmeCategories: ['Early Childhood Education', 'Primary Education', 'JHS Education'],
    aliases: ['presbytarian women', 'presbyterian women']
  }),
  makeCollege({
    name: 'Methodist College of Education',
    shortName: 'Methodist',
    affiliateUniversityCode: 'UEW',
    location: 'Oda',
    programmeCategories: ['Primary Education', 'JHS Education']
  }),
  makeCollege({
    name: 'Bia Lamplighter College of Education',
    shortName: 'Bia Lamplighter',
    affiliateUniversityCode: 'UEW',
    location: 'Bia',
    programmeCategories: ['Early Childhood Education', 'Primary Education', 'JHS Education'],
    aliases: ['bia-lamplighter']
  }),
  makeCollege({
    name: 'Presbyterian College of Education, Akropong',
    shortName: 'Presbyterian Akropong',
    affiliateUniversityCode: 'UEW',
    location: 'Akropong-Akwapim',
    programmeCategories: ['Primary Education', 'JHS Education'],
    aliases: ['presbytarian', 'presbyterian']
  }),
  makeCollege({
    name: 'Jackson College of Education',
    shortName: 'Jackson',
    affiliateUniversityCode: 'UEW',
    ownership: 'private',
    location: 'Kumasi',
    programmeCategories: [],
    aliases: ['Jackson', 'Jackson (private)']
  }),
  makeCollege({
    name: 'Accra College of Education',
    shortName: 'Accra',
    affiliateUniversityCode: 'UG',
    location: 'Accra',
    programmeCategories: ['Early Childhood Education', 'Primary Education', 'JHS Education']
  }),
  makeCollege({
    name: 'Peki College of Education',
    shortName: 'Peki',
    affiliateUniversityCode: 'UG',
    location: 'Peki',
    programmeCategories: ['Early Childhood Education', 'Primary Education', 'JHS Education']
  }),
  makeCollege({
    name: 'Mount Mary College of Education',
    shortName: 'Mount Mary',
    affiliateUniversityCode: 'UG',
    location: 'Somanya',
    programmeCategories: ['Primary Education', 'JHS Education']
  }),
  makeCollege({
    name: 'Enchi College of Education',
    shortName: 'Enchi',
    affiliateUniversityCode: 'UG',
    location: 'Enchi',
    programmeCategories: ['Early Childhood Education', 'Primary Education', 'JHS Education']
  }),
  makeCollege({
    name: 'E.P. College of Education, Amedzofe',
    shortName: 'EP Amedzofe',
    affiliateUniversityCode: 'UG',
    location: 'Amedzofe',
    programmeCategories: ['Early Childhood Education', 'Primary Education', 'JHS Education'],
    aliases: ['ep']
  }),
  makeCollege({
    name: 'Gbewaa College of Education',
    shortName: 'Gbewaa',
    affiliateUniversityCode: 'UG',
    location: 'Pusiga',
    programmeCategories: ['Primary Education', 'JHS Education']
  }),
  makeCollege({
    name: 'Akrokerri College of Education',
    shortName: 'Akrokerri',
    affiliateUniversityCode: 'KNUST',
    location: 'Akrokerri',
    programmeCategories: ['Early Childhood Education', 'Primary Education', 'JHS Education']
  }),
  makeCollege({
    name: 'Wesley College of Education',
    shortName: 'Wesley',
    affiliateUniversityCode: 'KNUST',
    location: 'Kumasi',
    programmeCategories: ['Primary Education', 'JHS Education']
  }),
  makeCollege({
    name: "St. Joseph's College of Education",
    shortName: "St. Joseph's",
    affiliateUniversityCode: 'KNUST',
    location: 'Bechem',
    programmeCategories: ['Primary Education', 'JHS Education'],
    aliases: ['st joseph']
  }),
  makeCollege({
    name: 'Tamale College of Education',
    shortName: 'Tamale',
    affiliateUniversityCode: 'KNUST',
    location: 'Tamale',
    programmeCategories: ['Primary Education', 'JHS Education']
  }),
  makeCollege({
    name: 'E.P. College of Education, Bimbilla',
    shortName: 'EP Bimbilla',
    affiliateUniversityCode: 'KNUST',
    location: 'Bimbilla',
    programmeCategories: ['Early Childhood Education', 'Primary Education', 'JHS Education'],
    aliases: ['ep']
  }),
  makeCollege({
    name: 'Tumu College of Education',
    shortName: 'Tumu',
    affiliateUniversityCode: 'UDS',
    location: 'Tumu',
    programmeCategories: ['Early Childhood Education', 'Primary Education']
  }),
  makeCollege({
    name: 'McCoy College of Education',
    shortName: 'McCoy',
    affiliateUniversityCode: 'UDS',
    location: 'Nadowli',
    programmeCategories: ['Primary Education', 'JHS Education'],
    aliases: ['mccoy']
  }),
  makeCollege({
    name: 'Dambai College of Education',
    shortName: 'Dambai',
    affiliateUniversityCode: 'UDS',
    location: 'Dambai',
    programmeCategories: ['Early Childhood Education', 'Primary Education', 'JHS Education']
  }),
  makeCollege({
    name: 'Gambaga College of Education',
    shortName: 'Gambaga',
    affiliateUniversityCode: 'UDS',
    location: 'Gambaga',
    programmeCategories: ['Early Childhood Education', 'Primary Education', 'JHS Education']
  }),
  makeCollege({
    name: 'St. Vincent College of Education',
    shortName: 'St. Vincent',
    affiliateUniversityCode: 'UDS',
    location: 'Yendi',
    programmeCategories: ['Early Childhood Education', 'Primary Education', 'JHS Education']
  }),
  makeCollege({
    name: 'Al-Faruq College of Education',
    shortName: 'Al-Faruq',
    affiliateUniversityCode: 'UDS',
    location: 'Wenchi',
    programmeCategories: ['Early Childhood Education', 'Primary Education', 'JHS Education'],
    notes: ['Arabic option available']
  }),
  makeCollege({
    name: 'College of Education and Entrepreneurial Development',
    shortName: 'AAMUSTED CEED',
    affiliateUniversityCode: 'AAMUSTED',
    location: 'Mampong',
    programmeCategories: ['Primary Education', 'JHS Education'],
    aliases: ['college of education and entrepreneurial development (aamusted)']
  }),
  makeCollege({
    name: 'Ada College of Education',
    shortName: 'Ada',
    affiliateUniversityCode: 'AAMUSTED',
    location: 'Ada',
    programmeCategories: ['Primary Education', 'JHS Education']
  }),
  makeCollege({
    name: "St. John Bosco's College of Education",
    shortName: 'St. John Bosco',
    affiliateUniversityCode: 'AAMUSTED',
    location: 'Navrongo',
    programmeCategories: ['Early Childhood Education', 'Primary Education', 'JHS Education'],
    aliases: ['st john bosco']
  }),
  makeCollege({
    name: 'Wiawso College of Education',
    shortName: 'Wiawso',
    affiliateUniversityCode: 'AAMUSTED',
    location: 'Wiawso',
    programmeCategories: ['Early Childhood Education', 'Primary Education', 'JHS Education']
  }),
  makeCollege({
    name: 'Bagabaga College of Education',
    shortName: 'Bagabaga',
    affiliateUniversityCode: 'AAMUSTED',
    location: 'Tamale',
    programmeCategories: ['Early Childhood Education', 'Primary Education', 'JHS Education']
  }),
  makeCollege({
    name: 'Mampong Technical College of Education',
    shortName: 'Mampong Technical',
    affiliateUniversityCode: 'AAMUSTED',
    location: 'Mampong',
    programmeCategories: ['JHS Education'],
    notes: ['Technical focus']
  }),
  makeCollege({
    name: 'Komenda College of Education',
    shortName: 'Komenda',
    affiliateUniversityCode: 'AAMUSTED',
    location: 'Komenda',
    programmeCategories: ['Early Childhood Education', 'Primary Education', 'JHS Education']
  }),
  makeCollege({
    name: 'Akatsi College of Education',
    shortName: 'Akatsi',
    affiliateUniversityCode: 'AAMUSTED',
    location: 'Akatsi',
    programmeCategories: ['Primary Education', 'JHS Education']
  }),
  makeCollege({
    name: 'N.J. Ahmadiyya College of Education',
    shortName: 'N.J. Ahmadiyya',
    affiliateUniversityCode: 'AAMUSTED',
    location: 'Wa',
    programmeCategories: ['Early Childhood Education', 'JHS Education'],
    aliases: ['nj ahamadiyya', 'n.j. ahamadiyya']
  })
]);

module.exports = {
  ACADEMIC_CATALOG_VERSION,
  UNIVERSITY_DEFINITIONS,
  ACADEMIC_CATALOG_COLLEGES
};
