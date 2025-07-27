const express = require('express');
const moment = require('moment');
const db = require('../database/connection');
const emailService = require('../services/emailService');
const { requireAdmin } = require('./auth');
const router = express.Router();

// Admin dashboard
router.get('/dashboard', requireAdmin, async (req, res) => {
    try {
        // Get system statistics
        const statsResult = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM users WHERE role = 'parent') as total_parents,
                (SELECT COUNT(*) FROM students) as total_students,
                (SELECT COUNT(*) FROM events WHERE status = 'active') as active_events,
                (SELECT COUNT(*) FROM event_registrations) as total_registrations,
                (SELECT SUM(payment_amount) FROM event_registrations WHERE payment_status = 'paid') as total_revenue,
                (SELECT COUNT(*) FROM event_registrations WHERE payment_status = 'pending') as pending_payments
        `);

        const stats = statsResult.rows[0];

        // Get recent events
        const recentEventsResult = await db.query(`
            SELECT e.*, COUNT(er.id) as registration_count
            FROM events e
            LEFT JOIN event_registrations er ON e.id = er.event_id
            GROUP BY e.id
            ORDER BY e.created_at DESC
            LIMIT 5
        `);

        const recentEvents = recentEventsResult.rows.map(event => ({
            ...event,
            start_date: moment(event.start_date).format('MMM DD, YYYY'),
            created_at: moment(event.created_at).format('MMM DD, YYYY')
        }));

        // Get recent registrations
        const recentRegistrationsResult = await db.query(`
            SELECT er.*, e.title as event_title, s.first_name as student_first_name, s.last_name as student_last_name,
                   u.first_name as parent_first_name, u.last_name as parent_last_name
            FROM event_registrations er
            JOIN events e ON er.event_id = e.id
            JOIN students s ON er.student_id = s.id
            JOIN users u ON er.parent_id = u.id
            ORDER BY er.registration_date DESC
            LIMIT 10
        `);

        const recentRegistrations = recentRegistrationsResult.rows.map(registration => ({
            ...registration,
            registration_date: moment(registration.registration_date).format('MMM DD, HH:mm')
        }));

        // Get upcoming events
        const upcomingEventsResult = await db.query(`
            SELECT e.*, COUNT(er.id) as registration_count
            FROM events e
            LEFT JOIN event_registrations er ON e.id = er.event_id
            WHERE e.start_date > NOW() AND e.status = 'active'
            GROUP BY e.id
            ORDER BY e.start_date ASC
            LIMIT 5
        `);

        const upcomingEvents = upcomingEventsResult.rows.map(event => ({
            ...event,
            start_date: moment(event.start_date).format('MMM DD, YYYY HH:mm')
        }));

        res.render('admin/dashboard', {
            title: 'Admin Dashboard - School Events',
            stats,
            recentEvents,
            recentRegistrations,
            upcomingEvents,
            user: req.session.user
        });

    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.render('admin/dashboard', {
            title: 'Admin Dashboard - School Events',
            stats: {},
            recentEvents: [],
            recentRegistrations: [],
            upcomingEvents: [],
            error: 'Failed to load dashboard data',
            user: req.session.user
        });
    }
});

// Admin registration management page
router.get('/registrations', requireAdmin, async (req, res) => {
    try {
        // Get events for filter dropdown
        const eventsResult = await db.query('SELECT id, title FROM events ORDER BY title');
        
        res.render('admin/registrations', { 
            title: 'Manage Registrations - School Events',
            user: req.session.user,
            events: eventsResult.rows
        });

    } catch (error) {
        console.error('Get registrations page error:', error);
        res.status(500).render('error', { 
            title: 'Error',
            error: 'Failed to load registrations page',
            user: req.session.user 
        });
    }
});

// Manage users
router.get('/users', requireAdmin, async (req, res) => {
    try {
        const usersResult = await db.query(`
            SELECT u.*, COUNT(s.id) as student_count
            FROM users u
            LEFT JOIN students s ON u.id = s.parent_id
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `);

        const users = usersResult.rows.map(user => ({
            ...user,
            created_at: moment(user.created_at).format('MMM DD, YYYY')
        }));

        res.render('admin/users', {
            title: 'Manage Users - School Events',
            users,
            user: req.session.user
        });

    } catch (error) {
        console.error('Users management error:', error);
        res.render('admin/users', {
            title: 'Manage Users - School Events',
            users: [],
            error: 'Failed to load users',
            user: req.session.user
        });
    }
});

// Add user
router.get('/users/add', requireAdmin, (req, res) => {
    res.render('admin/add-user', {
        title: 'Add User - School Events',
        user: req.session.user
    });
});

router.post('/users/add', requireAdmin, async (req, res) => {
    try {
        const { firstName, lastName, email, password, role, phone } = req.body;

        if (!firstName || !lastName || !email || !password || !role) {
            return res.render('admin/add-user', {
                title: 'Add User - School Events',
                error: 'Please fill in all required fields',
                user: req.session.user
            });
        }

        // Check if user already exists
        const existingUser = await db.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.render('admin/add-user', {
                title: 'Add User - School Events',
                error: 'Email already registered',
                user: req.session.user
            });
        }

        // Hash password
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        await db.query(`
            INSERT INTO users (first_name, last_name, email, password, role, phone)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [firstName, lastName, email, hashedPassword, role, phone || null]);

        res.redirect('/admin/users?success=User added successfully');

    } catch (error) {
        console.error('Add user error:', error);
        res.render('admin/add-user', {
            title: 'Add User - School Events',
            error: 'Failed to add user',
            user: req.session.user
        });
    }
});

