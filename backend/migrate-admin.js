/**
 * Migration: Add is_admin column to users table
 * Run: node migrate-admin.js
 */

require('dotenv').config();
const { Pool } = require('pg');

async function migrate() {
    console.log('🚀 Running Admin Migration...\n');

    const poolConfig = process.env.DATABASE_URL
        ? {
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        }
        : {
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 6543,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
        };

    const pool = new Pool(poolConfig);

    try {
        const client = await pool.connect();
        console.log('✅ Connected to database');

        console.log('⏳ Adding is_admin column...');
        await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
    `);
        console.log('✅ Column is_admin added successfully');

        // Optionally set specific user as admin if email is provided in command line
        const adminEmail = process.argv[2] || 'admin@electrospot.com';
        console.log(`⏳ Setting ${adminEmail} as admin...`);

        const result = await client.query('UPDATE users SET is_admin = TRUE WHERE email = $1 RETURNING id, name', [adminEmail]);

        if (result.rowCount > 0) {
            console.log(`✅ User ${result.rows[0].name} (${adminEmail}) is now an admin.`);
        } else {
            console.log(`⚠️  User with email ${adminEmail} not found. You may need to register first or target a different email.`);
        }

        client.release();
        await pool.end();
        console.log('\n✨ Migration complete.');
    } catch (error) {
        console.error('\n❌ Error during migration:', error.message);
        process.exit(1);
    }
}

migrate();
