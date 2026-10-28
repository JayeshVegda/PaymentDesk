ALTER TABLE payees ADD COLUMN favourite INTEGER NOT NULL DEFAULT 0 CHECK (favourite IN (0, 1));

INSERT INTO categories (name, sort_order) VALUES
  ('Wages', 10),
  ('Materials', 20),
  ('Transport', 30),
  ('Tools', 40),
  ('Courier', 50),
  ('Supplier', 60),
  ('Other', 100);

INSERT INTO category_aliases (category_id, alias, normalized_alias)
SELECT id, lower(name), lower(name) FROM categories;

INSERT INTO category_aliases (category_id, alias, normalized_alias)
SELECT id, 'worker', 'worker' FROM categories WHERE name = 'Wages';

INSERT INTO category_aliases (category_id, alias, normalized_alias)
SELECT id, 'labour', 'labour' FROM categories WHERE name = 'Wages';

INSERT INTO category_aliases (category_id, alias, normalized_alias)
SELECT id, 'travel', 'travel' FROM categories WHERE name = 'Transport';

