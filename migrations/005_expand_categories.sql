INSERT INTO categories (name, sort_order) VALUES
  ('Equipment Rental', 35),
  ('Fuel', 36),
  ('Repairs & Maintenance', 45),
  ('Safety & PPE', 46),
  ('Utilities', 55),
  ('Food & Refreshments', 56),
  ('Office & Admin', 57),
  ('Subcontractors', 65),
  ('Taxes & Fees', 70);

INSERT INTO category_aliases (category_id, alias, normalized_alias)
SELECT id, lower(name), lower(name) FROM categories WHERE name IN (
  'Equipment Rental', 'Fuel', 'Repairs & Maintenance', 'Safety & PPE', 'Utilities',
  'Food & Refreshments', 'Office & Admin', 'Subcontractors', 'Taxes & Fees'
);

INSERT INTO category_aliases (category_id, alias, normalized_alias)
SELECT categories.id, aliases.alias, aliases.alias FROM categories
JOIN (
  SELECT 'Equipment Rental' AS category, 'hire' AS alias UNION ALL
  SELECT 'Equipment Rental', 'rental' UNION ALL
  SELECT 'Fuel', 'diesel' UNION ALL
  SELECT 'Fuel', 'petrol' UNION ALL
  SELECT 'Repairs & Maintenance', 'repair' UNION ALL
  SELECT 'Repairs & Maintenance', 'maintenance' UNION ALL
  SELECT 'Safety & PPE', 'ppe' UNION ALL
  SELECT 'Safety & PPE', 'safety' UNION ALL
  SELECT 'Utilities', 'electricity' UNION ALL
  SELECT 'Utilities', 'water bill' UNION ALL
  SELECT 'Food & Refreshments', 'food' UNION ALL
  SELECT 'Food & Refreshments', 'tea' UNION ALL
  SELECT 'Office & Admin', 'office' UNION ALL
  SELECT 'Office & Admin', 'stationery' UNION ALL
  SELECT 'Subcontractors', 'contractor' UNION ALL
  SELECT 'Taxes & Fees', 'tax' UNION ALL
  SELECT 'Taxes & Fees', 'fee'
) aliases ON aliases.category = categories.name;
