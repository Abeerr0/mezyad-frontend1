-- نضيف التصنيفات الأساسية، وإذا كانت موجودة ما نكررها.
INSERT INTO categories(name) VALUES
 ('Camels'),('Real Estate'),('Luxury Handbags'),('Vehicle Plates'),('Rare Vehicles')
ON CONFLICT(name) DO NOTHING;