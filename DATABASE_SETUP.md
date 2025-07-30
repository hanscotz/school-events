# Enhanced Database Setup Guide

This guide will help you set up the enhanced database schema with advanced security features for the School Events Management System.

## 🔐 Security Features

The enhanced database includes the following security improvements:

- **UUID Primary Keys**: Better security than sequential IDs
- **BCrypt Password Hashing**: 12 salt rounds for maximum security
- **Login Attempt Tracking**: Account lockout after failed attempts
- **Email Verification System**: Secure email verification
- **Password Reset Functionality**: Secure token-based password reset
- **Audit Logging**: Complete audit trail for sensitive operations
- **Session Management**: Secure session handling
- **Input Sanitization**: Protection against SQL injection
- **Rate Limiting**: Protection against brute force attacks

## 📋 Prerequisites

1. **PostgreSQL** installed and running
2. **Node.js** and **npm** installed
3. **Database connection** configured in `config.env`

## 🚀 Quick Setup

### Option 1: Fresh Installation (Recommended)

If you're starting with a new database:

```bash
# Run the enhanced database setup
node setup-enhanced-db.js
```

This will:
- Create all tables with enhanced schema
- Set up security features
- Create indexes for performance
- Add sample data with proper password hashing
- Set up triggers and views

### Option 2: Migration from Existing Database

If you have an existing database that needs to be upgraded:

```bash
# Run the migration script
node database/migrate-to-enhanced.js
```

This will:
- Backup existing data
- Create new tables with enhanced schema
- Migrate existing data
- Update passwords with proper hashing
- Preserve all existing information

## 📊 Database Schema Overview

### Core Tables

#### Users Table
```sql
- id (UUID, Primary Key)
- email (VARCHAR, Unique)
- password_hash (VARCHAR, BCrypt hashed)
- first_name, last_name (VARCHAR)
- role (ENUM: admin, parent, teacher)
- phone, profile_pic (VARCHAR)
- is_active (BOOLEAN)
- email_verified (BOOLEAN)
- email_verification_token (VARCHAR)
- password_reset_token (VARCHAR)
- password_reset_expires (TIMESTAMP)
- last_login (TIMESTAMP)
- login_attempts (INTEGER)
- locked_until (TIMESTAMP)
- created_at, updated_at (TIMESTAMP)
```

#### Students Table
```sql
- id (UUID, Primary Key)
- student_id (VARCHAR, Unique, School assigned ID)
- first_name, last_name (VARCHAR)
- grade (ENUM: FORM I, FORM II, FORM III, FORM IV, FORM V, FORM VI)
- section (VARCHAR)
- parent_id (UUID, Foreign Key)
- date_of_birth (DATE)
- gender (ENUM: Male, Female, Other)
- address, emergency_contact, medical_info (TEXT)
- is_active (BOOLEAN)
- created_at, updated_at (TIMESTAMP)
```

#### Events Table
```sql
- id (UUID, Primary Key)
- title, description (VARCHAR, TEXT)
- event_type, category (VARCHAR)
- location (VARCHAR)
- start_date, end_date (TIMESTAMP)
- registration_deadline (TIMESTAMP)
- fee (DECIMAL)
- max_participants, current_participants (INTEGER)
- min_age, max_age (INTEGER)
- status (ENUM: active, cancelled, completed, draft)
- is_featured (BOOLEAN)
- image_url (VARCHAR)
- created_by, approved_by (UUID, Foreign Keys)
- approved_at (TIMESTAMP)
- created_at, updated_at (TIMESTAMP)
```

### Security Tables

#### Audit Logs Table
```sql
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key)
- action (VARCHAR)
- table_name (VARCHAR)
- record_id (UUID)
- old_values, new_values (JSONB)
- ip_address (INET)
- user_agent (TEXT)
- created_at (TIMESTAMP)
```

#### Sessions Table
```sql
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key)
- session_token (VARCHAR, Unique)
- expires_at (TIMESTAMP)
- ip_address (INET)
- user_agent (TEXT)
- is_active (BOOLEAN)
- created_at (TIMESTAMP)
```

### Additional Tables

- **Event Registrations**: Enhanced with payment tracking
- **Notifications**: Categorized notifications with expiration
- **Email Logs**: Comprehensive email delivery tracking
- **Feedback**: Moderation system for parent feedback
- **Payments**: Transaction tracking and management
- **Event Categories**: Organized event categorization

## 🔧 Configuration

### Environment Variables

Update your `config.env` file:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=school_events
DB_USER=postgres
DB_PASSWORD=your_password

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=your_email@gmail.com

