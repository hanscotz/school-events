const db = require('./connection');
const bcrypt = require('bcryptjs');

const setupNewDatabase = async () => {
    try {
        console.log('🚀 Setting up enhanced database for new computer...');
        console.log('📋 This will create a fresh database with:');
        console.log('   - Enhanced security features');
        console.log('   - Properly hashed passwords');
        console.log('   - Sample data for testing');
        console.log('');

        // Drop existing tables if they exist (for fresh start)
        console.log('🧹 Cleaning up existing tables...');
        const dropQueries = [
            'DROP TABLE IF EXISTS audit_logs CASCADE',
            'DROP TABLE IF EXISTS sessions CASCADE',
            'DROP TABLE IF EXISTS payments CASCADE',
            'DROP TABLE IF EXISTS feedback CASCADE',
            'DROP TABLE IF EXISTS email_logs CASCADE',
            'DROP TABLE IF EXISTS notifications CASCADE',
            'DROP TABLE IF EXISTS event_registrations CASCADE',
            'DROP TABLE IF EXISTS events CASCADE',
            'DROP TABLE IF EXISTS students CASCADE',
            'DROP TABLE IF EXISTS users CASCADE',
            'DROP TABLE IF EXISTS event_categories CASCADE'
        ];

        for (const query of dropQueries) {
            try {
                await db.query(query);
            } catch (error) {
                console.log(`Warning: ${error.message}`);
            }
        }

        // Enable UUID extension
        console.log('🔧 Enabling UUID extension...');
        await db.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

        // Create enhanced users table
        console.log('👥 Creating users table...');
        await db.query(`
            CREATE TABLE users (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                role VARCHAR(20) DEFAULT 'parent' CHECK (role IN ('admin', 'parent', 'teacher')),
                phone VARCHAR(20),
                profile_pic VARCHAR(255),
                is_active BOOLEAN DEFAULT TRUE,
                email_verified BOOLEAN DEFAULT FALSE,
                email_verification_token VARCHAR(255),
                password_reset_token VARCHAR(255),
                password_reset_expires TIMESTAMP,
                last_login TIMESTAMP,
                login_attempts INTEGER DEFAULT 0,
                locked_until TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create students table
        console.log('🎓 Creating students table...');
        await db.query(`
            CREATE TABLE students (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                student_id VARCHAR(20) UNIQUE NOT NULL,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                grade VARCHAR(20) NOT NULL CHECK (grade IN ('FORM I', 'FORM II', 'FORM III', 'FORM IV', 'FORM V', 'FORM VI')),
                section VARCHAR(10),
                class_teacher_id UUID REFERENCES users(id),
                parent_id UUID REFERENCES users(id) ON DELETE SET NULL,
                date_of_birth DATE NOT NULL,
                gender VARCHAR(10) CHECK (gender IN ('Male', 'Female', 'Other')),
                address TEXT,
                emergency_contact VARCHAR(20),
                medical_info TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                parent_approved BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create events table
        console.log('📅 Creating events table...');
        await db.query(`
            CREATE TABLE events (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                title VARCHAR(255) NOT NULL,
                description TEXT,
                event_type VARCHAR(100) NOT NULL,
                category VARCHAR(50),
                location VARCHAR(255) NOT NULL,
                start_date TIMESTAMP NOT NULL,
                end_date TIMESTAMP NOT NULL,
                registration_deadline TIMESTAMP,
                fee DECIMAL(10,2) DEFAULT 0.00,
                max_participants INTEGER,
                current_participants INTEGER DEFAULT 0,
                min_age INTEGER,
                max_age INTEGER,
                status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'completed', 'draft')),
                is_featured BOOLEAN DEFAULT FALSE,
                image_url VARCHAR(255),
                created_by UUID REFERENCES users(id),
                approved_by UUID REFERENCES users(id),
                approved_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT valid_dates CHECK (end_date > start_date)
            )
        `);

        // Create event registrations table
        console.log('📝 Creating event registrations table...');
        await db.query(`
            CREATE TABLE event_registrations (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                event_id UUID REFERENCES events(id) ON DELETE CASCADE,
                student_id UUID REFERENCES students(id) ON DELETE CASCADE,
                teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,
                parent_id UUID REFERENCES users(id) ON DELETE CASCADE,
                registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                parent_notified BOOLEAN DEFAULT FALSE,
                parent_notification_date TIMESTAMP,
                payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'cancelled', 'refunded')),
                payment_amount DECIMAL(10,2),
                payment_method VARCHAR(50),
                payment_reference VARCHAR(255),
                payment_date TIMESTAMP,
                status VARCHAR(20) DEFAULT 'registered' CHECK (status IN ('registered', 'cancelled', 'attended', 'no_show')),
                attendance_confirmed BOOLEAN DEFAULT FALSE,
                attendance_date TIMESTAMP,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(event_id, student_id)
            )
        `);

        // Create notifications table
        console.log('🔔 Creating notifications table...');
        await db.query(`
            CREATE TABLE notifications (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                type VARCHAR(50) DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error', 'reminder')),
                category VARCHAR(50) DEFAULT 'general' CHECK (category IN ('general', 'event', 'payment', 'system', 'reminder')),
                is_read BOOLEAN DEFAULT FALSE,
                read_at TIMESTAMP,
                action_url VARCHAR(255),
                expires_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create email logs table
        console.log('📧 Creating email logs table...');
        await db.query(`
            CREATE TABLE email_logs (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                recipient_email VARCHAR(255) NOT NULL,
                recipient_name VARCHAR(255),
                subject VARCHAR(255) NOT NULL,
                content TEXT NOT NULL,
                template_used VARCHAR(100),
                status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'bounced', 'delivered')),
                error_message TEXT,
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                delivered_at TIMESTAMP,
                opened_at TIMESTAMP,
                clicked_at TIMESTAMP
            )
        `);

        // Create feedback table
        console.log('💬 Creating feedback table...');
        await db.query(`
            CREATE TABLE feedback (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                parent_id UUID REFERENCES users(id) ON DELETE CASCADE,
                event_id UUID REFERENCES events(id) ON DELETE SET NULL,
                message TEXT NOT NULL,
                rating INTEGER CHECK (rating >= 1 AND rating <= 5),
                category VARCHAR(50) DEFAULT 'general' CHECK (category IN ('general', 'event', 'system', 'suggestion')),
                status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'featured')),
                moderated_by UUID REFERENCES users(id),
                moderated_at TIMESTAMP,
                moderation_notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create payments table
        console.log('💰 Creating payments table...');
        await db.query(`
            CREATE TABLE payments (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                registration_id UUID REFERENCES event_registrations(id) ON DELETE CASCADE,
                amount DECIMAL(10,2) NOT NULL,
                currency VARCHAR(3) DEFAULT 'USD',
                payment_method VARCHAR(50) NOT NULL,
                payment_reference VARCHAR(255),
                transaction_id VARCHAR(255),
                status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'refunded')),
                gateway_response TEXT,
                processed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create event categories table
        console.log('🏷️  Creating event categories table...');
        await db.query(`
            CREATE TABLE event_categories (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(100) UNIQUE NOT NULL,
                description TEXT,
                color VARCHAR(7) DEFAULT '#6f42c1',
                icon VARCHAR(50),
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create classes table
        console.log('🏫 Creating classes table...');
        await db.query(`
            CREATE TABLE classes (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(100) NOT NULL,
                grade VARCHAR(20) NOT NULL CHECK (grade IN ('FORM I', 'FORM II', 'FORM III', 'FORM IV', 'FORM V', 'FORM VI')),
                section VARCHAR(10) NOT NULL,
                class_teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
                academic_year VARCHAR(20) NOT NULL,
                max_students INTEGER DEFAULT 40,
                current_students INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(grade, section, academic_year)
            )
        `);

        // Create parent registration requests table
        console.log('📝 Creating parent registration requests table...');
        await db.query(`
            CREATE TABLE parent_registration_requests (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                email VARCHAR(255) UNIQUE NOT NULL,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                phone VARCHAR(20),
                request_message TEXT,
                student_names TEXT[],
                status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
                reviewed_by UUID REFERENCES users(id),
                reviewed_at TIMESTAMP,
                rejection_reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create SMS logs table
        console.log('📱 Creating SMS logs table...');
        await db.query(`
            CREATE TABLE sms_logs (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                recipient_phone VARCHAR(20) NOT NULL,
                recipient_name VARCHAR(255),
                message TEXT NOT NULL,
                template_used VARCHAR(100),
                status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'delivered')),
                error_message TEXT,
                cost DECIMAL(10,4),
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                delivered_at TIMESTAMP
            )
        `);

        // Create audit logs table
        console.log('📋 Creating audit logs table...');
        await db.query(`
            CREATE TABLE audit_logs (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                action VARCHAR(100) NOT NULL,
                table_name VARCHAR(50),
                record_id UUID,
                old_values JSONB,
                new_values JSONB,
                ip_address INET,
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create sessions table
        console.log('🔐 Creating sessions table...');
        await db.query(`
            CREATE TABLE sessions (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                session_token VARCHAR(255) UNIQUE NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                ip_address INET,
                user_agent TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create indexes for performance
        console.log('⚡ Creating indexes...');
        const indexQueries = [
            'CREATE INDEX idx_users_email ON users(email)',
            'CREATE INDEX idx_users_role ON users(role)',
            'CREATE INDEX idx_users_active ON users(is_active)',
            'CREATE INDEX idx_students_parent_id ON students(parent_id)',
            'CREATE INDEX idx_students_grade ON students(grade)',
            'CREATE INDEX idx_students_student_id ON students(student_id)',
            'CREATE INDEX idx_events_start_date ON events(start_date)',
            'CREATE INDEX idx_events_status ON events(status)',
            'CREATE INDEX idx_events_type ON events(event_type)',
            'CREATE INDEX idx_events_created_by ON events(created_by)',
            'CREATE INDEX idx_registrations_event_id ON event_registrations(event_id)',
            'CREATE INDEX idx_registrations_student_id ON event_registrations(student_id)',
            'CREATE INDEX idx_registrations_parent_id ON event_registrations(parent_id)',
            'CREATE INDEX idx_registrations_payment_status ON event_registrations(payment_status)',
            'CREATE INDEX idx_notifications_user_id ON notifications(user_id)',
            'CREATE INDEX idx_notifications_read ON notifications(is_read)',
            'CREATE INDEX idx_notifications_type ON notifications(type)',
            'CREATE INDEX idx_email_logs_recipient ON email_logs(recipient_email)',
            'CREATE INDEX idx_email_logs_status ON email_logs(status)',
            'CREATE INDEX idx_email_logs_sent_at ON email_logs(sent_at)',
            'CREATE INDEX idx_feedback_parent_id ON feedback(parent_id)',
            'CREATE INDEX idx_feedback_status ON feedback(status)',
            'CREATE INDEX idx_feedback_rating ON feedback(rating)',
            'CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id)',
            'CREATE INDEX idx_audit_logs_action ON audit_logs(action)',
            'CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at)',
            'CREATE INDEX idx_sessions_token ON sessions(session_token)',
            'CREATE INDEX idx_sessions_user_id ON sessions(user_id)',
            'CREATE INDEX idx_sessions_expires ON sessions(expires_at)'
        ];

        for (const query of indexQueries) {
            try {
                await db.query(query);
            } catch (error) {
                console.log(`Warning creating index: ${error.message}`);
            }
        }

        // Create trigger function for updated_at
        console.log('🔄 Creating triggers...');
        await db.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql'
        `);

        // Create triggers
        const triggerQueries = [
            'CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
            'CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
            'CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
            'CREATE TRIGGER update_event_registrations_updated_at BEFORE UPDATE ON event_registrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
            'CREATE TRIGGER update_feedback_updated_at BEFORE UPDATE ON feedback FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
            'CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()'
        ];

        for (const query of triggerQueries) {
            try {
                await db.query(query);
            } catch (error) {
                console.log(`Warning creating trigger: ${error.message}`);
            }
        }

        // Insert default event categories
        console.log('📂 Adding event categories...');
        await db.query(`
            INSERT INTO event_categories (name, description, color, icon) VALUES
            ('Academic', 'Educational and learning events', '#28a745', 'bi-book'),
            ('Sports', 'Athletic and physical activities', '#dc3545', 'bi-trophy'),
            ('Cultural', 'Arts, music, and cultural events', '#ffc107', 'bi-music-note'),
            ('Social', 'Social gatherings and celebrations', '#17a2b8', 'bi-people'),
            ('Meeting', 'Parent-teacher and administrative meetings', '#6f42c1', 'bi-calendar-event')
            ON CONFLICT (name) DO NOTHING
        `);

        // Create default users with properly hashed passwords
        console.log('👤 Creating default users with hashed passwords...');
        
        // Admin user
        const adminPassword = 'admin123';
        const adminHashedPassword = await bcrypt.hash(adminPassword, 12);
        
        await db.query(`
            INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, email_verified)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (email) DO UPDATE SET 
                password_hash = EXCLUDED.password_hash,
                is_active = EXCLUDED.is_active,
                email_verified = EXCLUDED.email_verified
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
                ON CONFLICT (email) DO UPDATE SET 
                    password_hash = EXCLUDED.password_hash,
                    is_active = EXCLUDED.is_active
            `, [parent.email, hashedParentPassword, parent.firstName, parent.lastName, 'parent', true, true]);
        }

        // Teacher users
        console.log('👨‍🏫 Adding sample teachers...');
        const teacherData = [
            { email: 'teacher1@school.com', firstName: 'Emily', lastName: 'Davis', password: 'teacher123', phone: '+1234567891' },
            { email: 'teacher2@school.com', firstName: 'Robert', lastName: 'Wilson', password: 'teacher456', phone: '+1234567892' },
            { email: 'teacher3@school.com', firstName: 'Maria', lastName: 'Garcia', password: 'teacher789', phone: '+1234567893' }
        ];

        for (const teacher of teacherData) {
            const hashedTeacherPassword = await bcrypt.hash(teacher.password, 12);
            await db.query(`
                INSERT INTO users (email, password_hash, first_name, last_name, role, phone, is_active, email_verified)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (email) DO UPDATE SET 
                    password_hash = EXCLUDED.password_hash,
                    is_active = EXCLUDED.is_active
            `, [teacher.email, hashedTeacherPassword, teacher.firstName, teacher.lastName, 'teacher', teacher.phone, true, true]);
        }

        // Create sample classes and assign teachers
        console.log('🏫 Adding sample classes...');
        const teacherEmails = ['teacher1@school.com', 'teacher2@school.com', 'teacher3@school.com'];
        const classData = [
            { name: 'Form 1A', grade: 'FORM I', section: 'A', teacherEmail: teacherEmails[0] },
            { name: 'Form 2A', grade: 'FORM II', section: 'A', teacherEmail: teacherEmails[1] },
            { name: 'Form 3A', grade: 'FORM III', section: 'A', teacherEmail: teacherEmails[2] }
        ];

        for (const classInfo of classData) {
            // Get teacher ID
            const teacherResult = await db.query('SELECT id FROM users WHERE email = $1', [classInfo.teacherEmail]);
            if (teacherResult.rows.length > 0) {
                const teacherId = teacherResult.rows[0].id;
                await db.query(`
                    INSERT INTO classes (name, grade, section, class_teacher_id, academic_year)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (grade, section, academic_year) DO NOTHING
                `, [classInfo.name, classInfo.grade, classInfo.section, teacherId, '2024-2025']);
            }
        }

        // Create sample students
        console.log('🎓 Adding sample students...');
        const studentData = [
            { studentId: 'STU001', firstName: 'Alice', lastName: 'Doe', grade: 'FORM I', parentEmail: 'parent1@example.com' },
            { studentId: 'STU002', firstName: 'Bob', lastName: 'Doe', grade: 'FORM II', parentEmail: 'parent1@example.com' },
            { studentId: 'STU003', firstName: 'Charlie', lastName: 'Smith', grade: 'FORM III', parentEmail: 'parent2@example.com' },
            { studentId: 'STU004', firstName: 'Diana', lastName: 'Johnson', grade: 'FORM IV', parentEmail: 'parent3@example.com' }
        ];

        // First, let's get teacher IDs for assignment
        const teacherIds = await db.query('SELECT id, email FROM users WHERE role = $1', ['teacher']);
        const teacherMap = {};
        teacherIds.rows.forEach(teacher => {
            teacherMap[teacher.email] = teacher.id;
        });

        for (const student of studentData) {
            const parentResult = await db.query('SELECT id FROM users WHERE email = $1', [student.parentEmail]);
            if (parentResult.rows.length > 0) {
                const parentId = parentResult.rows[0].id;
                // Assign teacher based on grade
                let teacherId = null;
                if (student.grade === 'FORM I') teacherId = teacherMap['teacher1@school.com'];
                else if (student.grade === 'FORM II') teacherId = teacherMap['teacher2@school.com'];
                else if (student.grade === 'FORM III') teacherId = teacherMap['teacher3@school.com'];
                else teacherId = teacherMap['teacher1@school.com']; // Default

                await db.query(`
                    INSERT INTO students (student_id, first_name, last_name, grade, section, class_teacher_id, parent_id, date_of_birth, gender, is_active, parent_approved)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    ON CONFLICT (student_id) DO NOTHING
                `, [
                    student.studentId,
                    student.firstName,
                    student.lastName,
                    student.grade,
                    'A', // Default section
                    teacherId,
                    parentId,
                    '2010-01-01',
                    'Male',
                    true,
                    true
                ]);
            }
        }

        // Create sample events
        console.log('📅 Adding sample events...');
        const eventData = [
            {
                title: 'Annual Sports Day',
                description: 'Annual sports competition with various athletic events including track and field, swimming, and team sports.',
                eventType: 'Sports',
                category: 'Sports',
                location: 'School Ground',
                startDate: '2024-03-15 09:00:00',
                endDate: '2024-03-15 16:00:00',
                registrationDeadline: '2024-03-10 23:59:59',
                fee: 25.00,
                maxParticipants: 200,
                isFeatured: true
            },
            {
                title: 'Science Fair 2024',
                description: 'Students showcase their scientific projects and innovations. Categories include Physics, Chemistry, Biology, and Technology.',
                eventType: 'Academic',
                category: 'Academic',
                location: 'School Auditorium',
                startDate: '2024-03-20 10:00:00',
                endDate: '2024-03-20 15:00:00',
                registrationDeadline: '2024-03-15 23:59:59',
                fee: 15.00,
                maxParticipants: 150,
                isFeatured: true
            },
            {
                title: 'Cultural Festival',
                description: 'Annual cultural celebration featuring music, dance, drama, and art exhibitions from different cultures.',
                eventType: 'Cultural',
                category: 'Cultural',
                location: 'School Auditorium',
                startDate: '2024-03-25 18:00:00',
                endDate: '2024-03-25 22:00:00',
                registrationDeadline: '2024-03-20 23:59:59',
                fee: 30.00,
                maxParticipants: 300,
                isFeatured: false
            },
            {
                title: 'Parent-Teacher Meeting',
                description: 'Quarterly meeting to discuss student progress, academic performance, and future goals.',
                eventType: 'Meeting',
                category: 'Meeting',
                location: 'Classrooms',
                startDate: '2024-03-30 14:00:00',
                endDate: '2024-03-30 17:00:00',
                registrationDeadline: '2024-03-28 23:59:59',
                fee: 0.00,
                maxParticipants: 500,
                isFeatured: false
            },
            {
                title: 'Mathematics Olympiad',
                description: 'Competitive mathematics competition for students of all grades with prizes and recognition.',
                eventType: 'Academic',
                category: 'Academic',
                location: 'Computer Lab',
                startDate: '2024-04-05 09:00:00',
                endDate: '2024-04-05 12:00:00',
                registrationDeadline: '2024-04-01 23:59:59',
                fee: 20.00,
                maxParticipants: 100,
                isFeatured: true
            }
        ];

        const adminResult = await db.query('SELECT id FROM users WHERE email = $1', ['admin@school.com']);
        const adminId = adminResult.rows[0].id;

        for (const event of eventData) {
            await db.query(`
                INSERT INTO events (
                    title, description, event_type, category, location, 
                    start_date, end_date, registration_deadline, fee, 
                    max_participants, is_featured, created_by, approved_by, approved_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                ON CONFLICT DO NOTHING
            `, [
                event.title,
                event.description,
                event.eventType,
                event.category,
                event.location,
                event.startDate,
                event.endDate,
                event.registrationDeadline,
                event.fee,
                event.maxParticipants,
                event.isFeatured,
                adminId,
                adminId,
                new Date()
            ]);
        }

        // Create sample feedback
        console.log('💬 Adding sample feedback...');
        const feedbackData = [
            {
                parentEmail: 'parent1@example.com',
                message: 'The sports day was amazing! My children had a great time and the organization was excellent.',
                rating: 5,
                category: 'event'
            },
            {
                parentEmail: 'parent2@example.com',
                message: 'The science fair was very educational. My child learned a lot from the projects.',
                rating: 4,
                category: 'event'
            },
            {
                parentEmail: 'parent3@example.com',
                message: 'Great communication from the school about events. The email notifications are very helpful.',
                rating: 5,
                category: 'general'
            }
        ];

        for (const feedback of feedbackData) {
            const parentResult = await db.query('SELECT id FROM users WHERE email = $1', [feedback.parentEmail]);
            if (parentResult.rows.length > 0) {
                const parentId = parentResult.rows[0].id;
                await db.query(`
                    INSERT INTO feedback (parent_id, message, rating, category, status)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT DO NOTHING
                `, [parentId, feedback.message, feedback.rating, feedback.category, 'approved']);
            }
        }

        // Create sample notifications
        console.log('🔔 Adding sample notifications...');
        const notificationData = [
            {
                userEmail: 'parent1@example.com',
                title: 'Welcome to School Events!',
                message: 'Thank you for joining our school events platform. You can now register your children for upcoming events.',
                type: 'success',
                category: 'system'
            },
            {
                userEmail: 'parent2@example.com',
                title: 'New Event Available',
                message: 'A new event "Mathematics Olympiad" has been added. Check it out!',
                type: 'info',
                category: 'event'
            }
        ];

        for (const notification of notificationData) {
            const userResult = await db.query('SELECT id FROM users WHERE email = $1', [notification.userEmail]);
            if (userResult.rows.length > 0) {
                const userId = userResult.rows[0].id;
                await db.query(`
                    INSERT INTO notifications (user_id, title, message, type, category)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT DO NOTHING
                `, [userId, notification.title, notification.message, notification.type, notification.category]);
            }
        }

        console.log('');
        console.log('🎉 Enhanced database setup completed successfully!');
        console.log('');
        console.log('🔐 Security features enabled:');
        console.log('   ✅ UUID primary keys for better security');
        console.log('   ✅ BCrypt password hashing (12 salt rounds)');
        console.log('   ✅ Login attempt tracking and account lockout');
        console.log('   ✅ Email verification system');
        console.log('   ✅ Password reset functionality');
        console.log('   ✅ Audit logging for sensitive operations');
        console.log('   ✅ Session management');
        console.log('');
        console.log('👤 Default users created with hashed passwords:');
        console.log('   🔑 Admin: admin@school.com / admin123');
        console.log('   👨‍🏫 Teacher 1: teacher1@school.com / teacher123');
        console.log('   👨‍🏫 Teacher 2: teacher2@school.com / teacher456');
        console.log('   👨‍🏫 Teacher 3: teacher3@school.com / teacher789');
        console.log('   👨‍👩‍👧‍👦 Parent 1: parent1@example.com / parent123');
        console.log('   👨‍👩‍👧‍👦 Parent 2: parent2@example.com / parent456');
        console.log('   👨‍👩‍👧‍👦 Parent 3: parent3@example.com / parent789');
        console.log('');
        console.log('📊 Sample data added:');
        console.log('   - 4 students across different grades');
        console.log('   - 5 events with various categories');
        console.log('   - 3 feedback entries');
        console.log('   - 2 notifications');
        console.log('');
        console.log('🚀 Your enhanced database is ready for production use!');
        console.log('');
        console.log('💡 Next steps:');
        console.log('   1. Start your application: npm start');
        console.log('   2. Test the login with the provided credentials');
        console.log('   3. Explore the admin dashboard');
        console.log('   4. Test parent registration and event management');

    } catch (error) {
        console.error('❌ Database setup failed:', error);
        throw error;
    }
};

// Run setup if this file is executed directly
if (require.main === module) {
    setupNewDatabase()
        .then(() => {
            console.log('Database setup completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Database setup failed:', error);
            process.exit(1);
        });
}

module.exports = { setupNewDatabase }; 