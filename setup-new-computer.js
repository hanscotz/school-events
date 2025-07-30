const db = require('./database/connection');
const bcrypt = require('bcryptjs');

const setupNewComputer = async () => {
    try {
        console.log('🚀 Setting up database for new computer...');
        
        // Drop existing tables for fresh start
        console.log('🧹 Cleaning existing tables...');
        await db.query('DROP TABLE IF EXISTS feedback, event_registrations, events, students, users CASCADE');
        
        // Create users table with enhanced security
        console.log('👥 Creating users table...');
        await db.query(`
            CREATE TABLE users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                role VARCHAR(20) DEFAULT 'parent',
                phone VARCHAR(20),
                profile_pic VARCHAR(255),
                is_active BOOLEAN DEFAULT TRUE,
                email_verified BOOLEAN DEFAULT FALSE,
                login_attempts INTEGER DEFAULT 0,
                locked_until TIMESTAMP,
                last_login TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create students table
        console.log('🎓 Creating students table...');
        await db.query(`
            CREATE TABLE students (
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
        console.log('📅 Creating events table...');
        await db.query(`
            CREATE TABLE events (
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

        // Create event registrations table
        console.log('📝 Creating event registrations table...');
        await db.query(`
            CREATE TABLE event_registrations (
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

        // Create feedback table
        console.log('💬 Creating feedback table...');
        await db.query(`
            CREATE TABLE feedback (
                id SERIAL PRIMARY KEY,
                parent_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                message TEXT NOT NULL,
                rating INTEGER CHECK (rating >= 1 AND rating <= 5),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                featured BOOLEAN DEFAULT FALSE
            )
        `);

        // Create default users with properly hashed passwords
        console.log('👤 Creating default users with hashed passwords...');
        
        // Admin user
        const adminPassword = 'admin123';
        const adminHashedPassword = await bcrypt.hash(adminPassword, 12);
        
        await db.query(`
            INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, email_verified)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, ['admin@school.com', adminHashedPassword, 'System', 'Administrator', 'admin', true, true]);

        // Parent users
        const parentPasswords = ['parent123', 'parent456', 'parent789'];
        const parentData = [
            { email: 'parent1@example.com', firstName: 'John', lastName: 'Doe', password: parentPasswords[0] },
            { email: 'parent2@example.com', firstName: 'Jane', lastName: 'Smith', password: parentPasswords[1] },
            { email: 'parent3@example.com', firstName: 'Mike', lastName: 'Johnson', password: parentPasswords[2] }
        ];

        for (const parent of parentData) {
            const hashedParentPassword = await bcrypt.hash(parent.password, 12);
            await db.query(`
                INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, email_verified)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [parent.email, hashedParentPassword, parent.firstName, parent.lastName, 'parent', true, true]);
        }

        // Create sample students
        console.log('🎓 Adding sample students...');
        const studentData = [
            { firstName: 'Alice', lastName: 'Doe', grade: 'FORM I', parentEmail: 'parent1@example.com' },
            { firstName: 'Bob', lastName: 'Doe', grade: 'FORM II', parentEmail: 'parent1@example.com' },
            { firstName: 'Charlie', lastName: 'Smith', grade: 'FORM III', parentEmail: 'parent2@example.com' },
            { firstName: 'Diana', lastName: 'Johnson', grade: 'FORM IV', parentEmail: 'parent3@example.com' }
        ];

        for (const student of studentData) {
            const parentResult = await db.query('SELECT id FROM users WHERE email = $1', [student.parentEmail]);
            if (parentResult.rows.length > 0) {
                const parentId = parentResult.rows[0].id;
                await db.query(`
                    INSERT INTO students (first_name, last_name, grade, parent_id, date_of_birth)
                    VALUES ($1, $2, $3, $4, $5)
                `, [student.firstName, student.lastName, student.grade, parentId, '2010-01-01']);
            }
        }

        // Create sample events
        console.log('📅 Adding sample events...');
        const eventData = [
            {
                title: 'Annual Sports Day',
                description: 'Annual sports competition with various athletic events',
                eventType: 'Sports',
                location: 'School Ground',
                startDate: '2024-03-15 09:00:00',
                endDate: '2024-03-15 16:00:00',
                fee: 25.00,
                maxParticipants: 200
            },
            {
                title: 'Science Fair',
                description: 'Students showcase their scientific projects and innovations',
                eventType: 'Academic',
                location: 'School Auditorium',
                startDate: '2024-03-20 10:00:00',
                endDate: '2024-03-20 15:00:00',
                fee: 15.00,
                maxParticipants: 150
            },
            {
                title: 'Cultural Festival',
                description: 'Annual cultural celebration with music, dance, and drama',
                eventType: 'Cultural',
                location: 'School Auditorium',
                startDate: '2024-03-25 18:00:00',
                endDate: '2024-03-25 22:00:00',
                fee: 30.00,
                maxParticipants: 300
            },
            {
                title: 'Parent-Teacher Meeting',
                description: 'Quarterly meeting to discuss student progress',
                eventType: 'Meeting',
                location: 'Classrooms',
                startDate: '2024-03-30 14:00:00',
                endDate: '2024-03-30 17:00:00',
                fee: 0.00,
                maxParticipants: 500
            }
        ];

        const adminResult = await db.query('SELECT id FROM users WHERE email = $1', ['admin@school.com']);
        const adminId = adminResult.rows[0].id;

        for (const event of eventData) {
            await db.query(`
                INSERT INTO events (title, description, event_type, location, start_date, end_date, fee, max_participants, created_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
                event.title,
                event.description,
                event.eventType,
                event.location,
                event.startDate,
                event.endDate,
                event.fee,
                event.maxParticipants,
                adminId
            ]);
        }

        // Create sample feedback
        console.log('💬 Adding sample feedback...');
        const feedbackData = [
            {
                parentEmail: 'parent1@example.com',
                message: 'The sports day was amazing! My children had a great time and the organization was excellent.',
                rating: 5
            },
            {
                parentEmail: 'parent2@example.com',
                message: 'The science fair was very educational. My child learned a lot from the projects.',
                rating: 4
            },
            {
                parentEmail: 'parent3@example.com',
                message: 'Great communication from the school about events. The email notifications are very helpful.',
                rating: 5
            }
        ];

        for (const feedback of feedbackData) {
            const parentResult = await db.query('SELECT id FROM users WHERE email = $1', [feedback.parentEmail]);
            if (parentResult.rows.length > 0) {
                const parentId = parentResult.rows[0].id;
                await db.query(`
                    INSERT INTO feedback (parent_id, message, rating, featured)
                    VALUES ($1, $2, $3, $4)
                `, [parentId, feedback.message, feedback.rating, true]);
            }
        }

        console.log('');
        console.log('🎉 Database setup completed successfully!');
        console.log('');
        console.log('🔐 Security features enabled:');
        console.log('   ✅ BCrypt password hashing (12 salt rounds)');
        console.log('   ✅ Login attempt tracking');
        console.log('   ✅ Account lockout protection');
        console.log('   ✅ Email verification system');
        console.log('');
        console.log('👤 Default users created with hashed passwords:');
        console.log('   🔑 Admin: admin@school.com / admin123');
        console.log('   👨‍👩‍👧‍👦 Parent 1: parent1@example.com / parent123');
        console.log('   👨‍👩‍👧‍👦 Parent 2: parent2@example.com / parent456');
        console.log('   👨‍👩‍👧‍👦 Parent 3: parent3@example.com / parent789');
        console.log('');
        console.log('📊 Sample data added:');
        console.log('   - 4 students across different grades');
        console.log('   - 4 events with various types');
        console.log('   - 3 feedback entries');
        console.log('');
        console.log('🚀 Your database is ready! Start your application with: npm start');

    } catch (error) {
        console.error('❌ Database setup failed:', error);
        throw error;
    }
};

// Run setup
setupNewComputer()
    .then(() => {
        console.log('Setup completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Setup failed:', error);
        process.exit(1);
    }); 