/**
 * Script to verify and fix phone column in users table for PostgreSQL
 * This ensures the phone column is NOT NULL and has the correct constraint
 * Run: node fix-phone-column.js
 */

require('dotenv').config();
const { Pool } = require('pg');

async function fixPhoneColumn() {
  console.log('🔧 Checking and fixing phone column (PostgreSQL)...\n');

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

  if (!poolConfig.host && !poolConfig.connectionString) {
    console.error('❌ Error: Database credentials not found in environment variables');
    console.error('   Please set DB_HOST or DATABASE_URL in your .env file');
    process.exit(1);
  }

  const pool = new Pool(poolConfig);

  try {
    const client = await pool.connect();
    console.log('✅ Connected to database\n');

    // Check current table structure
    console.log('📋 Checking current table structure...');
    const columnRes = await client.query(`
      SELECT column_name, is_nullable, data_type, character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'phone'
    `);

    if (columnRes.rows.length === 0) {
      console.error('❌ Phone column not found in users table!');
      client.release();
      await pool.end();
      process.exit(1);
    }

    const phoneColumn = columnRes.rows[0];
    console.log('Current phone column:', JSON.stringify(phoneColumn, null, 2));
    console.log('Phone allows NULL?', phoneColumn.is_nullable === 'YES' ? 'YES ❌' : 'NO ✅');
    console.log('Phone type:', phoneColumn.data_type);
    console.log('');

    // Check for existing NULL phone values
    const nullRes = await client.query(
      "SELECT COUNT(*) as count FROM users WHERE phone IS NULL OR phone = ''"
    );
    const nullCount = parseInt(nullRes.rows[0].count);
    console.log(`Found ${nullCount} users with NULL or empty phone numbers\n`);

    if (nullCount > 0) {
      console.log('⚠️  Warning: Found users with NULL or empty phone numbers');
      console.log('   These need to be fixed before making the column NOT NULL\n');

      // Show users with NULL phones
      const nullUsersRes = await client.query(
        "SELECT id, name, email, phone FROM users WHERE phone IS NULL OR phone = '' LIMIT 10"
      );
      console.log('Users with NULL/empty phones:');
      nullUsersRes.rows.forEach(user => {
        console.log(`  - ID: ${user.id}, Name: ${user.name}, Email: ${user.email}, Phone: ${user.phone || '(NULL)'}`);
      });
      console.log('');

      // Fix NULL phone values first
      console.log('🔧 Fixing NULL phone values...');
      const updateResult = await client.query(
        "UPDATE users SET phone = 'PENDING_' || id WHERE phone IS NULL OR phone = ''"
      );
      console.log(`✅ Updated ${updateResult.rowCount} users with placeholder phone numbers\n`);
    }

    // Make phone column NOT NULL if it's not already
    if (phoneColumn.is_nullable === 'YES') {
      console.log('🔧 Making phone column NOT NULL...');
      await client.query('ALTER TABLE users ALTER COLUMN phone SET NOT NULL');
      console.log('✅ Phone column is now NOT NULL\n');
    } else {
      console.log('✅ Phone column is already NOT NULL\n');
    }

    // Verify the change
    const updatedRes = await client.query(`
      SELECT is_nullable FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'phone'
    `);
    console.log('Phone allows NULL?', updatedRes.rows[0].is_nullable === 'YES' ? 'YES ❌' : 'NO ✅');
    console.log('');

    // Final check for NULL phones
    const finalRes = await client.query(
      'SELECT COUNT(*) as count FROM users WHERE phone IS NULL'
    );
    console.log(`Final check: ${finalRes.rows[0].count} users with NULL phone numbers (should be 0)`);

    if (parseInt(finalRes.rows[0].count) === 0) {
      console.log('\n✅ SUCCESS: All phone numbers are set and column is NOT NULL!');
    } else {
      console.log('\n⚠️  WARNING: There are still NULL phone numbers in the database');
    }

    client.release();
    await pool.end();
    console.log('\n✅ Script completed!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

fixPhoneColumn();
