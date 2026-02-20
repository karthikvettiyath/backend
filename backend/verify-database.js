/**
 * Verify Database Setup for Hosting (PostgreSQL)
 * Run: node verify-database.js
 */

require('dotenv').config();
const { Pool } = require('pg');

async function verifyDatabase() {
  console.log('🔍 Verifying PostgreSQL Database Setup for Hosting...\n');

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
      database: process.env.DB_NAME || 'postgres',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    };

  const pool = new Pool(poolConfig);

  const checks = {
    connection: false,
    usersTable: false,
    phoneColumn: false,
    phoneNotNull: false,
    stationsTable: false,
    bookingsTable: false
  };

  try {
    // Check 1: Database Connection
    console.log('1️⃣  Testing database connection...');
    const client = await pool.connect();
    console.log('   ✅ Connected to database');
    checks.connection = true;

    // Check 2: Users table
    console.log('\n2️⃣  Checking users table...');
    const usersRes = await client.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users')");
    if (usersRes.rows[0].exists) {
      console.log('   ✅ Users table exists');
      checks.usersTable = true;

      // Check 3: Phone column
      console.log('\n3️⃣  Checking phone column...');
      const phoneRes = await client.query(`
        SELECT column_name, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'phone'
      `);

      if (phoneRes.rows.length > 0) {
        console.log('   ✅ Phone column exists');
        checks.phoneColumn = true;

        // Check 4: Phone column is NOT NULL
        if (phoneRes.rows[0].is_nullable === 'NO') {
          console.log('   ✅ Phone column is NOT NULL');
          checks.phoneNotNull = true;
        } else {
          console.log('   ❌ Phone column allows NULL - Run fix-phone-column.js');
        }
      } else {
        console.log('   ❌ Phone column does not exist');
      }

      // Check for NULL phones
      const nullRes = await client.query(
        "SELECT COUNT(*) as count FROM users WHERE phone IS NULL OR phone = ''"
      );
      if (parseInt(nullRes.rows[0].count) > 0) {
        console.log(`   ⚠️  Warning: ${nullRes.rows[0].count} users have NULL/empty phone numbers`);
      } else {
        console.log('   ✅ No NULL phone numbers found');
      }
    } else {
      console.log('   ❌ Users table does not exist');
    }

    // Check 5: Charging stations table
    console.log('\n4️⃣  Checking charging_stations table...');
    const stationsRes = await client.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'charging_stations')");
    if (stationsRes.rows[0].exists) {
      console.log('   ✅ Charging stations table exists');
      checks.stationsTable = true;
    } else {
      console.log('   ❌ Charging stations table does not exist');
    }

    // Check 6: Bookings table
    console.log('\n5️⃣  Checking bookings table...');
    const bookingsRes = await client.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'bookings')");
    if (bookingsRes.rows[0].exists) {
      console.log('   ✅ Bookings table exists');
      checks.bookingsTable = true;
    } else {
      console.log('   ❌ Bookings table does not exist');
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 VERIFICATION SUMMARY');
    console.log('='.repeat(50));
    const allChecks = Object.values(checks);
    const passedChecks = allChecks.filter(check => check).length;
    const totalChecks = allChecks.length;

    Object.entries(checks).forEach(([check, passed]) => {
      console.log(`   ${passed ? '✅' : '❌'} ${check}`);
    });

    console.log(`\n   Results: ${passedChecks}/${totalChecks} checks passed\n`);

    if (passedChecks === totalChecks) {
      console.log('✅ All checks passed! Database is ready for hosting.');
    } else {
      console.log('⚠️  Some checks failed. Please fix the issues above.');
    }

    client.release();
    await pool.end();
    process.exit(passedChecks === totalChecks ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

verifyDatabase();
