-- CompuCity DB Backup (Turso Live)
-- Generated: 2026-05-27T01:21:34.742Z

-- Table: admins
CREATE TABLE admins (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password TEXT NOT NULL, role TEXT DEFAULT "admin", createdAt TEXT, updatedAt TEXT);

INSERT INTO admins (id, email, name, password, role, createdAt, updatedAt) VALUES ('d09e97f7-6135-4894-9a3b-6626bf2c9c10', 'admin@compucity.com', 'Admin', '1b1d005b9ceed7a2df8b192fb4af721ce6e90e8e179294168a5ee5e9e0b8a10a', 'admin', '2026-05-22T15:27:00.802Z', '2026-05-22T15:27:00.802Z');

-- Table: categories
CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, image TEXT, parentId TEXT, createdAt TEXT, updatedAt TEXT, enabled INTEGER DEFAULT 1, "order" INTEGER DEFAULT 0);

INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('cat1', 'Notebooks', 'notebooks', NULL, NULL, '2026-05-22T12:30:05.878Z', '2026-05-22T12:30:05.878Z', 1, 0);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('cat3', 'Periféricos', 'perifericos', NULL, NULL, '2026-05-22T12:30:05.878Z', '2026-05-22T12:30:05.878Z', 1, 4);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('cat4', 'Monitores', 'monitores', NULL, NULL, '2026-05-22T12:30:05.878Z', '2026-05-22T12:30:05.878Z', 1, 3);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('cat5', 'Accesorios', 'accesorios', NULL, NULL, '2026-05-22T12:30:05.878Z', '2026-05-22T19:38:53.000Z', 1, 7);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('cat6', 'PC Armadas', 'pc-armadas', NULL, NULL, '2026-05-22T12:30:05.878Z', '2026-05-22T12:30:05.878Z', 1, 1);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('a616a67b-03d5-4efb-b44d-8136b7451b0c', 'Ultrabooks', 'ultrabooks', NULL, 'cat1', '2026-05-22T18:54:55.258Z', '2026-05-22T18:54:55.258Z', 1, 3);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('6f158cb1-0e85-49a5-92bd-25175d03eeb3', 'Gamer', 'gamer-pc', NULL, 'cat6', '2026-05-22T18:54:55.258Z', '2026-05-22T18:54:55.258Z', 1, 0);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('a8e88983-0d7c-476b-a895-37588b8e70b1', 'Oficina', 'oficina-pc', NULL, 'cat6', '2026-05-22T18:54:55.258Z', '2026-05-22T18:54:55.258Z', 1, 0);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('fd820e6e-2431-4719-8a07-b55718e9d420', 'Diseño', 'diseno-pc', NULL, 'cat6', '2026-05-22T18:54:55.258Z', '2026-05-22T18:54:55.258Z', 1, 0);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('00176d39-d1cb-4f68-a01e-617fb37679cb', 'Mini PC', 'mini-pc', NULL, 'cat6', '2026-05-22T18:54:55.258Z', '2026-05-22T18:54:55.258Z', 1, 3);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('9e696a46-81f8-4753-a51f-6dd9d933fbea', 'Componentes de PC', 'componentes-de-pc', NULL, NULL, '2026-05-22T18:54:55.258Z', '2026-05-22T18:54:55.258Z', 1, 2);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('cfbf9b6c-5d7b-4d42-aaa3-066a52848fbd', 'Placas de Video', 'placas-de-video', NULL, '9e696a46-81f8-4753-a51f-6dd9d933fbea', '2026-05-22T18:54:55.258Z', '2026-05-22T18:54:55.258Z', 1, 0);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('b4211f62-d18d-430e-a918-8dadafde4723', 'Microprocesadores', 'microprocesadores', NULL, '9e696a46-81f8-4753-a51f-6dd9d933fbea', '2026-05-22T18:54:55.258Z', '2026-05-22T18:54:55.258Z', 1, 1);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('50aed4ad-61dd-4e5d-ad30-2aae7a32504e', 'Motherboards', 'motherboards', NULL, '9e696a46-81f8-4753-a51f-6dd9d933fbea', '2026-05-22T18:54:55.258Z', '2026-05-22T18:54:55.258Z', 1, 2);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('8fec8068-83c9-43a9-a972-9eeafe9e0bda', 'Memorias RAM', 'memorias-ram', NULL, '9e696a46-81f8-4753-a51f-6dd9d933fbea', '2026-05-22T18:54:55.258Z', '2026-05-22T18:54:55.258Z', 1, 3);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('18b32130-e146-4843-95c5-860142417306', 'Discos SSD', 'discos-ssd', NULL, '9e696a46-81f8-4753-a51f-6dd9d933fbea', '2026-05-22T18:54:55.258Z', '2026-05-22T18:54:55.258Z', 1, 4);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('63761dd5-d992-4bab-b9a6-fb95c3ff2cef', 'Discos HDD', 'discos-hdd', NULL, '9e696a46-81f8-4753-a51f-6dd9d933fbea', '2026-05-22T18:54:55.258Z', '2026-05-22T18:54:55.258Z', 1, 5);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('b24872b5-c02e-4969-892b-aa03f1acdae8', 'Gabinetes', 'gabinetes', NULL, '9e696a46-81f8-4753-a51f-6dd9d933fbea', '2026-05-22T18:54:55.258Z', '2026-05-22T18:54:55.258Z', 1, 7);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('57b1e5cc-59e6-49f0-a9d1-b3f388c19f79', 'Refrigeración', 'refrigeracion', NULL, '9e696a46-81f8-4753-a51f-6dd9d933fbea', '2026-05-22T18:54:55.258Z', '2026-05-22T18:54:55.258Z', 1, 8);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('b8cc805f-10f4-4bb1-b4d2-dacc0ad395c4', 'Pastas Térmicas', 'pastas-termicas', NULL, '9e696a46-81f8-4753-a51f-6dd9d933fbea', '2026-05-22T18:54:55.258Z', '2026-05-22T18:54:55.258Z', 1, 9);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('3d84075f-2bb7-4d20-b321-7f3f9f9fe6f0', 'Soportes y Brazos', 'soportes-y-brazos', NULL, 'cat4', '2026-05-22T18:54:55.258Z', '2026-05-22T18:54:55.258Z', 1, 3);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('dede1e27-d8b0-44b1-9ac0-8112ad91a57d', 'Teclados', 'teclados', NULL, 'cat3', '2026-05-22T18:54:55.258Z', '2026-05-22T18:54:55.258Z', 1, 0);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('ac551783-8734-4858-a316-d0a54701e437', 'Mouse', 'mouse', NULL, 'cat3', '2026-05-22T18:54:55.258Z', '2026-05-22T18:54:55.258Z', 1, 1);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('f1f9d31f-9482-4429-a7d2-4208668e3ba3', 'Auriculares', 'auriculares', NULL, 'cat3', '2026-05-22T18:54:55.258Z', '2026-05-22T18:54:55.258Z', 1, 2);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('724ec70f-dab0-496f-b3a2-7ddee9a4770d', 'Mousepads', 'mousepads', NULL, 'cat3', '2026-05-22T18:54:55.258Z', '2026-05-22T18:54:55.258Z', 1, 3);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('a4ca4e17-7730-4feb-a6c6-a7a8b96075ac', 'Parlantes', 'parlantes', NULL, 'cat3', '2026-05-22T18:54:55.258Z', '2026-05-22T18:54:55.258Z', 1, 4);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('8e03c174-cb16-4b19-b920-73fc96236fbd', 'Webcams', 'webcams', NULL, 'cat3', '2026-05-22T18:54:55.258Z', '2026-05-22T18:54:55.258Z', 1, 5);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('6498104b-2a0e-4770-86af-bd7c2572555a', 'Micrófonos', 'microfonos', NULL, 'cat3', '2026-05-22T18:54:55.258Z', '2026-05-22T18:54:55.258Z', 1, 6);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('b19a7241-88e7-454f-8b5e-b0030d9c6716', 'Kits Gamer', 'kits-gamer', NULL, 'cat3', '2026-05-22T18:54:55.258Z', '2026-05-22T18:54:55.258Z', 1, 8);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('18191d04-ecf3-412c-b627-7674c148013c', 'Impresión', 'impresion', NULL, NULL, '2026-05-22T18:54:55.258Z', '2026-05-22T18:54:55.258Z', 1, 5);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('66f20839-0487-433a-930f-9705ca43365d', 'Toners y Cartuchos', 'toners-y-cartuchos', NULL, '18191d04-ecf3-412c-b627-7674c148013c', '2026-05-22T18:54:55.258Z', '2026-05-22T18:54:55.258Z', 1, 3);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('0b090bb2-5761-4bfb-8337-f6e217c8e7a5', 'Conectividad y Redes', 'conectividad-y-redes', NULL, NULL, '2026-05-22T18:54:55.258Z', '2026-05-22T18:54:55.258Z', 1, 6);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('172af915-f189-476c-a735-e9a7b05bd16c', 'Routers WiFi', 'routers-wifi', NULL, '0b090bb2-5761-4bfb-8337-f6e217c8e7a5', '2026-05-22T18:54:55.258Z', '2026-05-22T18:54:55.258Z', 1, 0);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('2624baab-e1ba-4f28-aa2f-2d4d1b726b84', 'Switches', 'switches', NULL, '0b090bb2-5761-4bfb-8337-f6e217c8e7a5', '2026-05-22T18:54:55.258Z', '2026-05-22T18:54:55.258Z', 1, 1);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('3f166420-a367-43a9-96d6-55760385bbb5', 'Cables y Adaptadores', 'cables-y-adaptadores', NULL, '0b090bb2-5761-4bfb-8337-f6e217c8e7a5', '2026-05-22T18:54:55.258Z', '2026-05-22T18:54:55.258Z', 1, 2);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('be240fd6-301f-405a-a42d-e6937fa9bcf9', 'Placas de Red', 'placas-de-red', NULL, '0b090bb2-5761-4bfb-8337-f6e217c8e7a5', '2026-05-22T18:54:55.258Z', '2026-05-22T18:54:55.258Z', 1, 3);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('33bb5721-c9fa-4667-b4bf-5b926b6fe1d8', 'Almacenamiento Externo', 'almacenamiento-externo', NULL, NULL, '2026-05-22T18:54:55.258Z', '2026-05-22T19:38:53.244Z', 1, 8);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('404bbe6d-bc9a-471c-b264-fcf18d693295', 'Discos Externos', 'discos-externos', NULL, '33bb5721-c9fa-4667-b4bf-5b926b6fe1d8', '2026-05-22T18:54:55.258Z', '2026-05-22T18:54:55.258Z', 1, 0);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('f78dc8a5-69e0-4097-b4f9-c928fd90069f', 'Pendrives', 'pendrives', NULL, '33bb5721-c9fa-4667-b4bf-5b926b6fe1d8', '2026-05-22T18:54:55.258Z', '2026-05-22T18:54:55.258Z', 1, 1);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('bdf7ba10-c068-4b61-845c-5d38e2b87a61', 'Sillas Gamer', 'sillas-gamer', NULL, 'cat5', '2026-05-22T18:54:55.258Z', '2026-05-22T18:54:55.258Z', 1, 4);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('9a877f10-5486-4918-97e1-654f457c7420', 'Escritorios', 'escritorios', NULL, 'cat5', '2026-05-22T18:54:55.258Z', '2026-05-22T18:54:55.258Z', 1, 5);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('7ee43df2-6ade-4425-87a4-8575d0cc3459', 'Gamer', 'gamer', NULL, 'cat1', '2026-05-22T19:33:37.603Z', '2026-05-22T19:33:37.603Z', 1, 0);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('4cd2d1e5-dc53-4d23-b2e0-586a1c9823fd', 'Oficina', 'oficina', NULL, 'cat1', '2026-05-22T19:33:37.603Z', '2026-05-22T19:33:37.603Z', 1, 1);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('a0515017-150d-4f11-85d5-fba0e6830a37', 'Diseño', 'diseno', NULL, 'cat1', '2026-05-22T19:33:37.603Z', '2026-05-22T19:33:37.603Z', 1, 2);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('bce97e5d-3ccf-4e49-9c23-1af8ece63612', 'Fuentes', 'fuentes', NULL, '9e696a46-81f8-4753-a51f-6dd9d933fbea', '2026-05-22T19:33:37.603Z', '2026-05-22T19:33:37.603Z', 1, 6);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('7a609a02-093f-4a06-9aa6-34e527452143', 'Combos', 'combos', NULL, '9e696a46-81f8-4753-a51f-6dd9d933fbea', '2026-05-22T19:33:37.603Z', '2026-05-22T19:33:37.603Z', 1, 10);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('b27231ee-0682-471b-b6c1-59b9402e447c', 'Gamer', 'gamer-mon', NULL, 'cat4', '2026-05-22T19:33:37.603Z', '2026-05-22T19:33:37.603Z', 1, 0);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('9c577c6f-ab09-4ca6-b6a9-8f7cc2f98d55', 'Oficina', 'oficina-mon', NULL, 'cat4', '2026-05-22T19:33:37.603Z', '2026-05-22T19:33:37.603Z', 1, 1);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('47287fdb-d05e-4d59-b0a0-2fdb61509236', 'Diseño', 'diseno-mon', NULL, 'cat4', '2026-05-22T19:33:37.603Z', '2026-05-22T19:33:37.603Z', 1, 2);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('964647bd-67e5-4483-91ea-fb74f8f49ca4', 'Joysticks', 'joysticks', NULL, 'cat3', '2026-05-22T19:33:37.603Z', '2026-05-22T19:33:37.603Z', 1, 7);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('0ea463ed-b83e-4d9b-8c37-635737f1779e', 'Láser', 'laser', NULL, '18191d04-ecf3-412c-b627-7674c148013c', '2026-05-22T19:33:37.603Z', '2026-05-22T19:33:37.603Z', 1, 0);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('3cb0cac6-46c9-4db2-baba-57244d650938', 'Inyección', 'inyeccion', NULL, '18191d04-ecf3-412c-b627-7674c148013c', '2026-05-22T19:33:37.603Z', '2026-05-22T19:33:37.603Z', 1, 1);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('22695b59-1ec5-4484-8c72-994c90569150', 'Sistema Continuo', 'sistema-continuo', NULL, '18191d04-ecf3-412c-b627-7674c148013c', '2026-05-22T19:33:37.603Z', '2026-05-22T19:33:37.603Z', 1, 2);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('797adcdf-c7ae-4aa0-9b14-18b3a5b8ea45', 'Micro SD', 'micro-sd', NULL, '33bb5721-c9fa-4667-b4bf-5b926b6fe1d8', '2026-05-22T19:33:37.603Z', '2026-05-22T19:33:37.603Z', 1, 2);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('6af5a32c-f21d-4498-9927-c33a97e72a16', 'Cargadores', 'cargadores', NULL, 'cat5', '2026-05-22T19:33:37.603Z', '2026-05-22T19:33:37.603Z', 1, 0);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('ebce56d0-c6a3-46cb-b737-3e69f5163847', 'Bases', 'bases', NULL, 'cat5', '2026-05-22T19:33:37.603Z', '2026-05-22T19:33:37.603Z', 1, 1);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('4e82d540-2eb2-4d4b-b349-44fe6af49e00', 'Fundas/Mochilas', 'fundas-mochilas', NULL, 'cat5', '2026-05-22T19:33:37.603Z', '2026-05-22T19:33:37.603Z', 1, 2);
INSERT INTO categories (id, name, slug, image, parentId, createdAt, updatedAt, enabled, order) VALUES ('b854e149-1790-4cad-abc6-0a4fb187740b', 'UPS', 'ups', NULL, 'cat5', '2026-05-22T19:33:37.603Z', '2026-05-22T19:33:37.603Z', 1, 3);