// Admin users management API
router.get('/users/data', requireAdmin, async (req, res) => {
    try {
        const { role, status, search } = req.query;
        
        let query = `
            SELECT u.*, COUNT(s.id) as student_count,
                   COUNT(er.id) as registration_count,
                   COUNT(n.id) as notification_count
            FROM users u
            LEFT JOIN students s ON u.id = s.parent_id
            LEFT JOIN event_registrations er ON u.id = er.parent_id
            LEFT JOIN notifications n ON u.id = n.user_id
            WHERE 1=1
        `;
        
        const params = [];
        let paramCount = 0;

        if (role) {
            paramCount++;
            query += ` AND u.role = $${paramCount}`;
            params.push(role);
        }

        if (search) {
            paramCount++;
            query += ` AND (
                u.first_name ILIKE $${paramCount} OR 
                u.last_name ILIKE $${paramCount} OR 
                u.email ILIKE $${paramCount}
            )`;
            params.push(`%${search}%`);
        }

        query += ` GROUP BY u.id ORDER BY u.created_at DESC`;

        const usersResult = await db.query(query, params);
        
        const users = usersResult.rows.map(user => ({
            ...user,
            created_at: moment(user.created_at).format('MMM DD, YYYY HH:mm')
        }));

        res.json({
            success: true,
            users: users
        });

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load users'
        });
    }
});

// Reset user password
router.post('/users/:id/reset-password', requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        
        // Generate new password
        const newPassword = Math.random().toString(36).slice(-8);
        
        // Hash password
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Update password
        await db.query(
            'UPDATE users SET password = $1 WHERE id = $2',
            [hashedPassword, userId]
        );
        
        res.json({
            success: true,
            message: 'Password reset successfully',
            newPassword: newPassword
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reset password'
        });
    }
});

// Delete user
router.delete('/users/:id', requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        
        // Check if user exists
        const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        const user = userResult.rows[0];
        
        // Prevent deleting the current admin user
        if (user.id === req.session.user.id) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete your own account'
            });
        }
        
        // Check if user has associated data
        const studentsResult = await db.query('SELECT COUNT(*) as count FROM students WHERE parent_id = $1', [userId]);
        const registrationsResult = await db.query('SELECT COUNT(*) as count FROM event_registrations WHERE parent_id = $1', [userId]);
        
        if (parseInt(studentsResult.rows[0].count) > 0 || parseInt(registrationsResult.rows[0].count) > 0) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete user with associated students or registrations'
            });
        }
        
        // Delete user
        await db.query('DELETE FROM users WHERE id = $1', [userId]);
        
        res.json({
            success: true,
            message: 'User deleted successfully'
        });

    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete user'
        });
    }
});

