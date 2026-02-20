-- Electrospot Database Schema for AWS RDS MySQL
-- Run this script to create the database structure

-- Create database (if not exists)
CREATE DATABASE IF NOT EXISTS electrospot CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE electrospot;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Charging stations table
CREATE TABLE IF NOT EXISTS charging_stations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    status ENUM('available', 'occupied', 'maintenance', 'inactive') DEFAULT 'available',
    connector_type VARCHAR(50),
    power_output_kw DECIMAL(5, 2),
    price_per_kwh DECIMAL(5, 2),
    operating_hours VARCHAR(100),
    amenities TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_location (latitude, longitude),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    station_id INT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    status ENUM('active', 'completed', 'cancelled') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cancelled_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (station_id) REFERENCES charging_stations(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_station (station_id),
    INDEX idx_status (status),
    INDEX idx_start_time (start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vehicles table (optional)
CREATE TABLE IF NOT EXISTS vehicles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    make VARCHAR(100),
    model VARCHAR(100),
    year INT,
    battery_capacity_kwh DECIMAL(5, 2),
    max_charging_rate_kw DECIMAL(5, 2),
    license_plate VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sample data for testing (optional)
INSERT INTO charging_stations (name, address, latitude, longitude, status, connector_type, power_output_kw, price_per_kwh) VALUES
('ElectroSpot Station 1', '123 Main Street, City Center', 28.6139, 77.2090, 'available', 'CCS2', 50.00, 0.15),
('ElectroSpot Station 2', '456 Park Avenue, Downtown', 28.7041, 77.1025, 'available', 'CHAdeMO', 25.00, 0.12),
('ElectroSpot Station 3', '789 Tech Hub, Business District', 28.5355, 77.3910, 'available', 'Type 2', 22.00, 0.10);