-- Table: dollar_rates
CREATE TABLE dollar_rates (id TEXT PRIMARY KEY, rate REAL NOT NULL, source TEXT DEFAULT "blue", updatedAt TEXT);

INSERT INTO dollar_rates (id, rate, source, updatedAt) VALUES ('dr1', 1430, 'nacion', '2026-05-27T01:20:48.758Z');

-- Table: order_items
CREATE TABLE order_items (id TEXT PRIMARY KEY, orderId TEXT NOT NULL, productId TEXT, name TEXT NOT NULL, price REAL NOT NULL, quantity INTEGER DEFAULT 1);

-- Table: orders
CREATE TABLE orders (id TEXT PRIMARY KEY, orderNumber TEXT NOT NULL UNIQUE, customerName TEXT NOT NULL, customerEmail TEXT, customerPhone TEXT, customerDni TEXT, shippingAddress TEXT, shippingCity TEXT, shippingProvince TEXT, shippingZip TEXT, shippingMethod TEXT, shippingCost REAL DEFAULT 0, trackingNumber TEXT, status TEXT DEFAULT "pending", paymentMethod TEXT, paymentId TEXT, total REAL NOT NULL, notes TEXT, createdAt TEXT, updatedAt TEXT, shippingDetails TEXT);

-- Table: product_images
CREATE TABLE product_images (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      size INTEGER NOT NULL,
      width INTEGER,
      height INTEGER,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );

-- product_images: 8 registros (omitidos por tamaño - ver backup JSON)

-- Table: products
CREATE TABLE products (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, description TEXT, price REAL NOT NULL, comparePrice REAL, costPrice REAL, sku TEXT UNIQUE, stock INTEGER DEFAULT 0, isActive INTEGER DEFAULT 1, isFeatured INTEGER DEFAULT 0, images TEXT, specs TEXT, providerId TEXT, providerSku TEXT, categoryId TEXT, createdAt TEXT, updatedAt TEXT);

INSERT INTO products (id, name, slug, description, price, comparePrice, costPrice, sku, stock, isActive, isFeatured, images, specs, providerId, providerSku, categoryId, createdAt, updatedAt) VALUES ('56f7cb03-1739-4b6f-93ae-148a245cd6e9', 'Notebook', 'notebook', 'Notebook', 227858, 205073, 123, NULL, 2, 1, 0, '["/api/image/f733ae80-e6c3-4890-9a49-42c28babc89e"]', '{}', NULL, NULL, '4cd2d1e5-dc53-4d23-b2e0-586a1c9823fd', '2026-05-22T19:55:21.266Z', '2026-05-22T19:57:13.460Z');
INSERT INTO products (id, name, slug, description, price, comparePrice, costPrice, sku, stock, isActive, isFeatured, images, specs, providerId, providerSku, categoryId, createdAt, updatedAt) VALUES ('8d7d9d5a-7d9b-4aa6-b9b5-8ae6353be3c0', 'Notebook Lenovo Ideapad 1 15AMN7 Ryzen 5 7520U 8Gb Ssd 256Gb 15.6 W11 Abyss Blue', 'notebook-lenovo-ideapad-1-15amn7-ryzen-5-7520u-8gb-ssd-256gb-15-6-w11-abyss-blue', 'Notebook Lenovo IdeaPad 1 15AMN7 con procesador AMD Ryzen 5 7520U y gráficos Radeon 610M, ideal para tareas diarias, estudio, oficina y multimedia. Su pantalla Full HD de 15.6" brinda buena calidad de imagen, mientras que el SSD NVMe de 256GB ofrece rapidez en el arranque y carga de aplicaciones. Incluye Windows 11 Home y conectividad WiFi 6 para una experiencia moderna y fluida.', 650650, 585585, 350, NULL, 2, 1, 0, '["/api/image/bab09e28-fd94-47b2-9911-e96e7aaad410","/api/image/9d95fc0b-c091-47a5-b80a-18dbd271a023"]', '{}', NULL, NULL, '7ee43df2-6ade-4425-87a4-8575d0cc3459', '2026-05-26T17:29:59.368Z', '2026-05-26T17:29:59.368Z');
INSERT INTO products (id, name, slug, description, price, comparePrice, costPrice, sku, stock, isActive, isFeatured, images, specs, providerId, providerSku, categoryId, createdAt, updatedAt) VALUES ('500aa0ab-cd46-484d-a6c6-d4df581b622b', 'Placa De Video Palit Nvidia GeForce RTX 3050 Stormx 6GB GDDR6', 'placa-de-video-palit-nvidia-geforce-rtx-3050-stormx-6gb-gddr6', 'Descripción
La Palit RTX 3050 StormX de 6GB es una placa compacta con gran rendimiento gráfico. Ideal para setups pequeños gracias a su tamaño mini-ITX, combina potencia con eficiencia. Con soporte para resoluciones hasta 8K y múltiples salidas de video, es perfecta para gaming fluido y experiencias visuales de alta calidad.

Lo que tenés que saber
Memoria VRAM: 6GB
Tipo de Memoria: GDDR6
Conexión a Fuente: No Tiene
Núcleos CUDA: 2304
Frecuencia de Reloj: 1470 MHz
Iluminación: Sin Iluminación
Software: No Tiene
Tamaño: 162 mm
Puertos de Video: HDMI 2.1 x1, DisplayPort 1.4a x1, Dual-Link DVI x1
Versión PCIe: PCIe 4.0
Bits: 96', 371800, 334620, 200, NULL, 1, 1, 0, '["/api/image/923ddb68-545a-449f-b16f-dd2f9958e211","/api/image/bcf87d33-0555-42f9-a804-49f013e5415b"]', '{}', NULL, NULL, 'cfbf9b6c-5d7b-4d42-aaa3-066a52848fbd', '2026-05-26T17:31:53.056Z', '2026-05-26T17:32:09.003Z');

-- Table: store_config
CREATE TABLE store_config (id TEXT PRIMARY KEY, key TEXT NOT NULL UNIQUE, value TEXT NOT NULL, updatedAt TEXT);

INSERT INTO store_config (id, key, value, updatedAt) VALUES ('sc1', 'store_name', '{"value":"Compucity"}', '2026-05-22T12:30:05.878Z');
INSERT INTO store_config (id, key, value, updatedAt) VALUES ('sc2', 'store_slogan', '{"value":"Tu Mundo Digital"}', '2026-05-22T12:30:05.878Z');
INSERT INTO store_config (id, key, value, updatedAt) VALUES ('sc3', 'whatsapp_number', '{"value":"3517656918"}', '2026-05-22T12:30:05.878Z');
INSERT INTO store_config (id, key, value, updatedAt) VALUES ('2aaa2690-9d06-484f-9ff7-56d6f5a51baa', 'markup', '{"value":30}', '2026-05-22T15:48:09.207Z');
INSERT INTO store_config (id, key, value, updatedAt) VALUES ('bca66db1-e939-46ec-b02e-ecc586453372', 'cash_discount', '{"value":10}', '2026-05-22T15:48:09.207Z');
INSERT INTO store_config (id, key, value, updatedAt) VALUES ('d8629297-a79f-4bca-89c5-700679e6a206', 'dollar_source', '{"value":"nacion"}', '2026-05-22T15:48:09.207Z');