// Get user details
router.get('/users/:id', requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        
        const userResult = await db.query(`
            SELECT u.*, COUNT(s.id) as student_count,
                   COUNT(er.id) as registration_count,
                   COUNT(n.id) as notification_count
            FROM users u
            LEFT JOIN students s ON u.id = s.parent_id
            LEFT JOIN event_registrations er ON u.id = er.parent_id
            LEFT JOIN notifications n ON u.id = n.user_id
            WHERE u.id = $1
            GROUP BY u.id
        `, [userId]);
        
        if (userResult.rows.length === 0) {
            return res.status(404).render('error', {
                title: 'User Not Found',
                error: 'User not found',
                user: req.session.user
            });
        }
        
        const user = userResult.rows[0];
        
        // Get user's students if they're a parent
        let students = [];
        if (user.role === 'parent') {
            const studentsResult = await db.query(`
                SELECT s.*, COUNT(er.id) as registration_count
                FROM students s
                LEFT JOIN event_registrations er ON s.id = er.student_id
                WHERE s.parent_id = $1
                GROUP BY s.id
                ORDER BY s.first_name, s.last_name
            `, [userId]);
            students = studentsResult.rows;
        }
        
        // Get user's recent registrations
        const registrationsResult = await db.query(`
            SELECT er.*, e.title as event_title, s.first_name || ' ' || s.last_name as student_name
            FROM event_registrations er
            JOIN events e ON er.event_id = e.id
            JOIN students s ON er.student_id = s.id
            WHERE er.parent_id = $1
            ORDER BY er.registration_date DESC
            LIMIT 10
        `, [userId]);
        
        res.render('admin/user-details', {
            title: `User Details - ${user.first_name} ${user.last_name}`,
            user: user,
            students: students,
            registrations: registrationsResult.rows,
            currentUser: req.session.user
        });

    } catch (error) {
        console.error('Get user details error:', error);
        res.status(500).render('error', {
            title: 'Error',
            error: 'Failed to load user details',
            user: req.session.user
        });
    }
});

// Edit user
router.get('/users/:id/edit', requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        
        const userResult = await db.query(`
            SELECT u.*, COUNT(s.id) as student_count,
                   COUNT(er.id) as registration_count,
                   COUNT(n.id) as notification_count
            FROM users u
            LEFT JOIN students s ON u.id = s.parent_id
            LEFT JOIN event_registrations er ON u.id = er.parent_id
            LEFT JOIN notifications n ON u.id = n.user_id
            WHERE u.id = $1
            GROUP BY u.id
        `, [userId]);
        
        if (userResult.rows.length === 0) {
            return res.status(404).render('error', {
                title: 'User Not Found',
                error: 'User not found',
                user: req.session.user
            });
        }
        
        const user = userResult.rows[0];
        
        res.render('admin/edit-user', {
            title: `Edit User - ${user.first_name} ${user.last_name}`,
            user: user,
            currentUser: req.session.user
        });

    } catch (error) {
        console.error('Get edit user error:', error);
        res.status(500).render('error', {
            title: 'Error',
            error: 'Failed to load user for editing',
            user: req.session.user
        });
    }
});

// Update user
router.post('/users/:id/edit', requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const { firstName, lastName, email, phone, role, status, newPassword, notes } = req.body;
        
        // Check if user exists
        const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
        
        if (userResult.rows.length === 0) {
            return res.render('admin/edit-user', {
                title: 'Edit User',
                error: 'User not found',
                user: {},
                currentUser: req.session.user
            });
        }
        
        const user = userResult.rows[0];
        
        // Check if email is already taken by another user
        if (email !== user.email) {
            const emailCheck = await db.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, userId]);
            if (emailCheck.rows.length > 0) {
                return res.render('admin/edit-user', {
                    title: `Edit User - ${user.first_name} ${user.last_name}`,
                    error: 'Email already taken by another user',
                    user: user,
                    currentUser: req.session.user
                });
            }
        }
        
        // Update user information
        await db.query(`
            UPDATE users 
            SET first_name = $1, last_name = $2, email = $3, phone = $4, role = $5, notes = $6
            WHERE id = $7
        `, [firstName, lastName, email, phone || null, role, notes || null, userId]);
        
        // Update password if provided
        if (newPassword && newPassword.trim() !== '') {
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);
        }
        
        res.redirect(`/admin/users?success=User updated successfully`);

    } catch (error) {
        console.error('Update user error:', error);
        res.render('admin/edit-user', {
            title: 'Edit User',
            error: 'Failed to update user',
            user: req.body,
            currentUser: req.session.user
        });
    }
});

// Event Reports
router.get('/event-reports', requireAdmin, async (req, res) => {
    try {
        res.render('admin/event-reports', {
            title: 'Event Reports - School Events',
            user: req.session.user,
            activePage: 'event-reports'
        });
    } catch (error) {
        console.error('Event reports error:', error);
        res.status(500).render('error', {
            title: 'Error - School Events',
            message: 'Failed to load event reports',
            user: req.session.user
        });
    }
});

