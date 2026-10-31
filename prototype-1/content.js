/* ==================================================================
   KinderGuide Ottawa: all the text content in one place.
   Facts come from the sources listed in SOURCES; edit text here,
   not in app.js.
   ================================================================== */
const SOURCES = {
  data: { label: 'City of Ottawa Open Data: Licensed Child Care Providers', url: 'https://open.ottawa.ca/documents/388a593a328b4f548bf97b129fb198e0/about' },
  questions: { label: 'Government of Ontario: Questions to ask a child care provider', url: 'https://www.ontario.ca/page/questions-ask-child-care-provider' },
  ratios: { label: 'Government of Ontario: Child care centre licensing manual, ratios and group size', url: 'https://www.ontario.ca/document/child-care-centre-licensing-manual/part-3-ratios-and-group-size' },
  licensing: { label: 'Government of Ontario: Find licensed child care (licensing reports)', url: 'https://www.earlyyears.edu.gov.on.ca/LCCWWeb/childcare/search.xhtml' },
  unlicensed: { label: 'Government of Ontario: Unlicensed caregiver safety record search', url: 'https://www.earlyyears.edu.gov.on.ca/UnlicencedCCRegistryWeb/public/nonComplianceSearch.xhtml' },
  registry: { label: 'City of Ottawa: Child Care Registry and Waitlist', url: 'https://ottawa.ca/en/node/1006243' },
  findPay: { label: 'Government of Ontario: Find and pay for child care', url: 'https://www.ontario.ca/children-and-youth/find-and-pay-child-care' },
  cap: { label: 'The Canadian Press: Affordable child-care program extended in Ontario, but not to $10 a day (Sept 29, 2026)', url: 'https://www.cp24.com/politics/queens-park/2026/09/29/affordable-child-care-program-extended-in-ontario-but-not-to-10-a-day/' },
  cwelcc: { label: 'City of Ottawa: National child care system ($10-a-day program)', url: 'https://ottawa.ca/en/family-and-social-services/childrens-services/national-child-care-system' },
  subsidy: { label: 'City of Ottawa: Get help with your child care costs (subsidy and calculator)', url: 'https://ottawa.ca/en/family-and-social-services/childrens-services/get-help-your-child-care-costs' },
  waitGuide: { label: 'Military Family Services: Navigating child care in Ottawa (2026 FAQ)', url: 'https://cfmws.ca/CFMWS/media/NationalCapitalRegion/documents/MFS/FAQ-Navigating-childcare-in-Ottawa-and-Quebec-2026.pdf' },
  earlyon: { label: 'City of Ottawa: EarlyON Child and Family Centres', url: 'https://ottawa.ca/en/family-and-social-services/childrens-services/earlyon' },
  specialNeeds: { label: 'City of Ottawa: Special needs child care (inclusion support)', url: 'https://ottawa.ca/en/family-and-social-services/childrens-services/special-needs-child-care' },
  indigenous: { label: 'City of Ottawa: Indigenous-led licensed child care and EarlyON services', url: 'https://ottawa.ca/en/family-and-social-services/childrens-services/indigenous-led-licensed-child-care-and-earlyon-services' },
  plan: { label: 'City of Ottawa: Child Care and Early Years Service System Plan 2025–2029', url: 'https://engage.ottawa.ca/childcarestrategy' },
  ocdsbFees: { label: 'OCDSB: Extended day program fees', url: 'https://www.ocdsb.ca/download/482547' },
};

// Age groups used by the licensed data (Ontario age categories)
const AGES = [
  { key: 'infant', who: 'babies under 18 months', label: 'Baby', long: 'Infant (under 18 months)', ratio: '3 staff for every 10 children', group: null },
  { key: 'toddler', who: 'toddlers (18 to 30 months)', label: 'Toddler', long: 'Toddler (18 to 30 months)', ratio: '1 staff for every 5 children', group: 15 },
  { key: 'preschool', who: 'preschoolers', label: 'Preschool', long: 'Preschool (30 months to kindergarten age)', ratio: '1 staff for every 8 children', group: 24 },
  { key: 'kindergarten', who: 'kindergarten-age children', label: 'Kindergarten', long: 'Kindergarten age', ratio: '1 staff for every 13 children', group: 26 },
  { key: 'schoolAge', who: 'school-age children', label: 'School age', long: 'School age (before and after school)', ratio: '1 staff for every 15 children (primary/junior) or 20 (junior)', group: 30 },
];

