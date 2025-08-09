-- =====================================================
-- School Events Management System - Database Schema
-- =====================================================

-- Enable UUID extension for better security
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- USERS TABLE - Enhanced with security features
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- bcrypt hashed password
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
);

-- =====================================================
-- STUDENTS TABLE - Enhanced with more details and teacher relationships
-- =====================================================
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id VARCHAR(20) UNIQUE NOT NULL, -- School assigned ID
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    grade VARCHAR(20) NOT NULL CHECK (grade IN ('FORM I', 'FORM II', 'FORM III', 'FORM IV', 'FORM V', 'FORM VI')),
    section VARCHAR(10),
    class_teacher_id UUID REFERENCES users(id), -- Teacher who created/manages this student
    parent_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Parent assigned by admin
    date_of_birth DATE NOT NULL,
    gender VARCHAR(10) CHECK (gender IN ('Male', 'Female', 'Other')),
    address TEXT,
    emergency_contact VARCHAR(20),
    medical_info TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    parent_approved BOOLEAN DEFAULT FALSE, -- Whether parent has been approved by admin
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- EVENTS TABLE - Enhanced with more features
-- =====================================================
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_type VARCHAR(100) NOT NULL,
    category VARCHAR(50), -- Academic, Sports, Cultural, etc.
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
    CONSTRAINT valid_dates CHECK (end_date > start_date),
    CONSTRAINT valid_registration_deadline CHECK (registration_deadline <= start_date)
);

-- =====================================================
-- EVENT REGISTRATIONS TABLE - Enhanced with teacher registration workflow
-- =====================================================
CREATE TABLE IF NOT EXISTS event_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(id) ON DELETE CASCADE, -- Teacher who registered the student
    parent_id UUID REFERENCES users(id) ON DELETE CASCADE,
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    parent_notified BOOLEAN DEFAULT FALSE, -- Whether parent has been notified
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
    UNIQUE(event_id, student_id) -- Prevent duplicate registrations
);

-- =====================================================
-- NOTIFICATIONS TABLE - Enhanced with more types
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error', 'reminder')),
    category VARCHAR(50) DEFAULT 'general' CHECK (category IN ('general', 'event', 'payment', 'system', 'reminder')),
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    action_url VARCHAR(255), -- URL to navigate when clicked
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- EMAIL LOGS TABLE - Enhanced with more details
-- =====================================================
CREATE TABLE IF NOT EXISTS email_logs (
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
);

-- =====================================================
-- FEEDBACK TABLE - Enhanced with moderation
-- =====================================================
CREATE TABLE IF NOT EXISTS feedback (
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
);

-- =====================================================
-- PAYMENTS TABLE - New table for payment tracking
-- =====================================================
CREATE TABLE IF NOT EXISTS payments (
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
);

-- =====================================================
-- EVENT CATEGORIES TABLE - New table for event types
-- =====================================================
CREATE TABLE IF NOT EXISTS event_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#6f42c1', -- Hex color code
    icon VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- CLASSES TABLE - For class management by teachers
-- =====================================================
CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL, -- e.g., "Form 1A", "Form 2B"
    grade VARCHAR(20) NOT NULL CHECK (grade IN ('FORM I', 'FORM II', 'FORM III', 'FORM IV', 'FORM V', 'FORM VI')),
    section VARCHAR(10) NOT NULL,
    class_teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
    academic_year VARCHAR(20) NOT NULL, -- e.g., "2024-2025"
    max_students INTEGER DEFAULT 40,
    current_students INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(grade, section, academic_year)
);

-- =====================================================
-- PARENT REGISTRATION REQUESTS TABLE - For parent approval workflow
-- =====================================================
CREATE TABLE IF NOT EXISTS parent_registration_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    request_message TEXT,
    student_names TEXT[], -- Array of student names to be linked
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- SMS LOGS TABLE - For SMS notification tracking
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_phone VARCHAR(20) NOT NULL,
    recipient_name VARCHAR(255),
    message TEXT NOT NULL,
    template_used VARCHAR(100),
    status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'delivered')),
    error_message TEXT,
    cost DECIMAL(10,4), -- Cost of SMS
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP
);

-- =====================================================
-- AUDIT LOGS TABLE - New table for security auditing
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_logs (
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
);