// Event Reports Data API
router.get('/event-reports/data', requireAdmin, async (req, res) => {
    try {
        const { eventType, dateFrom, dateTo } = req.query;
        
        let whereClause = 'WHERE e.status = \'active\'';
        const queryParams = [];
        let paramCount = 0;

        if (eventType) {
            paramCount++;
            whereClause += ` AND e.event_type = $${paramCount}`;
            queryParams.push(eventType);
        }

        if (dateFrom) {
            paramCount++;
            whereClause += ` AND e.start_date >= $${paramCount}`;
            queryParams.push(dateFrom);
        }

        if (dateTo) {
            paramCount++;
            whereClause += ` AND e.start_date <= $${paramCount}`;
            queryParams.push(dateTo);
        }

        // Get summary statistics
        const summaryQuery = `
            SELECT 
                COUNT(DISTINCT e.id) as total_events,
                COUNT(er.id) as total_registrations,
                (
                    SELECT ROUND(AVG(
                        CASE WHEN e2.max_participants > 0 THEN 
                            (erc.registration_count::float / e2.max_participants::float) * 100
                        ELSE 0 END
                    )::numeric, 2)
                    FROM events e2
                    LEFT JOIN (
                        SELECT event_id, COUNT(*) as registration_count
                        FROM event_registrations
                        GROUP BY event_id
                    ) erc ON e2.id = erc.event_id
                    WHERE e2.status = 'active'
                ) as avg_attendance,
                (SELECT event_type FROM (
                    SELECT e2.event_type, COUNT(er2.id) as reg_count
                    FROM events e2
                    LEFT JOIN event_registrations er2 ON e2.id = er2.event_id
                    ${whereClause.replace('e.', 'e2.')}
                    GROUP BY e2.event_type
                    ORDER BY reg_count DESC
                    LIMIT 1
                ) popular) as popular_event_type
            FROM events e
            LEFT JOIN event_registrations er ON e.id = er.event_id
            WHERE e.status = 'active'
        `;

        const summaryResult = await db.query(summaryQuery, queryParams);
        const summary = summaryResult.rows[0];

        // Get registration trends (last 6 months)
        const trendsQuery = `
            SELECT 
                DATE_TRUNC('month', er.registration_date) as month,
                COUNT(er.id) as registrations
            FROM event_registrations er
            JOIN events e ON er.event_id = e.id
            ${whereClause.replace('e.', 'e.')}
            AND er.registration_date >= NOW() - INTERVAL '6 months'
            GROUP BY DATE_TRUNC('month', er.registration_date)
            ORDER BY month
        `;

        const trendsResult = await db.query(trendsQuery, queryParams);
        const trends = {
            labels: trendsResult.rows.map(row => {
                const date = new Date(row.month);
                return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            }),
            data: trendsResult.rows.map(row => parseInt(row.registrations))
        };

        // Get grade distribution
        const gradeQuery = `
            SELECT 
                s.grade,
                COUNT(er.id) as registrations
            FROM event_registrations er
            JOIN events e ON er.event_id = e.id
            JOIN students s ON er.student_id = s.id
            ${whereClause.replace('e.', 'e.')}
            GROUP BY s.grade
            ORDER BY registrations DESC
        `;

        const gradeResult = await db.query(gradeQuery, queryParams);
        const gradeDistribution = {
            labels: gradeResult.rows.map(row => row.grade),
            data: gradeResult.rows.map(row => parseInt(row.registrations))
        };

        // Get detailed event reports
        const eventsQuery = `
            SELECT 
                e.id,
                e.title,
                e.event_type,
                e.start_date,
                e.max_participants,
                e.location,
                e.fee,
                e.status,
                COUNT(er.id) as total_registrations,
                ROUND(CASE WHEN e.max_participants > 0 THEN 
                    ((COUNT(er.id)::float / e.max_participants::float) * 100)::numeric
                ELSE 0 END, 2) as attendance_rate,
                (SELECT grade FROM (
                    SELECT s.grade, COUNT(*) as grade_count
                    FROM event_registrations er2
                    JOIN students s ON er2.student_id = s.id
                    WHERE er2.event_id = e.id
                    GROUP BY s.grade
                    ORDER BY grade_count DESC
                    LIMIT 1
                ) popular_grade) as popular_grade
            FROM events e
            LEFT JOIN event_registrations er ON e.id = er.event_id
            ${whereClause}
            GROUP BY e.id, e.title, e.event_type, e.start_date, e.max_participants, e.location, e.fee, e.status
            ORDER BY e.start_date DESC
        `;

        const eventsResult = await db.query(eventsQuery, queryParams);
        const events = eventsResult.rows.map(event => ({
            ...event,
            start_date: new Date(event.start_date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            })
        }));

        res.json({
            success: true,
            summary: {
                totalEvents: parseInt(summary.total_events) || 0,
                totalRegistrations: parseInt(summary.total_registrations) || 0,
                avgAttendance: parseFloat(summary.avg_attendance) || 0,
                popularEventType: summary.popular_event_type || 'N/A'
            },
            charts: {
                trends,
                gradeDistribution
            },
            events
        });

    } catch (error) {
        console.error('Event reports data error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load event reports data'
        });
    }
});

