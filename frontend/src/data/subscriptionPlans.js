/** Canonical contribution tiers. Backend plan names are preserved as `name`.
 *  Display names (Pass / Credit / Distinction) come from contributionPlans.js. */
export const PLANS = [
  {
    name: 'Basic Student',
    price: 0,
    features: [
      'Access to one course of your choice',
      'Download files (3/day)',
      'View files on-site',
      'Practice tests for one course',
    ],
  },
  {
    name: 'Serious Student',
    price: 5,
    features: [
      'Access to 4 courses',
      'Download files (15/day)',
      'View files on-site',
      'Practice tests for core courses',
      'Contribute files and edutainment',
      'XP rewards for your contributions',
    ],
  },
  {
    name: 'Master Student',
    price: 10,
    features: [
      'Access to all courses',
      'Unlimited daily downloads',
      'View files on-site',
      'Practice tests for all courses',
      'Contribute all content types',
      'Early access to new features',
      'Bonus XP for every contribution',
    ],
  },
];
