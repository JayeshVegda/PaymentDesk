INSERT INTO payment_methods (code, display_name) VALUES
  ('cash', 'Cash'),
  ('upi', 'UPI'),
  ('bank', 'Bank transfer'),
  ('cheque', 'Cheque');

INSERT INTO app_settings (key, value) VALUES
  ('business_timezone', '"Asia/Kolkata"'),
  ('currency', '"INR"'),
  ('backup_retention', '{"daily":14,"weekly":8,"monthly":12}');

