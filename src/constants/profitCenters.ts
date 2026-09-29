export const PROFIT_CENTERS = [
  'Domestic Cleaning',
  'Sofa Cleaning',
  'Office Cleaning',
  'Janitorial Services',
  'Apartment Cleaning',
  'Garden Cleaning',
  'Carpet Cleaning',
  'Tea & Steward Services',
  'Support Staff Services',
  'Post-Construction Cleaning',
  'Floor Waxing/Sealing & Cleaning',
  'Housekeeping Staff Training',
  'Disinfection Services',
  'Feminine & Hygiene Services',
  'Pest Control Services',
  'Security Services',
  'Air Conditioning & Refrigeration Services'
] as const;

export type ProfitCenter = typeof PROFIT_CENTERS[number];