// Approximate centre points so parents can pick an area without typing an address
const AREAS = [
  { name: 'Downtown / Centretown', lat: 45.4180, lon: -75.6990 },
  { name: 'Lowertown / Vanier', lat: 45.4370, lon: -75.6650 },
  { name: 'Westboro / Kitchissippi', lat: 45.3930, lon: -75.7520 },
  { name: 'Alta Vista', lat: 45.3880, lon: -75.6600 },
  { name: 'Hunt Club / South Keys', lat: 45.3540, lon: -75.6540 },
  { name: 'Nepean', lat: 45.3470, lon: -75.7360 },
  { name: 'Barrhaven', lat: 45.2740, lon: -75.7380 },
  { name: 'Kanata', lat: 45.3080, lon: -75.8990 },
  { name: 'Stittsville', lat: 45.2590, lon: -75.9210 },
  { name: 'Orléans', lat: 45.4730, lon: -75.5160 },
  { name: 'Riverside South', lat: 45.2780, lon: -75.6750 },
  { name: 'Manotick / rural south', lat: 45.2270, lon: -75.6830 },
];

// Ontario's official questions (paraphrased), grouped as on ontario.ca
const CHECKLIST = [
  { id: 'cost', title: 'Costs and availability', items: [
    'Is there space for my child? If not, how long is the waiting list?',
    'Is the program part of the Canada-wide ($10-a-day) child care system?',
    'What is the full cost, and are there extra fees (holidays, sick days, late pick-up)?',
    'Are subsidized spaces available here?',
    'Do you offer full-time and part-time care?',
    'How flexible are drop-off and pick-up times?',
    'How do staff communicate with parents, and when can parents visit?',
  ] },
  { id: 'safety', title: 'Health and safety', items: [
    'Is the program licensed?',
    'How many children are cared for, and in what groups?',
    'How do you keep children healthy (cleaning, handwashing)?',
    'What happens when a child is sick?',
    'What safety measures are in place indoors?',
    'How do you keep children safe outside, on the playground and on outings?',
    'How is the entrance kept secure?',
    'Are staff trained in first aid and CPR?',
    'What is the emergency evacuation plan?',
    'What happens if my child is expected but does not arrive?',
    'Who is allowed to pick up my child, and how is that checked?',
  ] },
  { id: 'food', title: 'Food and nutrition', items: [
    'What meals and snacks are provided?',
    'Is food prepared on site or catered?',
    'Are some foods, like nuts, not allowed?',
    'Can you accommodate our family’s dietary needs?',
    'Can my child bring food from home?',
    'For babies: is there a fridge for breast milk, and how is the feeding schedule set?',
  ] },
  { id: 'play', title: 'Learning and play', items: [
    'What does a typical day look like?',
    'How do toys and materials support learning, creativity and getting along?',
    'How much time do children spend playing outside?',
    'How are different cultures and traditions included?',
    'How can families be involved?',
    'What happens when a child is angry or upset?',
    'How will you tell me about my child’s learning and development?',
  ] },
  { id: 'staff', title: 'Staff', items: [
    'What training or qualifications do staff have, including for children with special needs?',
    'How many staff on site have first aid and infant or child CPR?',
    'What happens when a staff member is sick or away?',
  ] },
];
const LOOK_FOR = [
  'A space that supports play-based learning and exploring',
  'A program that welcomes family involvement',
  'Staff with training related to working with children',
];

