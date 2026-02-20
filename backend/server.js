/**
 * Backend API Server for Electrospot
 * Connects to Supabase PostgreSQL Database
 * 
 * Requirements:
 * - Node.js 18+
 * - PostgreSQL database (Supabase)
 * 
 * Installation:
 * npm install express pg cors dotenv jsonwebtoken bcryptjs
 * 
 * Run:
 * node server.js
 */

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import Trip utilities
const { searchExternalStations } = require('./utils/serper');
const { evaluateSmartSuggestions } = require('./utils/trip_logic');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
// Configure CORS for web and mobile access
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    // In development, allow all origins
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    // In production, specify allowed origins
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : [];

    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.length === 0) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposedHeaders: ['Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json());

// ==================== Database Connection ====================

/**
 * Create PostgreSQL connection pool
 */
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

const pool = new Pool({
  ...poolConfig,
  max: 10, // Max clients in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Test database connection
pool.connect()
  .then(client => {
    console.log('✅ Connected to Supabase PostgreSQL database');
    client.release();
  })
  .catch(err => {
    console.error('❌ Database connection error:', err.message);
  });

// ==================== Middleware ====================

/**
 * Authentication middleware
 * Verifies JWT token from Authorization header
 */
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    req.isAdmin = decoded.isAdmin || false;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Admin authentication middleware
 */
const authenticateAdmin = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (!req.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
};

// ==================== Authentication Routes ====================

/**
 * POST /auth/register
 * Register a new user
 */
app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    // Validate phone number
    if (!phone || phone === null || phone === undefined || phone === '') {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const phoneTrimmed = String(phone).trim();

    if (phoneTrimmed === '' || phoneTrimmed.length === 0) {
      return res.status(400).json({ error: 'Phone number cannot be empty' });
    }

    // Validate phone number format (at least 10 digits)
    const digitsOnly = phoneTrimmed.replace(/[^\d+]/g, '').replace(/\+/g, '');
    if (digitsOnly.length < 10) {
      return res.status(400).json({ error: 'Phone number must be at least 10 digits' });
    }

    // Check if user already exists
    const existingUsers = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUsers.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user
    // PostgreSQL uses RETURNING * to get the inserted row
    const result = await pool.query(
      'INSERT INTO users (name, email, password, phone, is_admin, created_at) VALUES ($1, $2, $3, $4, FALSE, NOW()) RETURNING id, name, email, phone, is_admin',
      [name, email, hashedPassword, phoneTrimmed]
    );

    const newUser = result.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { userId: newUser.id, email: email, isAdmin: false },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token: token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone
      }
    });
  } catch (error) {
    console.error('Registration error:', error.message);

    // Check key constraint violations (23505 is unique_violation)
    if (error.code === '23505') {
      return res.status(400).json({ error: 'User with this email or phone already exists' });
    }

    if (error.code === '23502') { // not_null_violation
      return res.status(400).json({
        error: 'Missing required fields'
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

/**
 * POST /auth/login
 * Login user
 */
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const users = await pool.query(
      'SELECT id, name, email, password, is_admin FROM users WHERE email = $1',
      [email]
    );

    if (users.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = users.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, isAdmin: user.is_admin },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token: token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isAdmin: user.is_admin
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /auth/logout
 * Logout user (token is handled client-side, but endpoint exists for consistency)
 */
app.post('/auth/logout', authenticateToken, (req, res) => {
  res.json({ message: 'Logout successful' });
});

// ==================== Charging Stations Routes ====================

/**
 * GET /stations
 * Get all charging stations
 */
app.get('/stations', async (req, res) => {
  try {
    const stations = await pool.query(
      "SELECT * FROM charging_stations WHERE status != 'inactive' ORDER BY name"
    );
    res.json(stations.rows);
  } catch (error) {
    console.error('Error fetching stations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /stations/:id
 * Get charging station by ID
 */
app.get('/stations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const stations = await pool.query(
      'SELECT * FROM charging_stations WHERE id = $1',
      [id]
    );

    if (stations.rows.length === 0) {
      return res.status(404).json({ error: 'Station not found' });
    }

    res.json(stations.rows[0]);
  } catch (error) {
    console.error('Error fetching station:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /stations/search
 * Search stations by location (latitude, longitude, radius)
 */
app.get('/stations/search', async (req, res) => {
  try {
    const { latitude, longitude, radius = 10 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    // Calculate distance using standard Haversine formula in SQL
    // Filtering is done via where clause instead of HAVING to be safer with aliasing
    const query = `
      SELECT * FROM (
        SELECT *,
          (6371 * acos(
            cos(radians($1)) * 
            cos(radians(latitude)) * 
            cos(radians(longitude) - radians($2)) + 
            sin(radians($1)) * 
            sin(radians(latitude))
          )) AS distance
        FROM charging_stations
        WHERE status != 'inactive'
      ) AS filtered_stations
      WHERE distance <= $3
      ORDER BY distance
      LIMIT 50
    `;

    const stations = await pool.query(query, [parseFloat(latitude), parseFloat(longitude), parseFloat(radius)]);

    let results = stations.rows;

    // If we have few results from our database, trigger external search via Serper
    if (results.length < 5) {
      try {
        console.log(`🔍 Low result count (${results.length}). Triggering external discovery via Serper...`);
        const externalStations = await searchExternalStations(latitude, longitude, radius);

        // Merge results: only add external stations if they are not already in our DB (basic name matching)
        const dbNames = new Set(results.map(s => s.name.toLowerCase()));
        const uniqueExternal = externalStations.filter(s => !dbNames.has(s.name.toLowerCase()));

        results = [...results, ...uniqueExternal];
        console.log(`✅ Added ${uniqueExternal.length} external stations.`);
      } catch (externalError) {
        console.error('⚠️ External search failed:', externalError.message);
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Error searching stations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== Bookings Routes ====================

/**
 * POST /bookings
 * Create a new booking
 */
app.post('/bookings', authenticateToken, async (req, res) => {
  try {
    const { station_id, start_time, duration } = req.body;

    if (!station_id || !start_time) {
      return res.status(400).json({ error: 'Station ID and start time are required' });
    }

    // Verify station exists
    const stations = await pool.query(
      'SELECT id, status FROM charging_stations WHERE id = $1',
      [station_id]
    );

    if (stations.rows.length === 0) {
      return res.status(404).json({ error: 'Station not found' });
    }

    if (stations.rows[0].status !== 'available') {
      return res.status(400).json({ error: 'Station is not available' });
    }

    // Create booking
    const endTime = duration
      ? new Date(new Date(start_time).getTime() + duration * 60000)
      : null;

    const result = await pool.query(
      "INSERT INTO bookings (user_id, station_id, start_time, end_time, status, created_at) VALUES ($1, $2, $3, $4, 'active', NOW()) RETURNING id",
      [req.userId, station_id, start_time, endTime]
    );

    const bookingId = result.rows[0].id;

    // Update station status
    await pool.query(
      "UPDATE charging_stations SET status = 'occupied' WHERE id = $1",
      [station_id]
    );

    res.status(201).json({
      message: 'Booking created successfully',
      booking: {
        id: bookingId,
        user_id: req.userId,
        station_id: station_id,
        start_time: start_time,
        end_time: endTime,
        status: 'active'
      }
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /bookings
 * Get user's bookings
 */
app.get('/bookings', authenticateToken, async (req, res) => {
  try {
    const bookings = await pool.query(
      `SELECT b.*, cs.name as station_name, cs.address, cs.latitude, cs.longitude
       FROM bookings b
       JOIN charging_stations cs ON b.station_id = cs.id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC`,
      [req.userId]
    );

    res.json(bookings.rows);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /bookings/:id
 * Cancel a booking
 */
app.delete('/bookings/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get booking
    const bookings = await pool.query(
      'SELECT * FROM bookings WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );

    if (bookings.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookings.rows[0];

    // Cancel booking
    await pool.query(
      "UPDATE bookings SET status = 'cancelled', cancelled_at = NOW() WHERE id = $1",
      [id]
    );

    // Update station status back to available
    await pool.query(
      "UPDATE charging_stations SET status = 'available' WHERE id = $1",
      [booking.station_id]
    );

    res.json({ message: 'Booking cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== User Profile Routes ====================

/**
 * GET /users/profile
 * Get user profile
 */
app.get('/users/profile', authenticateToken, async (req, res) => {
  try {
    const users = await pool.query(
      'SELECT id, name, email, phone, created_at FROM users WHERE id = $1',
      [req.userId]
    );

    if (users.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(users.rows[0]);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /users/profile
 * Update user profile
 */
app.put('/users/profile', authenticateToken, async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const updates = [];
    const values = [];
    let queryIndex = 1;

    if (name) {
      updates.push(`name = $${queryIndex++}`);
      values.push(name);
    }
    if (email) {
      updates.push(`email = $${queryIndex++}`);
      values.push(email);
    }
    if (phone) {
      updates.push(`phone = $${queryIndex++}`);
      values.push(phone);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.userId);

    await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${queryIndex}`,
      values
    );

    // Get updated user
    const users = await pool.query(
      'SELECT id, name, email, phone FROM users WHERE id = $1',
      [req.userId]
    );

    res.json(users.rows[0]);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== Admin Routes ====================

/**
 * GET /admin/stats
 * Get system statistics
 */
app.get('/admin/stats', authenticateAdmin, async (req, res) => {
  try {
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    const stationCount = await pool.query('SELECT COUNT(*) FROM charging_stations');
    const bookingCount = await pool.query('SELECT COUNT(*) FROM bookings');
    const activeBookingCount = await pool.query("SELECT COUNT(*) FROM bookings WHERE status = 'active'");

    res.json({
      totalUsers: parseInt(userCount.rows[0].count),
      totalStations: parseInt(stationCount.rows[0].count),
      totalBookings: parseInt(bookingCount.rows[0].count),
      activeBookings: parseInt(activeBookingCount.rows[0].count)
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /admin/users
 * Get all users
 */
app.get('/admin/users', authenticateAdmin, async (req, res) => {
  try {
    const users = await pool.query(
      'SELECT id, name, email, phone, is_admin, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(users.rows);
  } catch (error) {
    console.error('Error fetching admin users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /admin/stations
 * Create a new station
 */
app.post('/admin/stations', authenticateAdmin, async (req, res) => {
  try {
    const { name, address, latitude, longitude, connector_type, power_output_kw, price_per_kwh } = req.body;

    const result = await pool.query(
      'INSERT INTO charging_stations (name, address, latitude, longitude, status, connector_type, power_output_kw, price_per_kwh, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING *',
      [name, address, latitude, longitude, 'available', connector_type, power_output_kw, price_per_kwh]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating station:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /admin/stations/:id
 * Update a station
 */
app.put('/admin/stations/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, latitude, longitude, status, connector_type, power_output_kw, price_per_kwh } = req.body;

    const result = await pool.query(
      'UPDATE charging_stations SET name = $1, address = $2, latitude = $3, longitude = $4, status = $5, connector_type = $6, power_output_kw = $7, price_per_kwh = $8, updated_at = NOW() WHERE id = $9 RETURNING *',
      [name, address, latitude, longitude, status, connector_type, power_output_kw, price_per_kwh, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Station not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating station:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /admin/stations/:id
 * Delete a station
 */
app.delete('/admin/stations/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM charging_stations WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Station not found' });
    }

    res.json({ message: 'Station deleted successfully' });
  } catch (error) {
    console.error('Error deleting station:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /admin/bookings
 * Get all bookings
 */
app.get('/admin/bookings', authenticateAdmin, async (req, res) => {
  try {
    const bookings = await pool.query(
      `SELECT b.*, u.name as user_name, u.email as user_email, cs.name as station_name 
       FROM bookings b
       JOIN users u ON b.user_id = u.id
       JOIN charging_stations cs ON b.station_id = cs.id
       ORDER BY b.created_at DESC`
    );
    res.json(bookings.rows);
  } catch (error) {
    console.error('Error fetching admin bookings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== Trip Planner Routes ====================

/**
 * POST /trips/plan
 * Create a new trip plan
 */
app.post('/trips/plan', authenticateToken, async (req, res) => {
  try {
    const {
      start_location,
      destination,
      battery_start_pct,
      vehicle_id
    } = req.body;

    if (!start_location || !destination || battery_start_pct === undefined) {
      return res.status(400).json({ error: 'Start location, destination, and battery level are required' });
    }

    const result = await pool.query(
      `INSERT INTO trips (
        user_id, vehicle_id, 
        start_location_lat, start_location_lng, 
        destination_lat, destination_lng, 
        battery_start_pct, battery_current_pct, 
        status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', NOW()) RETURNING *`,
      [
        req.userId,
        vehicle_id || null,
        start_location.lat, start_location.lng,
        destination.lat, destination.lng,
        battery_start_pct,
        battery_start_pct
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error planning trip:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /trips/:id/update
 * Update live trip state and get AI suggestions
 */
app.post('/trips/:id/update', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { current_location, battery_current_pct } = req.body;

    if (!current_location || battery_current_pct === undefined) {
      return res.status(400).json({ error: 'Current location and battery level are required' });
    }

    // Get trip
    const trips = await pool.query(
      'SELECT * FROM trips WHERE id = $1 AND user_id = $2 AND status = $3',
      [id, req.userId, 'active']
    );

    if (trips.rows.length === 0) {
      return res.status(404).json({ error: 'Active trip not found' });
    }

    const trip = trips.rows[0];

    // Update trip state
    await pool.query(
      'UPDATE trips SET battery_current_pct = $1, updated_at = NOW() WHERE id = $2',
      [battery_current_pct, id]
    );

    // Evaluate AI Suggestions
    const suggestion = await evaluateSmartSuggestions(trip, current_location, battery_current_pct);

    if (suggestion) {
      // Record suggestion in waypoints
      await pool.query(
        `INSERT INTO trip_waypoints (
          trip_id, station_id, type, suggestion_message, charge_duration_mins
        ) VALUES ($1, $2, 'suggested_stop', $3, $4)`,
        [id, suggestion.station.id.startsWith('ext_') ? null : suggestion.station.id, suggestion.message, suggestion.chargeDuration]
      );
    }

    res.json({
      trip_id: id,
      suggestion: suggestion || null
    });
  } catch (error) {
    console.error('Error updating trip:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /trips/active
 * Get current active trip
 */
app.get('/trips/active', authenticateToken, async (req, res) => {
  try {
    const trips = await pool.query(
      'SELECT * FROM trips WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 1',
      [req.userId, 'active']
    );

    if (trips.rows.length === 0) {
      return res.json(null);
    }

    // Get waypoints for this trip
    const trip = trips.rows[0];
    const waypoints = await pool.query(
      'SELECT * FROM trip_waypoints WHERE trip_id = $1 ORDER BY created_at ASC',
      [trip.id]
    );

    res.json({
      ...trip,
      waypoints: waypoints.rows
    });
  } catch (error) {
    console.error('Error fetching active trip:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== User Preferences Routes ====================

app.get('/users/preferences', authenticateToken, async (req, res) => {
  try {
    const prefs = await pool.query('SELECT * FROM user_preferences WHERE user_id = $1', [req.userId]);
    res.json(prefs.rows[0] || {});
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/users/preferences', authenticateToken, async (req, res) => {
  try {
    const { food_preference, min_rating_filter, silent_mode } = req.body;
    const result = await pool.query(
      `INSERT INTO user_preferences (user_id, food_preference, min_rating_filter, silent_mode, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
       food_preference = EXCLUDED.food_preference,
       min_rating_filter = EXCLUDED.min_rating_filter,
       silent_mode = EXCLUDED.silent_mode,
       updated_at = NOW()
       RETURNING *`,
      [req.userId, food_preference, min_rating_filter, silent_mode]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== Health Check ====================

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', database: 'disconnected', error: error.message });
  }
});

// ==================== Error Handling ====================
/**
 * 404 Route handler
 */
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

/**
 * Global Error Handler
 */
app.use((err, req, res, next) => {
  console.error(`Status [${err.status || 500}] - Error: ${err.message}`);

  // Only reveal stack trace in development
  const isProd = process.env.NODE_ENV === 'production';

  res.status(err.status || 500).json({
    error: isProd ? 'Internal Server Error' : err.message,
    ...(!isProd && { stack: err.stack })
  });
});

// ==================== Start Server ====================

// Listen on all network interfaces (0.0.0.0) to allow mobile devices to connect
// Use 'localhost' or '127.0.0.1' if you only want local access
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}`);
  console.log(`📡 Local network: http://${getLocalIP()}:${PORT}`);
  console.log(`\n💡 For mobile testing, use your computer's IP address:`);
  console.log(`   Find it with: ipconfig (Windows) or ifconfig (Mac/Linux)`);
});

// Helper function to get local IP address
function getLocalIP() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

