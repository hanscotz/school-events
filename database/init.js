const db = require('./connection');

const initDatabase = async () => {
    try {
        console.log('🚀 Initializing database...');

        // Create users table
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                role VARCHAR(20) DEFAULT 'parent',
                phone VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Add profile_pic column to users if not exists
        await db.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'profile_pic'
                ) THEN
                    ALTER TABLE users ADD COLUMN profile_pic VARCHAR(255);
                END IF;
            END $$;
        `);

        // Create students table
        await db.query(`
            CREATE TABLE IF NOT EXISTS students (
                id SERIAL PRIMARY KEY,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                grade VARCHAR(20) NOT NULL,
                section VARCHAR(10),
                parent_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                date_of_birth DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create events table
        await db.query(`
            CREATE TABLE IF NOT EXISTS events (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                event_type VARCHAR(100) NOT NULL,
                location VARCHAR(255) NOT NULL,
                start_date TIMESTAMP NOT NULL,
                end_date TIMESTAMP NOT NULL,
                fee DECIMAL(10,2) DEFAULT 0.00,
                max_participants INTEGER,
                current_participants INTEGER DEFAULT 0,
                status VARCHAR(20) DEFAULT 'active',
                created_by INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create event_registrations table
        await db.query(`
            CREATE TABLE IF NOT EXISTS event_registrations (
                id SERIAL PRIMARY KEY,
                event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
                student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
                parent_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                payment_status VARCHAR(20) DEFAULT 'pending',
                payment_amount DECIMAL(10,2),
                status VARCHAR(20) DEFAULT 'registered',
                notes TEXT
            )
        `);

        // Create notifications table
        await db.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                type VARCHAR(50) DEFAULT 'info',
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create email_logs table
        await db.query(`
            CREATE TABLE IF NOT EXISTS email_logs (
                id SERIAL PRIMARY KEY,
                recipient_email VARCHAR(255) NOT NULL,
                subject VARCHAR(255) NOT NULL,
                content TEXT NOT NULL,
                status VARCHAR(20) DEFAULT 'sent',
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Feedback table
        await db.query(`
            CREATE TABLE IF NOT EXISTS feedback (
                id SERIAL PRIMARY KEY,
                parent_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                message TEXT NOT NULL,
                rating INTEGER CHECK (rating >= 1 AND rating <= 5),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                featured BOOLEAN DEFAULT FALSE
            );
        `);

        // Insert default admin user
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash('admin123', 10);
        
        await db.query(`
            INSERT INTO users (email, password, first_name, last_name, role)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (email) DO NOTHING
        `, ['admin@school.com', hashedPassword, 'Admin', 'User', 'admin']);

        // Insert sample events
        await db.query(`
            INSERT INTO events (title, description, event_type, location, start_date, end_date, fee, max_participants)
            VALUES 
            ('Annual Sports Day', 'Annual sports competition with various athletic events', 'Sports', 'School Ground', '2024-03-15 09:00:00', '2024-03-15 16:00:00', 25.00, 200),
            ('Science Fair', 'Students showcase their scientific projects and innovations', 'Academic', 'School Auditorium', '2024-03-20 10:00:00', '2024-03-20 15:00:00', 15.00, 150),
            ('Cultural Festival', 'Annual cultural celebration with music, dance, and drama', 'Cultural', 'School Auditorium', '2024-03-25 18:00:00', '2024-03-25 22:00:00', 30.00, 300),
            ('Parent-Teacher Meeting', 'Quarterly meeting to discuss student progress', 'Meeting', 'Classrooms', '2024-03-30 14:00:00', '2024-03-30 17:00:00', 0.00, 500)
            ON CONFLICT DO NOTHING
        `);

        console.log('✅ Database initialized successfully!');
        console.log('📧 Default admin user created: admin@school.com / admin123');
        console.log('🎓 Sample events added to the system');

    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        process.exit(1);
    }
};

// Run initialization if this file is executed directly
if (require.main === module) {
    initDatabase().then(() => {
        process.exit(0);
    });
}

module.exports = { initDatabase }; 