// Event Types API
router.get('/events/types', requireAdmin, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT DISTINCT event_type 
            FROM events 
            WHERE status = 'active' 
            ORDER BY event_type
        `);
        
        res.json({
            success: true,
            types: result.rows.map(row => row.event_type)
        });
    } catch (error) {
        console.error('Event types error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load event types'
        });
    }
});

// Export Event Reports
router.get('/event-reports/export', requireAdmin, async (req, res) => {
    try {
        const { eventType, dateFrom, dateTo } = req.query;
        
        let whereClause = 'WHERE e.status = \'active\'';
        const queryParams = [];
        let paramCount = 0;

        if (eventType) {
            paramCount++;
            whereClause += ` AND e.event_type = $${paramCount}`;
            queryParams.push(eventType);
        }

        if (dateFrom) {
            paramCount++;
            whereClause += ` AND e.start_date >= $${paramCount}`;
            queryParams.push(dateFrom);
        }

        if (dateTo) {
            paramCount++;
            whereClause += ` AND e.start_date <= $${paramCount}`;
            queryParams.push(dateTo);
        }

        const query = `
            SELECT 
                e.title,
                e.event_type,
                e.start_date,
                e.location,
                e.fee,
                e.max_participants,
                e.status,
                COUNT(er.id) as total_registrations,
                ROUND(CASE WHEN e.max_participants > 0 THEN 
                    ((COUNT(er.id)::float / e.max_participants::float) * 100)::numeric
                ELSE 0 END, 2) as attendance_rate,
                SUM(er.payment_amount) as total_revenue,
                COUNT(CASE WHEN er.payment_status = 'paid' THEN 1 END) as paid_registrations,
                COUNT(CASE WHEN er.payment_status = 'pending' THEN 1 END) as pending_registrations
            FROM events e
            LEFT JOIN event_registrations er ON e.id = er.event_id
            ${whereClause}
            GROUP BY e.id, e.title, e.event_type, e.start_date, e.location, e.fee, e.max_participants, e.status
            ORDER BY e.start_date DESC
        `;

        const result = await db.query(query, queryParams);
        
        // Generate CSV
        const csvHeader = 'Event Title,Event Type,Date,Location,Fee,Max Participants,Total Registrations,Attendance Rate (%),Total Revenue,Paid Registrations,Pending Registrations\n';
        const csvData = result.rows.map(row => {
            return `"${row.title}","${row.event_type}","${new Date(row.start_date).toLocaleDateString()}","${row.location}","$${row.fee}","${row.max_participants}","${row.total_registrations}","${row.attendance_rate}","$${row.total_revenue || 0}","${row.paid_registrations}","${row.pending_registrations}"`;
        }).join('\n');

        const csv = csvHeader + csvData;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="event-reports.csv"');
        res.send(csv);

    } catch (error) {
        console.error('Export event reports error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to export event reports'
        });
    }
});

// Financial reports
router.get('/reports/financial', requireAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        let whereClause = 'WHERE 1=1';
        const params = [];
        let paramCount = 0;

        if (startDate) {
            paramCount++;
            whereClause += ` AND er.registration_date >= $${paramCount}`;
            params.push(startDate);
        }

        if (endDate) {
            paramCount++;
            whereClause += ` AND er.registration_date <= $${paramCount}`;
            params.push(endDate);
        }

        const financialResult = await db.query(`
            SELECT 
                SUM(er.payment_amount) as total_revenue,
                SUM(CASE WHEN er.payment_status = 'paid' THEN er.payment_amount ELSE 0 END) as paid_revenue,
                SUM(CASE WHEN er.payment_status = 'pending' THEN er.payment_amount ELSE 0 END) as pending_revenue,
                COUNT(er.id) as total_registrations,
                COUNT(CASE WHEN er.payment_status = 'paid' THEN 1 END) as paid_registrations,
                COUNT(CASE WHEN er.payment_status = 'pending' THEN 1 END) as pending_registrations
            FROM event_registrations er
            ${whereClause}
        `, params);

        const financial = financialResult.rows[0];

        // Get monthly revenue
        const monthlyRevenueResult = await db.query(`
            SELECT 
                DATE_TRUNC('month', er.registration_date) as month,
                SUM(er.payment_amount) as revenue,
                COUNT(er.id) as registrations
            FROM event_registrations er
            ${whereClause}
            GROUP BY DATE_TRUNC('month', er.registration_date)
            ORDER BY month DESC
            LIMIT 12
        `, params);

        const monthlyRevenue = monthlyRevenueResult.rows.map(row => ({
            ...row,
            month: moment(row.month).format('MMM YYYY')
        }));

        // Get top events by revenue
        const topEventsResult = await db.query(`
            SELECT e.title, 
                   COUNT(er.id) as registrations,
                   SUM(er.payment_amount) as revenue
            FROM events e
            JOIN event_registrations er ON e.id = er.event_id
            ${whereClause}
            GROUP BY e.id, e.title
            ORDER BY revenue DESC
            LIMIT 10
        `, params);

        res.render('admin/financial-reports', {
            title: 'Financial Reports - School Events',
            financial,
            monthlyRevenue,
            topEvents: topEventsResult.rows,
            filters: { startDate, endDate },
            user: req.session.user
        });

    } catch (error) {
        console.error('Financial reports error:', error);
        res.render('admin/financial-reports', {
            title: 'Financial Reports - School Events',
            financial: {},
            monthlyRevenue: [],
            topEvents: [],
            filters: {},
            error: 'Failed to load financial reports',
            user: req.session.user
        });
    }
});

// Admin Send Notification Page
router.get('/notifications', requireAdmin, async (req, res) => {
    res.render('admin/notifications', {
        title: 'Send Notification - School Events',
        user: req.session.user,
        activePage: 'notifications',
        success: req.query.success,
        error: req.query.error
    });
});

// Admin Send Notification Logic
router.post('/notifications', requireAdmin, async (req, res) => {
    const { recipientType, recipientEmail, subject, message } = req.body;
    try {
        let recipients = [];
        if (recipientType === 'all-parents') {
            const result = await db.query("SELECT email FROM users WHERE role = 'parent'");
            recipients = result.rows.map(row => row.email);
        } else if (recipientType === 'all-users') {
            const result = await db.query("SELECT email FROM users");
            recipients = result.rows.map(row => row.email);
        } else if (recipientType === 'single' && recipientEmail) {
            recipients = [recipientEmail];
        }
        if (recipients.length === 0) {
            return res.redirect('/admin/notifications?error=No recipients found');
        }
        // Send emails (in parallel)
        await Promise.all(recipients.map(email =>
            emailService.sendCustomNotification({
                to: email,
                subject,
                html: message
            })
        ));
        res.redirect('/admin/notifications?success=Notification sent successfully');
    } catch (error) {
        console.error('Send notification error:', error);
        res.redirect('/admin/notifications?error=Failed to send notification');
    }
});

// System settings
router.get('/settings', requireAdmin, (req, res) => {
    res.render('admin/settings', {
        title: 'System Settings - School Events',
        user: req.session.user
    });
});

// Admin registration management API
router.get('/registrations/data', requireAdmin, async (req, res) => {
    try {
        const { event, status, search } = req.query;
        
        let query = `
            SELECT 
                er.id,
                er.registration_date,
                er.payment_status,
                er.payment_amount,
                er.notes,
                e.title as event_title,
                e.event_type,
                e.fee as event_fee,
                s.first_name || ' ' || s.last_name as student_name,
                s.grade as student_grade,
                u.first_name || ' ' || u.last_name as parent_name,
                u.email as parent_email
            FROM event_registrations er
            JOIN events e ON er.event_id = e.id
            JOIN students s ON er.student_id = s.id
            JOIN users u ON er.parent_id = u.id
            WHERE 1=1
        `;
        
        const params = [];
        let paramCount = 0;

        if (event) {
            paramCount++;
            query += ` AND er.event_id = $${paramCount}`;
            params.push(event);
        }

        if (status) {
            paramCount++;
            query += ` AND er.payment_status = $${paramCount}`;
            params.push(status);
        }

        if (search) {
            paramCount++;
            query += ` AND (
                s.first_name ILIKE $${paramCount} OR 
                s.last_name ILIKE $${paramCount} OR 
                u.first_name ILIKE $${paramCount} OR 
                u.last_name ILIKE $${paramCount} OR
                u.email ILIKE $${paramCount}
            )`;
            params.push(`%${search}%`);
        }

        query += ` ORDER BY er.registration_date DESC`;

        const registrationsResult = await db.query(query, params);
        
        // Get events for filter dropdown
        const eventsResultForFilter = await db.query('SELECT id, title FROM events ORDER BY title');

        res.json({
            success: true,
            registrations: registrationsResult.rows,
            events: eventsResultForFilter.rows
        });

    } catch (error) {
        console.error('Get registrations error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load registrations'
        });
    }
});

// Update payment status
router.post('/registrations/:id/payment', requireAdmin, async (req, res) => {
    try {
        const registrationId = req.params.id;
        const { paymentStatus, paymentAmount, paymentNotes } = req.body;

        // Validate input
        if (!paymentStatus || !['pending', 'paid', 'cancelled'].includes(paymentStatus)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid payment status'
            });
        }

        // Get current registration
        const currentRegResult = await db.query(`
            SELECT er.*, e.title as event_title, s.first_name || ' ' || s.last_name as student_name, u.email as parent_email
            FROM event_registrations er
            JOIN events e ON er.event_id = e.id
            JOIN students s ON er.student_id = s.id
            JOIN users u ON er.parent_id = u.id
            WHERE er.id = $1
        `, [registrationId]);

        if (currentRegResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Registration not found'
            });
        }

        const currentReg = currentRegResult.rows[0];

        // Update payment status
        await db.query(`
            UPDATE event_registrations 
            SET payment_status = $1, payment_amount = $2, notes = $3, updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
        `, [paymentStatus, paymentAmount || null, paymentNotes || null, registrationId]);

        // Create notification for parent
        let notificationMessage = '';
        switch (paymentStatus) {
            case 'paid':
                notificationMessage = `Payment received for ${currentReg.event_title}. Thank you!`;
                break;
            case 'pending':
                notificationMessage = `Payment status updated to pending for ${currentReg.event_title}.`;
                break;
            case 'cancelled':
                notificationMessage = `Payment cancelled for ${currentReg.event_title}. Please contact the school.`;
                break;
        }

        if (notificationMessage) {
            await db.query(`
                INSERT INTO notifications (user_id, title, message, type)
                VALUES ($1, $2, $3, $4)
            `, [currentReg.parent_id, 'Payment Status Updated', notificationMessage, 'info']);
        }

        // Send email notification
        try {
            const emailService = require('../services/emailService');
            await emailService.sendPaymentStatusUpdate({
                parentEmail: currentReg.parent_email,
                studentName: currentReg.student_name,
                eventTitle: currentReg.event_title,
                paymentStatus: paymentStatus,
                paymentAmount: paymentAmount,
                notes: paymentNotes
            });
        } catch (emailError) {
            console.error('Email notification failed:', emailError);
            // Don't fail the request if email fails
        }

        res.json({
            success: true,
            message: 'Payment status updated successfully'
        });

    } catch (error) {
        console.error('Update payment status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update payment status'
        });
    }
});

// Get registration statistics
router.get('/registration-stats', requireAdmin, async (req, res) => {
    try {
        // Total registrations
        const totalResult = await db.query('SELECT COUNT(*) as count FROM event_registrations');
        
        // Payment status breakdown
        const statusResult = await db.query(`
            SELECT payment_status, COUNT(*) as count
            FROM event_registrations
            GROUP BY payment_status
        `);
        
        // Recent registrations
        const recentResult = await db.query(`
            SELECT er.registration_date, e.title as event_title, s.first_name || ' ' || s.last_name as student_name
            FROM event_registrations er
            JOIN events e ON er.event_id = e.id
            JOIN students s ON er.student_id = s.id
            ORDER BY er.registration_date DESC
            LIMIT 10
        `);

        // Total revenue
        const revenueResult = await db.query(`
            SELECT COALESCE(SUM(payment_amount), 0) as total_revenue
            FROM event_registrations
            WHERE payment_status = 'paid'
        `);

        res.json({
            success: true,
            stats: {
                totalRegistrations: parseInt(totalResult.rows[0].count),
                paymentStatuses: statusResult.rows,
                recentRegistrations: recentResult.rows,
                totalRevenue: parseFloat(revenueResult.rows[0].total_revenue)
            }
        });

    } catch (error) {
        console.error('Get registration stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load statistics'
        });
    }
});

// Financial reports API
router.get('/financial-reports/data', requireAdmin, async (req, res) => {
    try {
        const { event, dateFrom, dateTo } = req.query;
        
        let whereClause = 'WHERE 1=1';
        const params = [];
        let paramCount = 0;

        if (event) {
            paramCount++;
            whereClause += ` AND er.event_id = $${paramCount}`;
            params.push(event);
        }

        if (dateFrom) {
            paramCount++;
            whereClause += ` AND er.registration_date >= $${paramCount}`;
            params.push(dateFrom);
        }

        if (dateTo) {
            paramCount++;
            whereClause += ` AND er.registration_date <= $${paramCount}`;
            params.push(dateTo + ' 23:59:59');
        }

        // Get summary statistics
        const summaryResult = await db.query(`
            SELECT 
                COUNT(*) as total_registrations,
                COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid_registrations,
                COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as pending_payments,
                COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN payment_amount ELSE 0 END), 0) as total_revenue
            FROM event_registrations er
            ${whereClause}
        `, params);

        const summary = summaryResult.rows[0];

        // Get payment status distribution
        const paymentStatusResult = await db.query(`
            SELECT payment_status, COUNT(*) as count
            FROM event_registrations er
            ${whereClause}
            GROUP BY payment_status
        `, params);

        const paymentStatusData = {
            labels: [],
            data: []
        };

        paymentStatusResult.rows.forEach(row => {
            paymentStatusData.labels.push(row.payment_status.charAt(0).toUpperCase() + row.payment_status.slice(1));
            paymentStatusData.data.push(parseInt(row.count));
        });

        // Get revenue by event
        const revenueResult = await db.query(`
            SELECT e.title, COALESCE(SUM(CASE WHEN er.payment_status = 'paid' THEN er.payment_amount ELSE 0 END), 0) as revenue
            FROM events e
            LEFT JOIN event_registrations er ON e.id = er.event_id
            ${whereClause.replace('er.', '')}
            GROUP BY e.id, e.title
            ORDER BY revenue DESC
            LIMIT 10
        `, params);

        const revenueData = {
            labels: revenueResult.rows.map(row => row.title),
            data: revenueResult.rows.map(row => parseFloat(row.revenue))
        };

        // Get detailed financial data
        const detailsResult = await db.query(`
            SELECT 
                e.title as event_title,
                s.first_name || ' ' || s.last_name as student_name,
                u.first_name || ' ' || u.last_name as parent_name,
                er.registration_date,
                er.payment_status,
                er.payment_amount,
                er.updated_at as payment_date
            FROM event_registrations er
            JOIN events e ON er.event_id = e.id
            JOIN students s ON er.student_id = s.id
            JOIN users u ON er.parent_id = u.id
            ${whereClause}
            ORDER BY er.registration_date DESC
        `, params);

        res.json({
            success: true,
            summary: {
                totalRevenue: parseFloat(summary.total_revenue),
                paidRegistrations: parseInt(summary.paid_registrations),
                pendingPayments: parseInt(summary.pending_payments),
                totalRegistrations: parseInt(summary.total_registrations)
            },
            charts: {
                paymentStatus: paymentStatusData,
                revenue: revenueData
            },
            details: detailsResult.rows
        });

    } catch (error) {
        console.error('Get financial reports error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load financial reports'
        });
    }
});

// Admin view all parent feedback
router.get('/feedback', requireAdmin, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT f.*, u.first_name, u.last_name, u.email
            FROM feedback f
            JOIN users u ON f.parent_id = u.id
            ORDER BY f.created_at DESC
        `);
        res.render('admin/feedback', {
            title: 'What Parents Say - School Events',
            feedback: result.rows,
            user: req.session.user,
            activePage: 'feedback'
        });
    } catch (error) {
        console.error('Admin feedback view error:', error);
        res.render('admin/feedback', {
            title: 'What Parents Say - School Events',
            feedback: [],
            user: req.session.user,
            activePage: 'feedback',
            error: 'Failed to load feedback'
        });
    }
});

module.exports = router; 