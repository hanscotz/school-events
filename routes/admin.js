const express = require('express');
const bcrypt = require('bcryptjs');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/connection');
const notificationService = require('../services/notificationService');
const paymentService = require('../services/paymentService');
const { requireAdmin } = require('./auth');
const router = express.Router();

// Admin dashboard
router.get('/dashboard', requireAdmin, async (req, res) => {
    try {
        // Get comprehensive system statistics
        const statsResult = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM users WHERE role = 'parent' AND is_active = true) as total_parents,
                (SELECT COUNT(*) FROM users WHERE role = 'teacher' AND is_active = true) as total_teachers,
                (SELECT COUNT(*) FROM students WHERE is_active = true) as total_students,
                (SELECT COUNT(*) FROM events WHERE status = 'active') as active_events,
                (SELECT COUNT(*) FROM events WHERE status = 'draft') as pending_event_requests,
                (SELECT COUNT(*) FROM event_registrations) as total_registrations,
                (SELECT SUM(payment_amount) FROM event_registrations WHERE payment_status = 'paid') as total_revenue,
                (SELECT COUNT(*) FROM event_registrations WHERE payment_status = 'pending') as pending_payments,
                (SELECT COUNT(*) FROM parent_registration_requests WHERE status = 'pending') as pending_parent_requests,
                (SELECT COUNT(*) FROM classes WHERE is_active = true) as total_classes
        `);

        const stats = statsResult.rows[0];

        // Get recent events
        const recentEventsResult = await db.query(`
            SELECT 
                e.*, 
                COUNT(er.id) as registration_count,
                u.first_name || ' ' || u.last_name as created_by_name
            FROM events e
            LEFT JOIN event_registrations er ON e.id = er.event_id
            LEFT JOIN users u ON e.created_by = u.id
            GROUP BY e.id, u.first_name, u.last_name
            ORDER BY e.created_at DESC
            LIMIT 5
        `);

        // Get upcoming events
        const upcomingEventsResult = await db.query(`
            SELECT 
                e.*,
                COUNT(er.id) as registration_count
            FROM events e
            LEFT JOIN event_registrations er ON e.id = er.event_id
            WHERE e.status = 'active' AND e.start_date >= NOW()
            GROUP BY e.id
            ORDER BY e.start_date ASC
            LIMIT 6
        `);

        // Get recent registrations
        const recentRegistrationsResult = await db.query(`
            SELECT 
                er.*, 
                e.title as event_title, 
                s.first_name as student_first_name,
                s.last_name as student_last_name,
                u.first_name as parent_first_name,
                u.last_name as parent_last_name,
                t.first_name || ' ' || t.last_name as teacher_name
            FROM event_registrations er
            JOIN events e ON er.event_id = e.id
            JOIN students s ON er.student_id = s.id
            LEFT JOIN users u ON er.parent_id = u.id
            LEFT JOIN users t ON er.teacher_id = t.id
            ORDER BY er.registration_date DESC
            LIMIT 10
        `);

        // Get pending parent requests
        const pendingRequestsResult = await db.query(`
            SELECT * FROM parent_registration_requests 
            WHERE status = 'pending'
            ORDER BY created_at DESC
            LIMIT 5
        `);

        res.render('admin/dashboard', {
            title: 'Admin Dashboard - School Events',
            stats: {
                ...stats,
                total_revenue: parseFloat(stats.total_revenue || 0).toFixed(2)
            },
            recentEvents: recentEventsResult.rows.map(event => ({
                ...event,
                start_date_formatted: moment(event.start_date).format('MMM DD, YYYY'),
                created_at_formatted: moment(event.created_at).format('MMM DD, YYYY')
            })),
            recentRegistrations: recentRegistrationsResult.rows.map(reg => ({
                ...reg,
                registration_date_formatted: moment(reg.registration_date).format('MMM DD, HH:mm')
            })),
            pendingRequests: pendingRequestsResult.rows,
            upcomingEvents: upcomingEventsResult.rows.map(event => ({
                ...event,
                start_date_formatted: moment(event.start_date).format('MMM DD, YYYY')
            })),
            user: req.session.user,
            moment
        });

    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.render('admin/dashboard', {
            title: 'Admin Dashboard - School Events',
            stats: { total_parents: 0, total_teachers: 0, total_students: 0, active_events: 0, total_registrations: 0, total_revenue: '0.00', pending_payments: 0, pending_parent_requests: 0, total_classes: 0 },
            recentEvents: [],
            recentRegistrations: [],
            pendingRequests: [],
            upcomingEvents: [],
            error: 'Failed to load dashboard data',
            user: req.session.user,
            moment
        });
    }
});

// User Management
router.get('/users', requireAdmin, async (req, res) => {
    try {
        const { role, search } = req.query;
        let whereClause = 'WHERE 1=1';
        let queryParams = [];
        let paramCount = 1;

        if (role) {
            whereClause += ` AND role = $${paramCount}`;
            queryParams.push(role);
            paramCount++;
        }

        if (search) {
            whereClause += ` AND (first_name ILIKE $${paramCount} OR last_name ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
            queryParams.push(`%${search}%`);
            paramCount++;
        }

        const usersResult = await db.query(`
            SELECT 
                u.*,
                COUNT(DISTINCT s.id) as student_count,
                COUNT(DISTINCT c.id) as class_count
            FROM users u
            LEFT JOIN students s ON u.id = s.parent_id AND u.role = 'parent'
            LEFT JOIN classes c ON u.id = c.class_teacher_id AND u.role = 'teacher'
            ${whereClause}
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `, queryParams);

        res.render('admin/users', {
            title: 'User Management - School Events',
            users: usersResult.rows,
            filters: { role, search },
            user: req.session.user,
            moment
        });

    } catch (error) {
        console.error('Users page error:', error);
        res.render('admin/users', {
            title: 'User Management - School Events',
            users: [],
            filters: {},
            error: 'Failed to load users',
            user: req.session.user,
            moment
        });
    }
});

