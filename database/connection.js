const { Pool } = require('pg');
require('dotenv').config({ path: '../config.env' });

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'school_events',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'hansco',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Test the connection
pool.on('connect', () => {
    console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('❌ Database connection error:', err);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
}; 