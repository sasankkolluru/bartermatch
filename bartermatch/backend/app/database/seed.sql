INSERT OR IGNORE INTO users(id,name,email,role) VALUES (1,'Demo Brand','brand@example.com','brand'),(2,'Asha Rao','asha@example.com','creator');
INSERT OR IGNORE INTO creators(id,name,handle,platform,followers,engagement,niche,city,trust_score) VALUES
(1,'Asha Rao','@ashaliving','Instagram',42000,5.8,'beauty','Hyderabad',92),
(2,'Rohan Eats','@rohaneats','Instagram',28000,7.2,'food','Bengaluru',85),
(3,'Mira Style','@mirastyle','YouTube',86000,4.9,'fashion','Hyderabad',78),
(4,'Kavya Creates','@kavyacreates','Instagram',15500,8.1,'beauty','Chennai',96);
INSERT OR IGNORE INTO products(id,name,category,price,stock,description) VALUES
(1,'Neem Glow Serum','beauty',899,120,'Plant-based daily face serum'),
(2,'Millet Snack Box','food',499,80,'Indian millet snack sampler'),
(3,'Everyday Cotton Kurta','fashion',1299,45,'Soft cotton everyday kurta');
INSERT OR IGNORE INTO campaigns(id,brand_id,title,product_id,niche,city,budget,status) VALUES (1,1,'Monsoon Glow Creators',1,'beauty','Hyderabad',25000,'active');
