import { getPool } from "./db.js";

export async function initDb() {
  const pool = getPool();

  console.log("🔄 Initializing PostgreSQL database...");

  // =========================================================
  // USERS
  // =========================================================
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      clerk_user_id VARCHAR(100) NOT NULL UNIQUE,
      full_name VARCHAR(120),
      email VARCHAR(200),
      role VARCHAR(20) NOT NULL DEFAULT 'client',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT ck_users_role
        CHECK (role IN ('owner', 'client', 'admin'))
    );
  `);

  console.log("✅ users table initialized");

  // =========================================================
  // PROPERTIES
  // =========================================================
  await pool.query(`
    CREATE TABLE IF NOT EXISTS properties (
      id SERIAL PRIMARY KEY,

      owner_id INTEGER NOT NULL
        REFERENCES users(id),

      client_id INTEGER
        REFERENCES users(id),

      title VARCHAR(200) NOT NULL,
      title_en VARCHAR(200),

      description TEXT,

      price NUMERIC(12,2) NOT NULL,

      listing_type VARCHAR(20) NOT NULL DEFAULT 'sale',

      area_m2 NUMERIC(8,2),
      rooms INTEGER,

      city VARCHAR(100) NOT NULL,
      city_id VARCHAR(80),
      neighborhood VARCHAR(100),
      place_id VARCHAR(80),
      address VARCHAR(200),

      lat NUMERIC(9,6),
      lng NUMERIC(9,6),

      status VARCHAR(20) NOT NULL DEFAULT 'available',

      visibility VARCHAR(20) NOT NULL DEFAULT 'public',

      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT ck_properties_listing_type
        CHECK (listing_type IN ('sale', 'rent')),

      CONSTRAINT ck_properties_status
        CHECK (status IN ('available', 'sold', 'rented')),

      CONSTRAINT ck_properties_visibility
        CHECK (visibility IN ('public', 'private')),

      CONSTRAINT ck_properties_price
        CHECK (price > 0),

      CONSTRAINT ck_properties_rooms
        CHECK (rooms IS NULL OR rooms > 0),

      CONSTRAINT ck_properties_area
        CHECK (area_m2 IS NULL OR area_m2 > 0)
    );
  `);

  console.log("✅ properties table initialized");

  // =========================================================
  // PROPERTIES INDEXES
  // =========================================================
  await pool.query(`
    CREATE INDEX IF NOT EXISTS ix_properties_location
    ON properties (city, neighborhood);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS ix_properties_place
    ON properties (city_id, place_id);
  `);

  console.log("✅ properties indexes initialized");

  // =========================================================
  // PROPERTY IMAGES
  // =========================================================
  await pool.query(`
    CREATE TABLE IF NOT EXISTS property_images (
      id SERIAL PRIMARY KEY,

      property_id INTEGER NOT NULL
        REFERENCES properties(id)
        ON DELETE CASCADE,

      url VARCHAR(400) NOT NULL,

      is_cover BOOLEAN NOT NULL DEFAULT FALSE,

      sort_order INTEGER NOT NULL DEFAULT 0
    );
  `);

  console.log("✅ property_images table initialized");

  // =========================================================
  // PROPERTY ROOMS
  // =========================================================
  await pool.query(`
    CREATE TABLE IF NOT EXISTS property_rooms (
      id SERIAL PRIMARY KEY,

      property_id INTEGER NOT NULL
        REFERENCES properties(id)
        ON DELETE CASCADE,

      room_type VARCHAR(40) NOT NULL,

      quantity INTEGER NOT NULL,

      CONSTRAINT ck_property_rooms_type
        CHECK (
          room_type IN (
            'living',
            'bedroom',
            'kitchen',
            'bathroom',
            'wc',
            'balcony'
          )
        ),

      CONSTRAINT ck_property_rooms_qty
        CHECK (quantity > 0),

      CONSTRAINT uq_property_rooms
        UNIQUE (property_id, room_type)
    );
  `);

  console.log("✅ property_rooms table initialized");

  // =========================================================
  // MESSAGES
  // =========================================================
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,

      sender_id INTEGER NOT NULL
        REFERENCES users(id),

      receiver_id INTEGER NOT NULL
        REFERENCES users(id),

      property_id INTEGER
        REFERENCES properties(id)
        ON DELETE SET NULL,

      body VARCHAR(2000) NOT NULL,

      is_read BOOLEAN NOT NULL DEFAULT FALSE,

      sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT ck_messages_participants
        CHECK (sender_id <> receiver_id)
    );
  `);

  console.log("✅ messages table initialized");

  // =========================================================
  // ISSUES
  // =========================================================
  await pool.query(`
    CREATE TABLE IF NOT EXISTS issues (
      id SERIAL PRIMARY KEY,

      client_id INTEGER NOT NULL
        REFERENCES users(id),

      property_id INTEGER NOT NULL
        REFERENCES properties(id),

      category VARCHAR(40) NOT NULL,

      description VARCHAR(2000) NOT NULL,

      status VARCHAR(20) NOT NULL DEFAULT 'new',

      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

      resolved_at TIMESTAMP,

      CONSTRAINT ck_issues_status
        CHECK (
          status IN (
            'new',
            'in_progress',
            'resolved'
          )
        )
    );
  `);

  console.log("✅ issues table initialized");

  // =========================================================
  // SERVICES
  // =========================================================
  await pool.query(`
    CREATE TABLE IF NOT EXISTS services (
      id SERIAL PRIMARY KEY,

      sort_order INTEGER NOT NULL,

      title_de VARCHAR(160) NOT NULL,

      title_en VARCHAR(160) NOT NULL,

      text_de VARCHAR(800) NOT NULL,

      text_en VARCHAR(800) NOT NULL
    );
  `);

  console.log("✅ services table initialized");

  // =========================================================
  // FINAL DATABASE CHECK
  // =========================================================
  const result = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'users',
        'properties',
        'property_images',
        'property_rooms',
        'messages',
        'issues',
        'services'
      )
    ORDER BY table_name;
  `);

  console.log(
    "📋 PostgreSQL tables:",
    result.rows.map((row) => row.table_name)
  );

  const requiredTables = [
    "users",
    "properties",
    "property_images",
    "property_rooms",
    "messages",
    "issues",
    "services",
  ];

  const existingTables = result.rows.map((row) => row.table_name);

  const missingTables = requiredTables.filter(
    (table) => !existingTables.includes(table)
  );

  if (missingTables.length > 0) {
    throw new Error(
      `Database initialization failed. Missing tables: ${missingTables.join(", ")}`
    );
  }

  console.log("✅ ALL DATABASE TABLES VERIFIED");
  console.log("✅ PostgreSQL database initialization completed");
}