// Users data API for frontend table
router.get('/users/data', requireAdmin, async (req, res) => {
    try {
        const { role, status, search } = req.query;

        let whereClause = 'WHERE 1=1';
        const queryParams = [];
        let paramCount = 1;

        if (role) {
            whereClause += ` AND u.role = $${paramCount}`;
            queryParams.push(role);
            paramCount++;
        }

        if (status === 'active') {
            whereClause += ` AND u.is_active = true`;
        } else if (status === 'inactive') {
            whereClause += ` AND u.is_active = false`;
        }

        if (search) {
            whereClause += ` AND (u.first_name ILIKE $${paramCount} OR u.last_name ILIKE $${paramCount} OR u.email ILIKE $${paramCount})`;
            queryParams.push(`%${search}%`);
            paramCount++;
        }

        const usersResult = await db.query(`
            SELECT 
                u.*,
                COUNT(DISTINCT s.id) as student_count,
                COUNT(DISTINCT c.id) as class_count
            FROM users u
            LEFT JOIN students s ON u.id = s.parent_id AND u.role = 'parent'
            LEFT JOIN classes c ON u.id = c.class_teacher_id AND u.role = 'teacher'
            ${whereClause}
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `, queryParams);

        res.json({ success: true, users: usersResult.rows });
    } catch (error) {
        console.error('Users data API error:', error);
        res.status(500).json({ success: false, error: 'Failed to load users' });
    }
});

// Reset user password (admin)
router.post('/users/:userId/reset-password', requireAdmin, async (req, res) => {
    try {
        const userId = req.params.userId;

        // Generate a temporary password
        const tempPassword = Math.random().toString(36).slice(-10);
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(tempPassword, saltRounds);

        await db.query(`
            UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
        `, [hashedPassword, userId]);

        res.json({ success: true, newPassword: tempPassword });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ success: false, error: 'Failed to reset password' });
    }
});