// Step-by-step guide
const GUIDE = [
  { title: 'Know the kinds of care', body: [
    'Licensed child care centres are licensed and inspected by the Government of Ontario. The 315 centres in the City’s open data are all in KinderGuide.',
    'Licensed home child care means care in a provider’s home, overseen by a licensed agency. Ottawa’s 14 agencies are in KinderGuide; contact the agency to find homes near you.',
    'Unlicensed care also exists. It is not licensed or inspected in the same way, so check the caregiver’s record on Ontario’s public search before choosing.',
  ], links: ['unlicensed', 'findPay'] },
  { title: 'Register early on the City’s registry', body: [
    'To get a space in licensed child care in Ottawa, you need to be on the City of Ottawa’s Child Care Registry and Waitlist.',
    'Waits are often around 2 years in Ottawa (2026 family guide), so many families register as early as pregnancy. KinderGuide cannot shorten the wait, but it can help you start early and choose well.',
    'Log in at least every 60 days to keep your application active. The home page can add reminders to your calendar.',
  ], links: ['registry', 'waitGuide'] },
  { title: 'Build your shortlist of 5 to 9', body: [
    'The registry asks you to choose and rank between 5 and 9 programs.',
    'Use Find care to see only the programs licensed for your child’s age near you, then save your favourites to My shortlist.',
  ], action: { label: 'Find care', tab: 'find' } },
  { title: 'Check and visit', body: [
    'Read each program’s licensing report on Ontario’s licensed child care search.',
    'Visit if you can, and bring the visit checklist. It uses the Government of Ontario’s own questions.',
  ], links: ['licensing'], action: { label: 'Open the checklist', tab: 'checklist' } },
  { title: 'Submit, then keep your list up to date', body: [
    'Copy your ranked shortlist from KinderGuide into the registry.',
    'Update your choices whenever your needs change, and follow the City’s instructions to keep your application active.',
  ], links: ['registry'] },
  { title: 'While you wait', body: [
    'Ask each program whether it is part of the Canada-wide ($10-a-day) system and whether subsidies are available.',
    'Consider licensed home child care agencies, which may have different availability.',
  ], links: ['findPay'] },
];

// Example tips for the parents' space mock-up (clearly labelled as examples, not real reviews)
const TIP_TOPICS = ['Staff', 'Communication', 'Food', 'Outdoor play', 'Cleanliness', 'Waitlist', 'Settling in'];
const EXAMPLE_TIPS = [
  { topic: 'Waitlist', text: 'Register as soon as you can. You can always change your choices later.' },
  { topic: 'Staff', text: 'Ask how long the educators in your child’s room have worked there.' },
  { topic: 'Communication', text: 'Ask whether they send daily updates or photos, and how.' },
  { topic: 'Food', text: 'Ask to see a sample weekly menu during your visit.' },
  { topic: 'Outdoor play', text: 'Look at the playground and ask how often children go out in winter.' },
  { topic: 'Cleanliness', text: 'Notice the nap room and the diaper area, not only the main room.' },
  { topic: 'Settling in', text: 'Ask whether they offer a gradual start in the first week.' },
  { topic: 'Communication', text: 'Ask who to contact if you have a concern, and how quickly they reply.' },
  { topic: 'Waitlist', text: 'Ask each centre where you would be on their list and how often it moves.' },
];

// First-visit tour (the cartoony tutorial)
const TOUR = [
  { title: 'Hi, I’m Kip!', text: 'I’ll show you around KinderGuide in 30 seconds. You can skip anytime.' },
  { title: 'Start with your child', text: 'Tell us your child’s age and area. We only show programs licensed for that age.', tab: 'home' },
  { title: 'Explore the map', text: 'Every licensed centre and home child care agency in Ottawa is here. Tap one to see its details, reviews and reports.', tab: 'find' },
  { title: 'Save your 5 to 9', text: 'Add favourites to your shortlist, write notes, then copy it into the City’s registry.', tab: 'shortlist' },
  { title: 'Know the cost', text: 'See what you may pay under Ontario’s official fee rules, and every official tool in one place.', tab: 'costs' },
  { title: 'Visit with confidence', text: 'Use Ontario’s official questions on your visits. Your answers are saved on this device only.', tab: 'checklist' },
];

