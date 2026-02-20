-- Electrospot Database Schema for Supabase PostgreSQL
-- Run this script in your Supabase SQL Editor to create the tables

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Charging stations table
CREATE TABLE IF NOT EXISTS charging_stations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'inactive')),
    connector_type VARCHAR(50),
    power_output_kw DECIMAL(5, 2),
    price_per_kwh DECIMAL(5, 2),
    operating_hours VARCHAR(100),
    amenities TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for location and status
CREATE INDEX IF NOT EXISTS idx_stations_location ON charging_stations (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_stations_status ON charging_stations (status);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    station_id INTEGER NOT NULL REFERENCES charging_stations(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    -- Add indexes
    CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES users(id),
    CONSTRAINT fk_station FOREIGN KEY(station_id) REFERENCES charging_stations(id)
);

CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings (user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_station ON bookings (station_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status);
CREATE INDEX IF NOT EXISTS idx_bookings_start_time ON bookings (start_time);

-- Vehicles table (optional, consistent with previous schema)
CREATE TABLE IF NOT EXISTS vehicles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    make VARCHAR(100),
    model VARCHAR(100),
    year INTEGER,
    battery_capacity_kwh DECIMAL(5, 2),
    max_charging_rate_kw DECIMAL(5, 2),
    license_plate VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vehicles_user ON vehicles (user_id);

-- Sample data for testing
INSERT INTO charging_stations (name, address, latitude, longitude, status, connector_type, power_output_kw, price_per_kwh) VALUES
('ElectroSpot Station 1', '123 Main Street, City Center', 28.6139, 77.2090, 'available', 'CCS2', 50.00, 0.15),
('ElectroSpot Station 2', '456 Park Avenue, Downtown', 28.7041, 77.1025, 'available', 'CHAdeMO', 25.00, 0.12),
('ElectroSpot Station 3', '789 Tech Hub, Business District', 28.5355, 77.3910, 'available', 'Type 2', 22.00, 0.10);

-- Trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stations_updated_at
    BEFORE UPDATE ON charging_stations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- User Preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    food_preference VARCHAR(255),
    min_rating_filter DECIMAL(2, 1) DEFAULT 4.0,
    silent_mode BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trips table
CREATE TABLE IF NOT EXISTS trips (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
    start_location_lat DECIMAL(10, 8) NOT NULL,
    start_location_lng DECIMAL(11, 8) NOT NULL,
    destination_lat DECIMAL(10, 8) NOT NULL,
    destination_lng DECIMAL(11, 8) NOT NULL,
    battery_start_pct INTEGER NOT NULL,
    battery_current_pct INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trip Waypoints (for suggestions and actual stops)
CREATE TABLE IF NOT EXISTS trip_waypoints (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    station_id INTEGER REFERENCES charging_stations(id),
    type VARCHAR(50) CHECK (type IN ('suggested_stop', 'actual_stop')),
    suggestion_message TEXT,
    charge_duration_mins INTEGER,
    arrival_battery_pct INTEGER,
    departure_battery_pct INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trips_user ON trips (user_id);
CREATE INDEX IF NOT EXISTS idx_trip_waypoints_trip ON trip_waypoints (trip_id);

CREATE TRIGGER update_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trips_updated_at
    BEFORE UPDATE ON trips
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