// Soft delete user (set inactive)
router.delete('/users/:userId', requireAdmin, async (req, res) => {
    try {
        const userId = req.params.userId;

        // Prevent disabling the currently logged-in admin
        if (req.session.user && String(req.session.user.id) === String(userId)) {
            return res.status(400).json({ success: false, error: 'You cannot deactivate your own account' });
        }

        await db.query(`
            UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1
        `, [userId]);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete user' });
    }
});

// Add user page
router.get('/users/add', requireAdmin, (req, res) => {
    res.render('admin/add-user', {
        title: 'Add User - School Events',
        user: req.session.user
    });
});

// Add user POST
router.post('/users/add', requireAdmin, async (req, res) => {
    try {
        const { firstName, lastName, email, phone, role, password } = req.body;

        // Validate required fields
        if (!firstName || !lastName || !email || !role || !password) {
            return res.render('admin/add-user', {
                title: 'Add User - School Events',
                error: 'Please fill in all required fields',
                formData: req.body,
                user: req.session.user
            });
        }

        // Check if email already exists
        const existingUser = await db.query(`
            SELECT id FROM users WHERE email = $1
        `, [email]);

        if (existingUser.rows.length > 0) {
            return res.render('admin/add-user', {
                title: 'Add User - School Events',
                error: 'A user with this email already exists',
                formData: req.body,
                user: req.session.user
            });
        }

        // Hash password
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create user
        await db.query(`
            INSERT INTO users (
                email, password_hash, first_name, last_name, phone, 
                role, is_active, email_verified
            ) VALUES ($1, $2, $3, $4, $5, $6, true, true)
        `, [email, hashedPassword, firstName, lastName, phone, role]);

        res.redirect('/admin/users?success=User created successfully');

    } catch (error) {
        console.error('Add user error:', error);
        res.render('admin/add-user', {
            title: 'Add User - School Events',
            error: 'An error occurred while creating the user',
            formData: req.body,
            user: req.session.user
        });
    }
});

// Edit user page
router.get('/users/:userId/edit', requireAdmin, async (req, res) => {
    try {
        const userResult = await db.query(`
            SELECT * FROM users WHERE id = $1
        `, [req.params.userId]);
        
        if (userResult.rows.length === 0) {
            return res.status(404).render('error', {
                title: 'User Not Found',
                error: 'User not found',
                user: req.session.user
            });
        }
        
        res.render('admin/edit-user', {
            title: 'Edit User - School Events',
            editUser: userResult.rows[0],
            user: req.session.user
        });

    } catch (error) {
        console.error('Edit user page error:', error);
        res.status(500).render('error', {
            title: 'Error',
            error: 'Failed to load user for editing',
            user: req.session.user
        });
    }
});

// Update user POST
router.post('/users/:userId/edit', requireAdmin, async (req, res) => {
    try {
        const userId = req.params.userId;
        const { firstName, lastName, email, phone, role, isActive, newPassword } = req.body;

        // Validate required fields
        if (!firstName || !lastName || !email || !role) {
            return res.redirect(`/admin/users/${userId}/edit?error=Please fill in all required fields`);
        }

        let updateFields = [];
        let updateValues = [];
        let paramCount = 1;

        // Update basic fields
        updateFields.push(`first_name = $${paramCount++}`);
        updateValues.push(firstName);
        
        updateFields.push(`last_name = $${paramCount++}`);
        updateValues.push(lastName);
        
        updateFields.push(`email = $${paramCount++}`);
        updateValues.push(email);
        
        updateFields.push(`phone = $${paramCount++}`);
        updateValues.push(phone);
        
        updateFields.push(`role = $${paramCount++}`);
        updateValues.push(role);
        
        updateFields.push(`is_active = $${paramCount++}`);
        updateValues.push(isActive === 'on');

        // Handle password update
        if (newPassword && newPassword.trim()) {
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
            updateFields.push(`password_hash = $${paramCount++}`);
            updateValues.push(hashedPassword);
        }

        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        updateValues.push(userId);

        // Update user
        await db.query(`
            UPDATE users 
            SET ${updateFields.join(', ')}
            WHERE id = $${paramCount}
        `, updateValues);
        
        res.redirect(`/admin/users?success=User updated successfully`);

    } catch (error) {
        console.error('Update user error:', error);
        res.redirect(`/admin/users/${req.params.userId}/edit?error=An error occurred while updating the user`);
    }
});

