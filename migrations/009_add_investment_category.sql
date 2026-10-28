INSERT OR IGNORE INTO categories (name, note, sort_order)
VALUES (
  'Investment',
  'Money paid into a VC, committee, savings scheme, deposit, mutual fund, shares or other investment. This is not a normal expense.',
  170
);

WITH investment_aliases(alias) AS (VALUES
  ('VC'), ('vishi'), ('veesi'), ('bishi'), ('bhishi'),
  ('committee'), ('committee saving'), ('chit'), ('chit fund'),
  ('saving'), ('savings'), ('saving scheme'), ('investment'), ('invest'),
  ('SIP'), ('systematic investment plan'), ('mutual fund'), ('MF'),
  ('shares'), ('share'), ('share market'), ('stock'), ('stocks'), ('equity'),
  ('FD'), ('fixed deposit'), ('RD'), ('recurring deposit'),
  ('PPF'), ('public provident fund'), ('post office saving'), ('post office scheme'),
  ('gold investment'), ('gold saving'), ('digital gold'),
  ('bond'), ('bonds'), ('debenture'), ('NSC'), ('national savings certificate'),
  ('KVP'), ('kisan vikas patra'), ('ELSS'), ('index fund'), ('ETF'),
  ('NPS'), ('pension fund'), ('retirement investment')
)
INSERT OR IGNORE INTO category_aliases (category_id, alias, normalized_alias)
SELECT categories.id, investment_aliases.alias, lower(trim(investment_aliases.alias))
FROM investment_aliases
JOIN categories ON categories.name = 'Investment';