// ---------------- Costs (official rules, no invented prices) ----------------
const COSTS = {
  cap: 22,            // $ per day, maximum for children under 6 in enrolled (CWELCC) programs
  average: 19,        // $ per day, Ontario average in enrolled programs
  until: 'June 30, 2027',
  checked: 'October 2026',
  optedIn: '94% of licensed sites in Ottawa as of November 2022, the City’s most recent figure',
  schoolAgeExample: 'For example, the Ottawa-Carleton District School Board charged $26.02 a day for before and after school care for children 6 and over in 2024–25.',
};
// Prices confirmed with a centre (by its website, phone or email). Empty until the team confirms some.
// Format: { c12: { text: '$22/day for toddlers and preschool', how: 'phone call', date: '2026-10-28' } }
const VERIFIED_PRICES = {};

// ---------------- Official tools, in the order a family uses them ----------------
const OFFICIAL_TOOLS = [
  { need: 'Get on the waitlist', name: 'Child Care Registry and Waitlist', who: 'City of Ottawa', src: 'registry',
    what: 'The only way to apply for a space in licensed child care in Ottawa. You choose and rank 5 to 9 programs in one application.',
    tip: 'Log in at least every 60 days, or your application can become inactive.' },
  { need: 'Check safety', name: 'Find licensed child care (licensing reports)', who: 'Government of Ontario', src: 'licensing',
    what: 'Shows each licensed program’s licence and inspection information.', tip: 'Search by the program’s exact name.' },
  { need: 'Understand fees', name: 'National child care system ($10-a-day program)', who: 'City of Ottawa', src: 'cwelcc',
    what: 'Explains the reduced fees for children under 6 in programs that joined the Canada-wide system.',
    tip: 'Ontario’s fees are not $10 yet: they are capped at $22 a day (about $19 on average).' },
  { need: 'Get help paying', name: 'Child care fee subsidy and calculator', who: 'City of Ottawa', src: 'subsidy',
    what: 'Help with fees based on family income, for children 12 and under.', tip: 'Use the calculator to estimate your cost. You apply through the registry.' },
  { need: 'Know what to ask', name: 'Questions to ask a child care provider', who: 'Government of Ontario', src: 'questions',
    what: 'The province’s own checklist. KinderGuide’s visit checklist is based on it.', tip: '' },
  { need: 'Child with special needs', name: 'Special needs child care (inclusion support)', who: 'City of Ottawa', src: 'specialNeeds',
    what: 'Support for children with special needs in licensed child care, at no extra cost to families.', tip: 'No diagnosis is needed.' },
  { need: 'Indigenous families', name: 'Indigenous-led licensed child care and EarlyON', who: 'City of Ottawa', src: 'indigenous',
    what: 'Indigenous-led child care and EarlyON programs in Ottawa.', tip: '' },
  { need: 'While you wait', name: 'EarlyON Child and Family Centres', who: 'City of Ottawa', src: 'earlyon',
    what: 'Free drop-in programs for children from birth to 6 and their parents or caregivers.', tip: 'A good way to meet other families and ask questions.' },
  { need: 'Unlicensed care', name: 'Unlicensed caregiver safety record search', who: 'Government of Ontario', src: 'unlicensed',
    what: 'Check whether an unlicensed caregiver has a record of not following the rules.', tip: '' },
  { need: 'Have your say', name: 'Child Care and Early Years Service System Plan', who: 'City of Ottawa', src: 'plan',
    what: 'The City’s plan for child care from 2025 to 2029. Subscribe for updates and future chances to give feedback.', tip: 'Questions: childrensservices@ottawa.ca or 3-1-1.' },
];

// The 10 questions to ask first when a visit is short (keys = checklist group id + item index)
const TOP10 = ['cost0', 'cost1', 'cost2', 'safety0', 'safety1', 'safety3', 'safety10', 'staff0', 'play0', 'cost6'];