// Parent Registration Requests Management
router.get('/parent-requests', requireAdmin, async (req, res) => {
    try {
        const requestsResult = await db.query(`
            SELECT 
                prr.*,
                ur.first_name || ' ' || ur.last_name as reviewed_by_name
            FROM parent_registration_requests prr
            LEFT JOIN users ur ON prr.reviewed_by = ur.id
            ORDER BY 
                CASE WHEN prr.status = 'pending' THEN 0 ELSE 1 END,
                prr.created_at DESC
        `);

        res.render('admin/parent-requests', {
            title: 'Parent Registration Requests - School Events',
            requests: requestsResult.rows,
            user: req.session.user,
            moment
        });

    } catch (error) {
        console.error('Parent requests error:', error);
        res.render('admin/parent-requests', {
            title: 'Parent Registration Requests - School Events',
            requests: [],
            error: 'Failed to load parent requests',
            user: req.session.user,
            moment
        });
    }
});

// Approve parent registration request
router.post('/parent-requests/:requestId/approve', requireAdmin, async (req, res) => {
    try {
        const requestId = req.params.requestId;
        const adminId = req.session.user.id;

        // Get request details
        const requestResult = await db.query(`
            SELECT * FROM parent_registration_requests 
            WHERE id = $1 AND status = 'pending'
        `, [requestId]);

        if (requestResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Request not found or already processed'
            });
        }

        const request = requestResult.rows[0];

        // Generate temporary password
        const tempPassword = Math.random().toString(36).substring(2, 12);
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(tempPassword, saltRounds);

        // Create parent user account
        const userResult = await db.query(`
            INSERT INTO users (
                email, password_hash, first_name, last_name, phone, 
                role, is_active, email_verified
            ) VALUES ($1, $2, $3, $4, $5, 'parent', true, true)
            RETURNING *
        `, [
            request.email,
            hashedPassword,
            request.first_name,
            request.last_name,
            request.phone
        ]);

        const parentUser = userResult.rows[0];

        // Update request status
        await db.query(`
            UPDATE parent_registration_requests 
            SET 
                status = 'approved',
                reviewed_by = $1,
                reviewed_at = CURRENT_TIMESTAMP
            WHERE id = $2
        `, [adminId, requestId]);

        // Send approval notification
        await notificationService.sendParentAccountApproval({
            parentId: parentUser.id,
            parentEmail: parentUser.email,
            parentPhone: parentUser.phone,
            parentName: `${parentUser.first_name} ${parentUser.last_name}`,
            tempPassword: tempPassword,
            childrenNames: request.student_names.join(', ')
        });

        res.json({
            success: true,
            message: 'Parent account approved and created successfully',
            parentId: parentUser.id
        });

    } catch (error) {
        console.error('Approve parent request error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while approving the request'
        });
    }
});

// Reject parent registration request
router.post('/parent-requests/:requestId/reject', requireAdmin, async (req, res) => {
    try {
        const requestId = req.params.requestId;
        const { rejectionReason } = req.body;
        const adminId = req.session.user.id;

        // Update request status
        await db.query(`
            UPDATE parent_registration_requests 
            SET 
                status = 'rejected',
                reviewed_by = $1,
                reviewed_at = CURRENT_TIMESTAMP,
                rejection_reason = $2
            WHERE id = $3 AND status = 'pending'
        `, [adminId, rejectionReason, requestId]);
        
        res.json({
            success: true,
            message: 'Parent registration request rejected'
        });

    } catch (error) {
        console.error('Reject parent request error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while rejecting the request'
        });
    }
});

