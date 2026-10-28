export const REPORT_GROUPS = [
  'All spending',
  'Business Operating',
  'Business Capital',
  'Advance / Unsettled',
  'Investment / Asset Transfer',
  'Personal / House'
] as const;

export type ReportGroup = (typeof REPORT_GROUPS)[number];

export const CATEGORY_GROUP_MAP: Record<string, Exclude<ReportGroup, 'All spending'>> = {
  'Raw Material': 'Business Operating',
  'Tools': 'Business Operating',
  'Supplies': 'Business Operating',
  'Repairs': 'Business Operating',
  'Wages': 'Business Operating',
  'Outside Work': 'Business Operating',
  'Power & Fuel': 'Business Operating',
  'Transport': 'Business Operating',
  'Packing': 'Business Operating',
  'Factory Expense': 'Business Operating',
  'Office Expense': 'Business Operating',
  'Tax & Fees': 'Business Operating',
  'Machines': 'Business Capital',
  'Advance': 'Advance / Unsettled',
  'Investment': 'Investment / Asset Transfer',
  'Construction': 'Personal / House',
  'Home Expense': 'Personal / House'
};

export const GROUP_COLOR_MAP: Record<string, string> = {
  'Business Operating': '#165DFF',
  'Business Capital': '#00B96B',
  'Advance / Unsettled': '#FF7D00',
  'Investment / Asset Transfer': '#722ED1',
  'Personal / House': '#F5319D',
  'Other': '#86909C'
};
