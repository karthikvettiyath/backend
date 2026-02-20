/**
 * Verify PostgreSQL Database Setup (Supabase)
 * Run: node verify-postgres.js
 */

require('dotenv').config();
const { Pool } = require('pg');

async function verifyDatabase() {
    console.log('🔍 Verifying PostgreSQL Database Setup (Supabase)...\n');

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

    console.log(`📡 Connecting to ${poolConfig.host || 'DATABASE_URL'}...`);
    const pool = new Pool(poolConfig);

    try {
        // Check 1: Database Connection
        console.log('1️⃣  Testing database connection...');
        const client = await pool.connect();
        console.log('   ✅ Connected to database');

        // Check 2: Users table
        console.log('\n2️⃣  Checking users table...');
        const usersRes = await client.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users')");
        if (usersRes.rows[0].exists) {
            console.log('   ✅ Users table exists');

            // Check 3: Phone column
            const phoneRes = await client.query("SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'phone'");
            if (phoneRes.rows.length > 0) {
                console.log('   ✅ Phone column exists');
                if (phoneRes.rows[0].is_nullable === 'NO') {
                    console.log('   ✅ Phone column is NOT NULL');
                } else {
                    console.log('   ❌ Phone column allows NULL');
                }
            } else {
                console.log('   ❌ Phone column does not exist');
            }
        } else {
            console.log('   ❌ Users table does not exist');
        }

        // Check 4: Charging stations table
        console.log('\n3️⃣  Checking charging_stations table...');
        const stationsRes = await client.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'charging_stations')");
        if (stationsRes.rows[0].exists) {
            console.log('   ✅ Charging stations table exists');
        } else {
            console.log('   ❌ Charging stations table does not exist');
        }

        // Check 5: Bookings table
        console.log('\n4️⃣  Checking bookings table...');
        const bookingsRes = await client.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'bookings')");
        if (bookingsRes.rows[0].exists) {
            console.log('   ✅ Bookings table exists');
        } else {
            console.log('   ❌ Bookings table does not exist');
        }

        client.release();
        await pool.end();
        console.log('\n✅ Verification complete.');
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
}

verifyDatabase();
