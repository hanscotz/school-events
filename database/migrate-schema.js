const db = require('./connection');

const migrateSchema = async () => {
    try {
        console.log('🔄 Migrating database schema...');

        // Add missing columns to students table
        console.log('📝 Adding missing columns to students table...');
        try {
            await db.query('ALTER TABLE students ADD COLUMN IF NOT EXISTS class_teacher_id UUID REFERENCES users(id)');
            await db.query('ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_approved BOOLEAN DEFAULT FALSE');
            await db.query('ALTER TABLE students ADD COLUMN IF NOT EXISTS section VARCHAR(10)');
            console.log('✅ Students table updated');
        } catch (error) {
            console.log('Warning: Some student columns may already exist:', error.message);
        }

        // Add missing columns to event_registrations table
        console.log('📝 Adding missing columns to event_registrations table...');
        try {
            await db.query('ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES users(id)');
            await db.query('ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS parent_notified BOOLEAN DEFAULT FALSE');
            await db.query('ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS parent_notification_date TIMESTAMP');
            console.log('✅ Event registrations table updated');
        } catch (error) {
            console.log('Warning: Some event registration columns may already exist:', error.message);
        }

        // Add class targeting columns to events table for teacher requests
        console.log('📝 Adding class targeting columns to events table...');
        try {
            await db.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS class_grade VARCHAR(20)");
            await db.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS class_section VARCHAR(10)");
            console.log('✅ Events table updated');
        } catch (error) {
            console.log('Warning: Some event columns may already exist:', error.message);
        }

        // Create missing tables
        console.log('🏫 Creating classes table if not exists...');
        try {
            await db.query(`
                CREATE TABLE IF NOT EXISTS classes (
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
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ Classes table ready');
        } catch (error) {
            console.log('Warning: Classes table issue:', error.message);
        }

        console.log('📝 Creating parent registration requests table if not exists...');
        try {
            await db.query(`
                CREATE TABLE IF NOT EXISTS parent_registration_requests (
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
            console.log('✅ Parent registration requests table ready');
        } catch (error) {
            console.log('Warning: Parent registration requests table issue:', error.message);
        }

        console.log('📱 Creating SMS logs table if not exists...');
        try {
            await db.query(`
                CREATE TABLE IF NOT EXISTS sms_logs (
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
            console.log('✅ SMS logs table ready');
        } catch (error) {
            console.log('Warning: SMS logs table issue:', error.message);
        }

        // Add sample teachers if they don't exist
        console.log('👨‍🏫 Adding sample teachers...');
        const bcrypt = require('bcryptjs');
        
        const teacherData = [
            { email: 'teacher1@school.com', firstName: 'Emily', lastName: 'Davis', password: 'teacher123', phone: '+1234567891' },
            { email: 'teacher2@school.com', firstName: 'Robert', lastName: 'Wilson', password: 'teacher456', phone: '+1234567892' },
            { email: 'teacher3@school.com', firstName: 'Maria', lastName: 'Garcia', password: 'teacher789', phone: '+1234567893' }
        ];

        for (const teacher of teacherData) {
            try {
                const existingTeacher = await db.query('SELECT id FROM users WHERE email = $1', [teacher.email]);
                if (existingTeacher.rows.length === 0) {
                    const hashedPassword = await bcrypt.hash(teacher.password, 12);
                    await db.query(`
                        INSERT INTO users (email, password_hash, first_name, last_name, role, phone, is_active, email_verified)
                        VALUES ($1, $2, $3, $4, 'teacher', $5, true, true)
                    `, [teacher.email, hashedPassword, teacher.firstName, teacher.lastName, teacher.phone]);
                    console.log(`✅ Created teacher: ${teacher.email}`);
                } else {
                    console.log(`✅ Teacher already exists: ${teacher.email}`);
                }
            } catch (error) {
                console.log(`Warning: Error with teacher ${teacher.email}:`, error.message);
            }
        }

        // Create sample classes
        console.log('🏫 Adding sample classes...');
        const classData = [
            { name: 'Form 1A', grade: 'FORM I', section: 'A', teacherEmail: 'teacher1@school.com' },
            { name: 'Form 2A', grade: 'FORM II', section: 'A', teacherEmail: 'teacher2@school.com' },
            { name: 'Form 3A', grade: 'FORM III', section: 'A', teacherEmail: 'teacher3@school.com' }
        ];

        for (const classInfo of classData) {
            try {
                const teacherResult = await db.query('SELECT id FROM users WHERE email = $1', [classInfo.teacherEmail]);
                if (teacherResult.rows.length > 0) {
                    const teacherId = teacherResult.rows[0].id;
                    const existingClass = await db.query(
                        'SELECT id FROM classes WHERE grade = $1 AND section = $2 AND academic_year = $3',
                        [classInfo.grade, classInfo.section, '2024-2025']
                    );
                    
                    if (existingClass.rows.length === 0) {
                        await db.query(`
                            INSERT INTO classes (name, grade, section, class_teacher_id, academic_year)
                            VALUES ($1, $2, $3, $4, '2024-2025')
                        `, [classInfo.name, classInfo.grade, classInfo.section, teacherId]);
                        console.log(`✅ Created class: ${classInfo.name}`);
                    } else {
                        console.log(`✅ Class already exists: ${classInfo.name}`);
                    }
                }
            } catch (error) {
                console.log(`Warning: Error with class ${classInfo.name}:`, error.message);
            }
        }

        // Update students with class teachers
        console.log('👥 Assigning students to class teachers...');
        try {
            // Get teacher IDs
            const teacherIds = await db.query('SELECT id, email FROM users WHERE role = $1', ['teacher']);
            const teacherMap = {};
            teacherIds.rows.forEach(teacher => {
                teacherMap[teacher.email] = teacher.id;
            });

            // Update students without class teachers
            await db.query(`
                UPDATE students 
                SET class_teacher_id = $1, section = 'A', parent_approved = true
                WHERE grade = 'FORM I' AND class_teacher_id IS NULL
            `, [teacherMap['teacher1@school.com']]);

            await db.query(`
                UPDATE students 
                SET class_teacher_id = $1, section = 'A', parent_approved = true
                WHERE grade = 'FORM II' AND class_teacher_id IS NULL
            `, [teacherMap['teacher2@school.com']]);

            await db.query(`
                UPDATE students 
                SET class_teacher_id = $1, section = 'A', parent_approved = true
                WHERE grade = 'FORM III' AND class_teacher_id IS NULL
            `, [teacherMap['teacher3@school.com']]);

            await db.query(`
                UPDATE students 
                SET class_teacher_id = $1, section = 'A', parent_approved = true
                WHERE grade = 'FORM IV' AND class_teacher_id IS NULL
            `, [teacherMap['teacher1@school.com']]);

            console.log('✅ Students assigned to class teachers');
        } catch (error) {
            console.log('Warning: Error assigning students to teachers:', error.message);
        }

        console.log('');
        console.log('🎉 Database migration completed successfully!');
        console.log('');
        console.log('👨‍🏫 Sample teachers available:');
        console.log('   🔑 Teacher 1: teacher1@school.com / teacher123');
        console.log('   🔑 Teacher 2: teacher2@school.com / teacher456');
        console.log('   🔑 Teacher 3: teacher3@school.com / teacher789');
        console.log('');
        console.log('✅ Admin can now create teachers and manage users properly!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
};

// Run migration if this file is executed directly
if (require.main === module) {
    migrateSchema()
        .then(() => {
            console.log('Migration completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}

module.exports = migrateSchema;