# Application Configuration
PORT=3000
SESSION_SECRET=your_very_secure_session_secret
APP_NAME=School Events Management System

# Security Configuration
BCRYPT_SALT_ROUNDS=12
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION=900000
SESSION_DURATION=86400000
```

### Security Service Integration

Update your authentication routes to use the new security service:

```javascript
const securityService = require('./services/securityService');

// In your login route
const authResult = await securityService.authenticateUser(email, password, req.ip);
if (authResult.success) {
    req.session.user = authResult.user;
    res.redirect('/dashboard');
} else {
    res.render('auth/login', { error: authResult.message });
}
```

## 🛡️ Security Best Practices

### Password Security
- All passwords are hashed using BCrypt with 12 salt rounds
- Password strength validation is enforced
- Password reset tokens expire after 1 hour
- Account lockout after 5 failed login attempts

### Session Security
- Session tokens are cryptographically secure
- Sessions expire after 24 hours
- IP address and user agent tracking
- Automatic cleanup of expired sessions

### Data Protection
- Input sanitization prevents SQL injection
- UUID primary keys prevent enumeration attacks
- Audit logging tracks all sensitive operations
- Email verification ensures valid user accounts

### Rate Limiting
- Login attempts are rate limited
- Password reset requests are limited
- Email sending is rate limited
- API endpoints are protected

## 📈 Performance Optimizations

### Indexes
The enhanced schema includes optimized indexes for:
- User authentication (email, role, active status)
- Student queries (parent_id, grade, student_id)
- Event searches (start_date, status, type, created_by)
- Registration lookups (event_id, student_id, parent_id, payment_status)
- Notification delivery (user_id, read status, type)
- Audit log queries (user_id, action, created_at)

### Views
Pre-built views for common queries:
- `active_events_view`: Events with registration counts
- `user_stats_view`: User dashboard statistics

### Triggers
Automatic triggers for:
- `updated_at` timestamp updates
- Audit log creation for sensitive operations

## 🔍 Monitoring and Maintenance

### Audit Logs
Monitor audit logs for security events:
```sql
-- Recent login attempts
SELECT * FROM audit_logs WHERE action = 'LOGIN' ORDER BY created_at DESC LIMIT 10;

-- Failed authentication attempts
SELECT * FROM audit_logs WHERE action = 'LOGIN_FAILED' ORDER BY created_at DESC LIMIT 10;

-- User account changes
SELECT * FROM audit_logs WHERE table_name = 'users' ORDER BY created_at DESC LIMIT 10;
```

### Session Management
Clean up expired sessions regularly:
```sql
-- Delete expired sessions
DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP;
```

### Email Logs
Monitor email delivery:
```sql
-- Failed email deliveries
SELECT * FROM email_logs WHERE status = 'failed' ORDER BY sent_at DESC LIMIT 10;

-- Email delivery statistics
SELECT status, COUNT(*) FROM email_logs GROUP BY status;
```

## 🚨 Troubleshooting

### Common Issues

1. **UUID Extension Not Available**
   ```sql
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   ```

2. **Password Hashing Errors**
   - Ensure bcryptjs is installed: `npm install bcryptjs`
   - Check salt rounds configuration

3. **Session Issues**
   - Verify session secret is set
   - Check session store configuration
   - Monitor session cleanup

4. **Audit Log Performance**
   - Consider archiving old audit logs
   - Monitor audit log table size
   - Optimize audit log queries

### Backup and Recovery

Create regular backups:
```bash
# Database backup
pg_dump -h localhost -U postgres -d school_events > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
psql -h localhost -U postgres -d school_events < backup_file.sql
```

## 📚 Additional Resources

- [PostgreSQL Security Best Practices](https://www.postgresql.org/docs/current/security.html)
- [BCrypt Security](https://en.wikipedia.org/wiki/Bcrypt)
- [UUID Security Benefits](https://en.wikipedia.org/wiki/Universally_unique_identifier)
- [Session Security](https://owasp.org/www-project-cheat-sheets/cheatsheets/Session_Management_Cheat_Sheet.html)

## 🎯 Next Steps

After setting up the enhanced database:

1. **Update Application Code**: Modify your routes to use the new security service
2. **Test Authentication**: Verify login, registration, and password reset functionality
3. **Monitor Security**: Set up monitoring for audit logs and security events
4. **User Training**: Educate users about new security features
5. **Regular Maintenance**: Schedule regular security audits and updates

---

**⚠️ Important**: Always test the migration in a development environment before applying to production. Backup your data before any schema changes. 