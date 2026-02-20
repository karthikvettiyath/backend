/**
 * Seeding script to add real EV Charging Stations in Kerala
 * Data compiled from KSEB and private operators
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 6543,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }
});

const stations = [
    {
        name: 'KSEB Charging Station, Kollam',
        address: 'KSEB Substation, Kollam, Kerala',
        latitude: 8.892695,
        longitude: 76.579025,
        status: 'available',
        connector_type: 'CCS2',
        power_output_kw: 60.00,
        price_per_kwh: 15.00
    },
    {
        name: 'KSEB Charging station, Kottiyam',
        address: 'KSEB Substation, Kottiyam, Kerala',
        latitude: 8.866431,
        longitude: 76.668811,
        status: 'available',
        connector_type: 'CCS2',
        power_output_kw: 60.00,
        price_per_kwh: 15.00
    },
    {
        name: 'KSEB DC Fast Charger, Vadakkencherry',
        address: 'Vadakkencherry-Padur Rd, Kerala',
        latitude: 10.597527,
        longitude: 76.479811,
        status: 'available',
        connector_type: 'CCS2',
        power_output_kw: 60.00,
        price_per_kwh: 15.00
    },
    {
        name: 'KSEB Thrissur (Ollur)',
        address: 'Edakunni, Ollur, Thrissur, Kerala',
        latitude: 10.466909,
        longitude: 76.245362,
        status: 'available',
        connector_type: 'CCS2',
        power_output_kw: 50.00,
        price_per_kwh: 15.00
    },
    {
        name: 'KSEB Substation North Paravur',
        address: 'Mannam, North Paravur, Kerala',
        latitude: 10.144840,
        longitude: 76.256968,
        status: 'available',
        connector_type: 'CCS2',
        power_output_kw: 50.00,
        price_per_kwh: 15.00
    },
    {
        name: 'KSEB Slow charging, Kanjirappally',
        address: 'KSEB Section Office, Kanjirappally, Kerala',
        latitude: 9.553856,
        longitude: 76.790459,
        status: 'available',
        connector_type: 'Type 2',
        power_output_kw: 22.00,
        price_per_kwh: 12.00
    },
    {
        name: 'KSEB Malappuram',
        address: 'Munduparamba, Malappuram, Kerala',
        latitude: 11.053869,
        longitude: 76.091654,
        status: 'available',
        connector_type: 'CCS2',
        power_output_kw: 60.00,
        price_per_kwh: 15.00
    },
    {
        name: 'ChargeMOD Manikkal',
        address: 'Pirappancode, Manikkal, Thiruvananthapuram, Kerala',
        latitude: 8.651840,
        longitude: 76.928014,
        status: 'available',
        connector_type: 'CCS2',
        power_output_kw: 60.00,
        price_per_kwh: 18.00
    }
];

async function seed() {
    console.log('🌱 Starting database seed (Kerala EV Stations)...');

    try {
        const client = await pool.connect();

        // Optional: Clear existing mock stations to avoid clutter
        // await client.query("DELETE FROM charging_stations WHERE name LIKE 'ElectroSpot Station%'");

        for (const station of stations) {
            const query = `
        INSERT INTO charging_stations (name, address, latitude, longitude, status, connector_type, power_output_kw, price_per_kwh)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT DO NOTHING
        RETURNING id
      `;

            const values = [
                station.name,
                station.address,
                station.latitude,
                station.longitude,
                station.status,
                station.connector_type,
                station.power_output_kw,
                station.price_per_kwh
            ];

            const res = await client.query(query, values);
            if (res.rows.length > 0) {
                console.log(`✅ Added: ${station.name}`);
            } else {
                console.log(`ℹ️  Skipped (likely exists): ${station.name}`);
            }
        }

        client.release();
        console.log('✨ Seeding complete!');
    } catch (err) {
        console.error('❌ Seeding error:', err.message);
    } finally {
        await pool.end();
    }
}

seed();