// Class Management
router.get('/classes', requireAdmin, async (req, res) => {
    try {
        const classesResult = await db.query(`
            SELECT 
                c.*,
                u.first_name || ' ' || u.last_name as teacher_name,
                COUNT(s.id) as actual_student_count
            FROM classes c
            LEFT JOIN users u ON c.class_teacher_id = u.id
            LEFT JOIN students s ON c.grade = s.grade AND c.section = s.section AND s.is_active = true
            GROUP BY c.id, u.first_name, u.last_name
            ORDER BY c.grade, c.section
        `);

        // Get teachers for assignment
        const teachersResult = await db.query(`
            SELECT id, first_name || ' ' || last_name as name 
            FROM users 
            WHERE role = 'teacher' AND is_active = true
            ORDER BY first_name, last_name
        `);

        res.render('admin/classes', {
            title: 'Class Management - School Events',
            classes: classesResult.rows,
            teachers: teachersResult.rows,
            user: req.session.user
        });

    } catch (error) {
        console.error('Classes page error:', error);
        res.render('admin/classes', {
            title: 'Class Management - School Events',
            classes: [],
            teachers: [],
            error: 'Failed to load classes',
            user: req.session.user
        });
    }
});

// Assign/Change class teacher
router.post('/classes/:classId/assign-teacher', requireAdmin, async (req, res) => {
    try {
        const { classId } = req.params;
        const { classTeacherId } = req.body;

        // Validate class exists and get grade/section
        const classResult = await db.query(`
            SELECT id, grade, section FROM classes WHERE id = $1
        `, [classId]);

        if (classResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Class not found' });
        }

        // If provided, validate teacher exists and is active, with role 'teacher'
        if (classTeacherId) {
            const teacherResult = await db.query(`
                SELECT id FROM users WHERE id = $1 AND role = 'teacher' AND is_active = true
            `, [classTeacherId]);
            if (teacherResult.rows.length === 0) {
                return res.status(400).json({ success: false, message: 'Invalid teacher selected' });
            }
        }

        // Update class teacher assignment
        await db.query(`
            UPDATE classes SET class_teacher_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
        `, [classTeacherId || null, classId]);

        const { grade, section } = classResult.rows[0];

        // Propagate assignment to students in this class (by grade/section)
        await db.query(`
            UPDATE students 
            SET class_teacher_id = $1, updated_at = CURRENT_TIMESTAMP
            WHERE grade = $2 AND section = $3 AND is_active = true
        `, [classTeacherId || null, grade, section]);

        res.json({ success: true, message: 'Class teacher assignment updated' });
    } catch (error) {
        console.error('Assign teacher error:', error);
        res.status(500).json({ success: false, message: 'Failed to update class teacher' });
    }
});

