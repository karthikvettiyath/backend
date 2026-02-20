/**
 * Apply Database Schema to Supabase
 * Run: node apply-schema.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function applySchema() {
    console.log('🚀 Applying Database Schema to Supabase...\n');

    const poolConfig = process.env.DATABASE_URL
        ? {
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        }
        : {
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 6543,
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'postgres',
            ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
        };

    const pool = new Pool(poolConfig);

    try {
        const schemaPath = path.join(__dirname, 'database', 'schema_postgres.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('📖 Reading schema script...');

        const client = await pool.connect();
        console.log('✅ Connected to database');

        console.log('⏳ Executing SQL...');
        await client.query(schemaSql);
        console.log('✅ Schema applied successfully');

        client.release();
        await pool.end();
        console.log('\n✨ Database initialization complete.');
    } catch (error) {
        console.error('\n❌ Error applying schema:', error.message);
        process.exit(1);
    }
}

applySchema();