-- =====================================================
-- SESSIONS TABLE - For session management
-- =====================================================
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- Students table indexes
CREATE INDEX IF NOT EXISTS idx_students_parent_id ON students(parent_id);
CREATE INDEX IF NOT EXISTS idx_students_grade ON students(grade);
CREATE INDEX IF NOT EXISTS idx_students_student_id ON students(student_id);

-- Events table indexes
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);

-- Event registrations table indexes
CREATE INDEX IF NOT EXISTS idx_registrations_event_id ON event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_registrations_student_id ON event_registrations(student_id);
CREATE INDEX IF NOT EXISTS idx_registrations_parent_id ON event_registrations(parent_id);
CREATE INDEX IF NOT EXISTS idx_registrations_payment_status ON event_registrations(payment_status);

-- Notifications table indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- Email logs table indexes
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at);

-- Feedback table indexes
CREATE INDEX IF NOT EXISTS idx_feedback_parent_id ON feedback(parent_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_rating ON feedback(rating);

-- Audit logs table indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Sessions table indexes
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Classes table indexes
CREATE INDEX IF NOT EXISTS idx_classes_teacher_id ON classes(class_teacher_id);
CREATE INDEX IF NOT EXISTS idx_classes_grade ON classes(grade);
CREATE INDEX IF NOT EXISTS idx_classes_academic_year ON classes(academic_year);

-- Parent registration requests indexes
CREATE INDEX IF NOT EXISTS idx_parent_requests_status ON parent_registration_requests(status);
CREATE INDEX IF NOT EXISTS idx_parent_requests_email ON parent_registration_requests(email);

-- SMS logs indexes
CREATE INDEX IF NOT EXISTS idx_sms_logs_recipient ON sms_logs(recipient_phone);
CREATE INDEX IF NOT EXISTS idx_sms_logs_status ON sms_logs(status);
CREATE INDEX IF NOT EXISTS idx_sms_logs_sent_at ON sms_logs(sent_at);

-- Additional indexes for new fields
CREATE INDEX IF NOT EXISTS idx_students_class_teacher ON students(class_teacher_id);
CREATE INDEX IF NOT EXISTS idx_students_parent_approved ON students(parent_approved);
CREATE INDEX IF NOT EXISTS idx_registrations_teacher_id ON event_registrations(teacher_id);
CREATE INDEX IF NOT EXISTS idx_registrations_parent_notified ON event_registrations(parent_notified);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_event_registrations_updated_at BEFORE UPDATE ON event_registrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_feedback_updated_at BEFORE UPDATE ON feedback FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON classes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TRIGGERS FOR AUDIT LOGGING
-- =====================================================

-- Function to create audit logs
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
        VALUES (current_setting('app.current_user_id', true)::uuid, 'INSERT', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values)
        VALUES (current_setting('app.current_user_id', true)::uuid, 'UPDATE', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values)
        VALUES (current_setting('app.current_user_id', true)::uuid, 'DELETE', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Create audit triggers for sensitive tables
CREATE TRIGGER audit_users_trigger AFTER INSERT OR UPDATE OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_events_trigger AFTER INSERT OR UPDATE OR DELETE ON events FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_registrations_trigger AFTER INSERT OR UPDATE OR DELETE ON event_registrations FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_payments_trigger AFTER INSERT OR UPDATE OR DELETE ON payments FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_students_trigger AFTER INSERT OR UPDATE OR DELETE ON students FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_classes_trigger AFTER INSERT OR UPDATE OR DELETE ON classes FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- View for active events with registration counts
CREATE OR REPLACE VIEW active_events_view AS
SELECT 
    e.*,
    COUNT(er.id) as registered_count,
    COUNT(CASE WHEN er.payment_status = 'paid' THEN 1 END) as paid_count
FROM events e
LEFT JOIN event_registrations er ON e.id = er.event_id
WHERE e.status = 'active'
GROUP BY e.id;

-- View for user dashboard statistics
CREATE OR REPLACE VIEW user_stats_view AS
SELECT 
    u.id,
    u.first_name,
    u.last_name,
    u.role,
    CASE 
        WHEN u.role = 'parent' THEN COUNT(DISTINCT s.id) 
        WHEN u.role = 'teacher' THEN COUNT(DISTINCT st.id)
        ELSE 0 
    END as student_count,
    COUNT(DISTINCT er.id) as registration_count,
    COUNT(DISTINCT n.id) as unread_notifications,
    CASE 
        WHEN u.role = 'teacher' THEN COUNT(DISTINCT c.id)
        ELSE 0
    END as class_count
FROM users u
LEFT JOIN students s ON u.id = s.parent_id AND u.role = 'parent'
LEFT JOIN students st ON u.id = st.class_teacher_id AND u.role = 'teacher'
LEFT JOIN classes c ON u.id = c.class_teacher_id AND u.role = 'teacher'
LEFT JOIN event_registrations er ON (
    (u.role = 'parent' AND u.id = er.parent_id) OR
    (u.role = 'teacher' AND u.id = er.teacher_id)
)
LEFT JOIN notifications n ON u.id = n.user_id AND n.is_read = false
GROUP BY u.id;

-- View for teacher's class overview
CREATE OR REPLACE VIEW teacher_class_view AS
SELECT 
    c.id as class_id,
    c.name as class_name,
    c.grade,
    c.section,
    c.academic_year,
    u.first_name || ' ' || u.last_name as teacher_name,
    c.current_students,
    c.max_students,
    COUNT(s.id) as actual_student_count
FROM classes c
LEFT JOIN users u ON c.class_teacher_id = u.id
LEFT JOIN students s ON c.grade = s.grade AND c.section = s.section AND s.is_active = true
WHERE c.is_active = true
GROUP BY c.id, u.first_name, u.last_name;

-- View for parent approval queue
CREATE OR REPLACE VIEW parent_approval_queue AS
SELECT 
    prr.*,
    ur.first_name || ' ' || ur.last_name as reviewed_by_name
FROM parent_registration_requests prr
LEFT JOIN users ur ON prr.reviewed_by = ur.id
WHERE prr.status = 'pending'
ORDER BY prr.created_at;

-- =====================================================
-- INITIAL DATA INSERTION
-- =====================================================

-- Insert default event categories
INSERT INTO event_categories (name, description, color, icon) VALUES
('Academic', 'Educational and learning events', '#28a745', 'bi-book'),
('Sports', 'Athletic and physical activities', '#dc3545', 'bi-trophy'),
('Cultural', 'Arts, music, and cultural events', '#ffc107', 'bi-music-note'),
('Social', 'Social gatherings and celebrations', '#17a2b8', 'bi-people'),
('Meeting', 'Parent-teacher and administrative meetings', '#6f42c1', 'bi-calendar-event')
ON CONFLICT (name) DO NOTHING;

-- Insert default admin user (password will be hashed in the application)
-- Note: This is just a placeholder - the actual password hashing should be done in the application
INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, email_verified) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'admin@school.com', '$2a$10$placeholder.hash.will.be.replaced', 'System', 'Administrator', 'admin', true, true)
ON CONFLICT (email) DO NOTHING;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE users IS 'User accounts with enhanced security features including password hashing, email verification, and login attempt tracking';
COMMENT ON TABLE students IS 'Student records linked to parent users with comprehensive information';
COMMENT ON TABLE events IS 'School events with detailed information and registration management';
COMMENT ON TABLE event_registrations IS 'Event registrations with payment tracking and attendance confirmation';
COMMENT ON TABLE notifications IS 'User notifications with categorization and expiration';
COMMENT ON TABLE email_logs IS 'Email delivery tracking and analytics';
COMMENT ON TABLE feedback IS 'Parent feedback system with moderation capabilities';
COMMENT ON TABLE payments IS 'Payment transaction tracking and management';
COMMENT ON TABLE audit_logs IS 'Security audit trail for sensitive operations';
COMMENT ON TABLE sessions IS 'User session management for security';

COMMENT ON COLUMN users.password_hash IS 'BCrypt hashed password (never store plain text passwords)';
COMMENT ON COLUMN users.login_attempts IS 'Number of failed login attempts for account lockout';
COMMENT ON COLUMN users.locked_until IS 'Timestamp until account is locked due to failed attempts';
COMMENT ON COLUMN event_registrations.payment_reference IS 'External payment gateway reference number';
COMMENT ON COLUMN audit_logs.old_values IS 'Previous values before update (JSON format)';
COMMENT ON COLUMN audit_logs.new_values IS 'New values after update (JSON format)'; 