// Create class
router.post('/classes/create', requireAdmin, async (req, res) => {
    try {
        const { name, grade, section, classTeacherId, academicYear, maxStudents } = req.body;

        if (!name || !grade || !section || !academicYear) {
            return res.status(400).json({
            success: false,
                message: 'Please fill in all required fields'
            });
        }

        // Check if class already exists
        const existingClass = await db.query(`
            SELECT id FROM classes 
            WHERE grade = $1 AND section = $2 AND academic_year = $3
        `, [grade, section, academicYear]);

        if (existingClass.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'A class with this grade, section, and academic year already exists'
            });
        }

        // Create class
        await db.query(`
            INSERT INTO classes (
                name, grade, section, class_teacher_id, academic_year, max_students
            ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [name, grade, section, classTeacherId || null, academicYear, parseInt(maxStudents) || 40]);

        res.json({
            success: true,
            message: 'Class created successfully'
        });

    } catch (error) {
        console.error('Create class error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while creating the class'
        });
    }
});

// Reports (basic implementation)
router.get('/reports', requireAdmin, (req, res) => {
    res.render('admin/reports', {
        title: 'Reports - School Events',
        user: req.session.user
    });
});

// System Settings
router.get('/settings', requireAdmin, (req, res) => {
    res.render('admin/settings', {
        title: 'System Settings - School Events',
        user: req.session.user
    });
});

// Event Requests queue (draft events created by teachers)
router.get('/event-requests', requireAdmin, async (req, res) => {
    try {
        // Ensure optional columns exist for class targeting
        try {
            await db.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS class_grade VARCHAR(20)");
            await db.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS class_section VARCHAR(10)");
        } catch (e) { /* ignore */ }
        const drafts = await db.query(`
            SELECT 
                e.*, 
                u.first_name || ' ' || u.last_name as requested_by,
                COALESCE(e.class_grade, '') as class_grade,
                COALESCE(e.class_section, '') as class_section
            FROM events e
            JOIN users u ON e.created_by = u.id
            WHERE e.status = 'draft'
            ORDER BY e.created_at DESC
        `);

        res.render('admin/event-requests', {
            title: 'Event Requests - School Events',
            requests: drafts.rows,
            user: req.session.user,
            moment
        });
    } catch (error) {
        console.error('Event requests page error:', error);
        res.render('admin/event-requests', {
            title: 'Event Requests - School Events',
            requests: [],
            error: 'Failed to load event requests',
            user: req.session.user,
            moment
        });
    }
});

// Approve event request
router.post('/event-requests/:eventId/approve', requireAdmin, async (req, res) => {
    try {
        const { eventId } = req.params;
        const adminId = req.session.user.id;

        // Ensure columns exist before using them
        try {
            await db.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS class_grade VARCHAR(20)");
            await db.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS class_section VARCHAR(10)");
        } catch (e) { /* ignore */ }

        // Approve event and set approved_by
        await db.query(`
            UPDATE events 
            SET status = 'active', approved_by = $1, approved_at = CURRENT_TIMESTAMP
            WHERE id = $2 AND status = 'draft'
        `, [adminId, eventId]);

        // Notify parents in targeted class if set
        const eventResult = await db.query(`
            SELECT title, class_grade, class_section, start_date FROM events WHERE id = $1
        `, [eventId]);
        if (eventResult.rows.length > 0) {
            const { title, class_grade, class_section, start_date } = eventResult.rows[0];
            if (class_grade && class_section) {
                const parents = await db.query(`
                    SELECT DISTINCT u.id as parent_id, u.email, u.phone, u.first_name || ' ' || u.last_name as parent_name
                    FROM students s
                    JOIN users u ON s.parent_id = u.id
                    WHERE s.grade = $1 AND s.section = $2 AND s.is_active = true AND u.is_active = true
                `, [class_grade, class_section]);

                for (const p of parents.rows) {
                    await notificationService.createInAppNotification({
                        userId: p.parent_id,
                        title: `New Class Event: ${title}`,
                        message: `A new event for ${class_grade} ${class_section} has been posted for ${moment(start_date).format('MMMM DD, YYYY')}.`,
                        type: 'info',
                        category: 'event',
                        actionUrl: `/events/${eventId}`
                    });
                }
            }
        }

        res.json({ success: true, message: 'Event approved and posted' });
    } catch (error) {
        console.error('Approve event request error:', error);
        res.status(500).json({ success: false, message: 'Failed to approve event' });
    }
});

// Edit event request (basic updates)
router.post('/event-requests/:eventId/edit', requireAdmin, async (req, res) => {
    try {
        const { eventId } = req.params;
        const { title, description, location, start_date, end_date, registration_deadline, fee } = req.body;
        await db.query(`
            UPDATE events SET 
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                location = COALESCE($3, location),
                start_date = COALESCE($4, start_date),
                end_date = COALESCE($5, end_date),
                registration_deadline = COALESCE($6, registration_deadline),
                fee = COALESCE($7, fee)
            WHERE id = $8 AND status IN ('draft','active')
        `, [title, description, location, start_date, end_date, registration_deadline || null, fee, eventId]);
        res.json({ success: true, message: 'Event updated' });
    } catch (error) {
        console.error('Edit event request error:', error);
        res.status(500).json({ success: false, message: 'Failed to update event' });
    }
});

// Delete event request
router.delete('/event-requests/:eventId', requireAdmin, async (req, res) => {
    try {
        const { eventId } = req.params;
        await db.query(`DELETE FROM events WHERE id = $1 AND status = 'draft'`, [eventId]);
        res.json({ success: true, message: 'Event request deleted' });
    } catch (error) {
        console.error('Delete event request error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete event request' });
    }
});
module.exports = router; 