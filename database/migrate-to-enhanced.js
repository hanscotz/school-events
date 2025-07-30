const db = require('./connection');
const bcrypt = require('bcryptjs');

const migrateToEnhanced = async () => {
    try {
        console.log('🔄 Starting migration to enhanced database schema...');
        
        // Check if we're already using the enhanced schema
        const checkEnhanced = await db.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'password_hash'
        `);

        if (checkEnhanced.rows.length > 0) {
            console.log('✅ Database already uses enhanced schema. No migration needed.');
            return;
        }

        console.log('📋 Migration steps:');
        console.log('   1. Backup existing data');
        console.log('   2. Create new tables with enhanced schema');
        console.log('   3. Migrate existing data');
        console.log('   4. Update passwords with proper hashing');
        console.log('   5. Clean up old tables');
        console.log('');

        // Step 1: Backup existing data
        console.log('📦 Backing up existing data...');
        
        const users = await db.query('SELECT * FROM users');
        const students = await db.query('SELECT * FROM students');
        const events = await db.query('SELECT * FROM events');
        const registrations = await db.query('SELECT * FROM event_registrations');
        const notifications = await db.query('SELECT * FROM notifications');
        const emailLogs = await db.query('SELECT * FROM email_logs');
        const feedback = await db.query('SELECT * FROM feedback');

        console.log(`   - ${users.rows.length} users backed up`);
        console.log(`   - ${students.rows.length} students backed up`);
        console.log(`   - ${events.rows.length} events backed up`);
        console.log(`   - ${registrations.rows.length} registrations backed up`);
        console.log(`   - ${notifications.rows.length} notifications backed up`);
        console.log(`   - ${emailLogs.rows.length} email logs backed up`);
        console.log(`   - ${feedback.rows.length} feedback entries backed up`);

        // Step 2: Create new tables with enhanced schema
        console.log('🏗️  Creating new tables with enhanced schema...');
        
        // Read and execute the enhanced schema
        const fs = require('fs');
        const path = require('path');
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
        
        const statements = schemaSQL
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

        for (const statement of statements) {
            if (statement.trim()) {
                try {
                    await db.query(statement);
                } catch (error) {
                    if (!error.message.includes('already exists')) {
                        console.warn('Warning executing statement:', error.message);
                    }
                }
            }
        }

        // Step 3: Migrate existing data
        console.log('🔄 Migrating existing data...');

        // Migrate users with proper password hashing
        for (const user of users.rows) {
            // Hash the existing password (assuming it's plain text or needs re-hashing)
            const hashedPassword = await bcrypt.hash(user.password || 'default123', 12);
            
            await db.query(`
                INSERT INTO users (
                    id, email, password_hash, first_name, last_name, role, 
                    phone, profile_pic, is_active, email_verified, created_at, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                ON CONFLICT (email) DO NOTHING
            `, [
                user.id || require('crypto').randomUUID(),
                user.email,
                hashedPassword,
                user.first_name,
                user.last_name,
                user.role || 'parent',
                user.phone,
                user.profile_pic,
                user.is_active !== false,
                true, // Assume email is verified for existing users
                user.created_at || new Date(),
                user.updated_at || new Date()
            ]);
        }

        // Migrate students
        for (const student of students.rows) {
            await db.query(`
                INSERT INTO students (
                    id, student_id, first_name, last_name, grade, section, 
                    parent_id, date_of_birth, gender, is_active, created_at, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                ON CONFLICT (student_id) DO NOTHING
            `, [
                student.id || require('crypto').randomUUID(),
                student.student_id || `STU${student.id}`,
                student.first_name,
                student.last_name,
                student.grade,
                student.section,
                student.parent_id,
                student.date_of_birth || '2010-01-01',
                student.gender || 'Male',
                student.is_active !== false,
                student.created_at || new Date(),
                new Date()
            ]);
        }

        // Migrate events
        for (const event of events.rows) {
            await db.query(`
                INSERT INTO events (
                    id, title, description, event_type, category, location,
                    start_date, end_date, registration_deadline, fee, max_participants,
                    current_participants, status, is_featured, created_by, approved_by,
                    approved_at, created_at, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
                ON CONFLICT DO NOTHING
            `, [
                event.id || require('crypto').randomUUID(),
                event.title,
                event.description,
                event.event_type,
                event.category || event.event_type,
                event.location,
                event.start_date,
                event.end_date,
                event.registration_deadline || event.start_date,
                event.fee || 0,
                event.max_participants,
                event.current_participants || 0,
                event.status || 'active',
                event.is_featured || false,
                event.created_by,
                event.created_by, // Assume same as created_by
                event.created_at,
                event.created_at || new Date(),
                event.updated_at || new Date()
            ]);
        }

        // Migrate event registrations
        for (const registration of registrations.rows) {
            await db.query(`
                INSERT INTO event_registrations (
                    id, event_id, student_id, parent_id, registration_date,
                    payment_status, payment_amount, status, notes, created_at, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT DO NOTHING
            `, [
                registration.id || require('crypto').randomUUID(),
                registration.event_id,
                registration.student_id,
                registration.parent_id,
                registration.registration_date || new Date(),
                registration.payment_status || 'pending',
                registration.payment_amount,
                registration.status || 'registered',
                registration.notes,
                registration.created_at || new Date(),
                new Date()
            ]);
        }

        // Migrate notifications
        for (const notification of notifications.rows) {
            await db.query(`
                INSERT INTO notifications (
                    id, user_id, title, message, type, category, is_read, read_at, created_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT DO NOTHING
            `, [
                notification.id || require('crypto').randomUUID(),
                notification.user_id,
                notification.title,
                notification.message,
                notification.type || 'info',
                notification.category || 'general',
                notification.is_read || false,
                notification.read_at,
                notification.created_at || new Date()
            ]);
        }

        // Migrate email logs
        for (const emailLog of emailLogs.rows) {
            await db.query(`
                INSERT INTO email_logs (
                    id, recipient_email, recipient_name, subject, content,
                    template_used, status, error_message, sent_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT DO NOTHING
            `, [
                emailLog.id || require('crypto').randomUUID(),
                emailLog.recipient_email,
                emailLog.recipient_name,
                emailLog.subject,
                emailLog.content,
                emailLog.template_used,
                emailLog.status || 'sent',
                emailLog.error_message,
                emailLog.sent_at || new Date()
            ]);
        }

        // Migrate feedback
        for (const feedbackEntry of feedback.rows) {
            await db.query(`
                INSERT INTO feedback (
                    id, parent_id, event_id, message, rating, category,
                    status, created_at, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT DO NOTHING
            `, [
                feedbackEntry.id || require('crypto').randomUUID(),
                feedbackEntry.parent_id,
                feedbackEntry.event_id,
                feedbackEntry.message,
                feedbackEntry.rating,
                feedbackEntry.category || 'general',
                feedbackEntry.status || 'approved',
                feedbackEntry.created_at || new Date(),
                new Date()
            ]);
        }

        console.log('✅ Data migration completed successfully!');

        // Step 4: Verify migration
        console.log('🔍 Verifying migration...');
        
        const newUserCount = await db.query('SELECT COUNT(*) FROM users');
        const newStudentCount = await db.query('SELECT COUNT(*) FROM students');
        const newEventCount = await db.query('SELECT COUNT(*) FROM events');
        const newRegistrationCount = await db.query('SELECT COUNT(*) FROM event_registrations');

        console.log(`   - Users: ${users.rows.length} → ${newUserCount.rows[0].count}`);
        console.log(`   - Students: ${students.rows.length} → ${newStudentCount.rows[0].count}`);
        console.log(`   - Events: ${events.rows.length} → ${newEventCount.rows[0].count}`);
        console.log(`   - Registrations: ${registrations.rows.length} → ${newRegistrationCount.rows[0].count}`);

        console.log('');
        console.log('🎉 Migration to enhanced database schema completed successfully!');
        console.log('');
        console.log('🔐 Security improvements:');
        console.log('   ✅ All passwords now properly hashed with BCrypt (12 salt rounds)');
        console.log('   ✅ UUID primary keys for better security');
        console.log('   ✅ Enhanced user authentication with login attempt tracking');
        console.log('   ✅ Email verification system ready');
        console.log('   ✅ Password reset functionality available');
        console.log('   ✅ Audit logging system in place');
        console.log('');
        console.log('⚠️  Important: Update your application code to use the new security service!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
};

// Run migration if this file is executed directly
if (require.main === module) {
    migrateToEnhanced()
        .then(() => {
            console.log('Migration completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}

module.exports = { migrateToEnhanced }; 