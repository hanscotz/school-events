const express = require('express');
const moment = require('moment');
const db = require('../database/connection');
const { requireAuth } = require('./auth');
const router = express.Router();

// Parent dashboard
router.get('/dashboard', requireAuth, async (req, res) => {
    try {
        const parentId = req.session.user.id;

        // Get parent's students
        const studentsResult = await db.query(`
            SELECT * FROM students WHERE parent_id = $1 ORDER BY first_name
        `, [parentId]);

        // Get upcoming events for parent's students
        const upcomingEventsResult = await db.query(`
            SELECT DISTINCT e.*, er.registration_date, er.payment_status,
                   s.first_name as student_first_name, s.last_name as student_last_name
            FROM events e
            JOIN event_registrations er ON e.id = er.event_id
            JOIN students s ON er.student_id = s.id
            WHERE er.parent_id = $1 AND e.start_date > NOW()
            ORDER BY e.start_date ASC
            LIMIT 5
        `, [parentId]);

        // Get recent notifications
        const notificationsResult = await db.query(`
            SELECT * FROM notifications 
            WHERE user_id = $1 
            ORDER BY created_at DESC 
            LIMIT 5
        `, [parentId]);

        // Get event statistics
        const statsResult = await db.query(`
            SELECT 
                COUNT(DISTINCT er.event_id) as total_events,
                COUNT(er.id) as total_registrations,
                SUM(er.payment_amount) as total_fees,
                COUNT(CASE WHEN er.payment_status = 'pending' THEN 1 END) as pending_payments
            FROM event_registrations er
            WHERE er.parent_id = $1
        `, [parentId]);

        const stats = statsResult.rows[0];

        res.render('parents/dashboard', {
            title: 'Parent Dashboard - School Events',
            students: studentsResult.rows,
            upcomingEvents: upcomingEventsResult.rows.map(event => ({
                ...event,
                start_date: moment(event.start_date).format('MMM DD, YYYY HH:mm')
            })),
            notifications: notificationsResult.rows.map(notification => ({
                ...notification,
                created_at: moment(notification.created_at).format('MMM DD, HH:mm')
            })),
            stats,
            user: req.session.user
        });

    } catch (error) {
        console.error('Parent dashboard error:', error);
        res.render('parents/dashboard', {
            title: 'Parent Dashboard - School Events',
            students: [],
            upcomingEvents: [],
            notifications: [],
            stats: { total_events: 0, total_registrations: 0, total_fees: 0, pending_payments: 0 },
            error: 'Failed to load dashboard data',
            user: req.session.user
        });
    }
});

// Add student
router.get('/students/add', requireAuth, (req, res) => {
    res.render('parents/add-student', {
        title: 'Add Student - School Events',
        user: req.session.user
    });
});

router.post('/students/add', requireAuth, async (req, res) => {
    try {
        const { firstName, lastName, grade, section, dateOfBirth } = req.body;
        const parentId = req.session.user.id;

        if (!firstName || !lastName || !grade) {
            return res.render('parents/add-student', {
                title: 'Add Student - School Events',
                error: 'Please fill in all required fields',
                user: req.session.user
            });
        }

        await db.query(`
            INSERT INTO students (first_name, last_name, grade, section, date_of_birth, parent_id)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [firstName, lastName, grade, section || null, dateOfBirth || null, parentId]);

        res.redirect('/parents/dashboard?success=Student added successfully');

    } catch (error) {
        console.error('Add student error:', error);
        res.render('parents/add-student', {
            title: 'Add Student - School Events',
            error: 'Failed to add student',
            user: req.session.user
        });
    }
});

// Edit student
router.get('/students/:id/edit', requireAuth, async (req, res) => {
    try {
        const studentId = req.params.id;
        const parentId = req.session.user.id;

        const studentResult = await db.query(`
            SELECT * FROM students WHERE id = $1 AND parent_id = $2
        `, [studentId, parentId]);

        if (studentResult.rows.length === 0) {
            return res.status(404).render('error', {
                title: 'Student Not Found',
                error: 'Student not found',
                user: req.session.user
            });
        }

        const student = studentResult.rows[0];
        if (student.date_of_birth) {
            student.date_of_birth = moment(student.date_of_birth).format('YYYY-MM-DD');
        }

        res.render('parents/edit-student', {
            title: 'Edit Student - School Events',
            student,
            user: req.session.user
        });

    } catch (error) {
        console.error('Edit student error:', error);
        res.redirect('/parents/dashboard');
    }
});

router.post('/students/:id/edit', requireAuth, async (req, res) => {
    try {
        const studentId = req.params.id;
        const parentId = req.session.user.id;
        const { firstName, lastName, grade, section, dateOfBirth } = req.body;

        await db.query(`
            UPDATE students 
            SET first_name = $1, last_name = $2, grade = $3, section = $4, date_of_birth = $5
            WHERE id = $6 AND parent_id = $7
        `, [firstName, lastName, grade, section || null, dateOfBirth || null, studentId, parentId]);

        res.redirect('/parents/dashboard?success=Student updated successfully');

    } catch (error) {
        console.error('Update student error:', error);
        res.redirect(`/parents/students/${req.params.id}/edit?error=Failed to update student`);
    }
});

// Delete student
router.post('/students/:id/delete', requireAuth, async (req, res) => {
    try {
        const studentId = req.params.id;
        const parentId = req.session.user.id;

        // Check if student has any registrations
        const registrationsResult = await db.query(`
            SELECT COUNT(*) as count FROM event_registrations WHERE student_id = $1
        `, [studentId]);

        if (parseInt(registrationsResult.rows[0].count) > 0) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete student with existing event registrations'
            });
        }

        await db.query(`
            DELETE FROM students WHERE id = $1 AND parent_id = $2
        `, [studentId, parentId]);

        res.json({
            success: true,
            message: 'Student deleted successfully'
        });

    } catch (error) {
        console.error('Delete student error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete student'
        });
    }
});

// View registrations
router.get('/registrations', requireAuth, async (req, res) => {
    try {
        const parentId = req.session.user.id;

        const registrationsResult = await db.query(`
            SELECT er.*, e.title, e.start_date, e.end_date, e.location, e.event_type,
                   s.first_name as student_first_name, s.last_name as student_last_name
            FROM event_registrations er
            JOIN events e ON er.event_id = e.id
            JOIN students s ON er.student_id = s.id
            WHERE er.parent_id = $1
            ORDER BY er.registration_date DESC
        `, [parentId]);

        const registrations = registrationsResult.rows.map(registration => ({
            ...registration,
            start_date: moment(registration.start_date).format('MMM DD, YYYY HH:mm'),
            end_date: moment(registration.end_date).format('MMM DD, YYYY HH:mm'),
            registration_date: moment(registration.registration_date).format('MMM DD, YYYY')
        }));

        res.render('parents/registrations', {
            title: 'My Registrations - School Events',
            registrations,
            user: req.session.user
        });

    } catch (error) {
        console.error('Registrations error:', error);
        res.render('parents/registrations', {
            title: 'My Registrations - School Events',
            registrations: [],
            error: 'Failed to load registrations',
            user: req.session.user
        });
    }
});

// View notifications
router.get('/notifications', requireAuth, async (req, res) => {
    try {
        const parentId = req.session.user.id;

        const notificationsResult = await db.query(`
            SELECT * FROM notifications 
            WHERE user_id = $1 
            ORDER BY created_at DESC
        `, [parentId]);

        const notifications = notificationsResult.rows.map(notification => ({
            ...notification,
            created_at: moment(notification.created_at).format('MMM DD, YYYY HH:mm')
        }));

        res.render('parents/notifications', {
            title: 'Notifications - School Events',
            notifications,
            user: req.session.user
        });

    } catch (error) {
        console.error('Notifications error:', error);
        res.render('parents/notifications', {
            title: 'Notifications - School Events',
            notifications: [],
            error: 'Failed to load notifications',
            user: req.session.user
        });
    }
});

// Mark notification as read
router.post('/notifications/:id/read', requireAuth, async (req, res) => {
    try {
        const notificationId = req.params.id;
        const parentId = req.session.user.id;

        await db.query(`
            UPDATE notifications 
            SET is_read = true 
            WHERE id = $1 AND user_id = $2
        `, [notificationId, parentId]);

        res.json({
            success: true,
            message: 'Notification marked as read'
        });

    } catch (error) {
        console.error('Mark notification read error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to mark notification as read'
        });
    }
});

// Mark all notifications as read
router.post('/notifications/read-all', requireAuth, async (req, res) => {
    try {
        const parentId = req.session.user.id;

        await db.query(`
            UPDATE notifications 
            SET is_read = true 
            WHERE user_id = $1
        `, [parentId]);

        res.json({
            success: true,
            message: 'All notifications marked as read'
        });

    } catch (error) {
        console.error('Mark all notifications read error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to mark notifications as read'
        });
    }
});

// Get unread notifications count (for AJAX)
router.get('/notifications/unread-count', requireAuth, async (req, res) => {
    try {
        const parentId = req.session.user.id;

        const result = await db.query(`
            SELECT COUNT(*) as count 
            FROM notifications 
            WHERE user_id = $1 AND is_read = false
        `, [parentId]);

        res.json({
            count: parseInt(result.rows[0].count)
        });

    } catch (error) {
        console.error('Unread notifications count error:', error);
        res.json({ count: 0 });
    }
});

// Search events for parent's children
router.get('/search-events', requireAuth, async (req, res) => {
    try {
        const parentId = req.session.user.id;
        const {
            searchTerm = '',
            studentId = '',
            eventType = '',
            dateFrom = '',
            dateTo = '',
            status = '',
            sortBy = 'start_date',
            sortOrder = 'ASC'
        } = req.query;

        // Get parent's students for filter dropdown
        const studentsResult = await db.query(`
            SELECT * FROM students WHERE parent_id = $1 ORDER BY first_name
        `, [parentId]);

        // Build the main query for events
        let query = `
            SELECT DISTINCT 
                e.*,
                er.registration_date,
                er.payment_status,
                er.payment_amount,
                s.id as student_id,
                s.first_name as student_first_name,
                s.last_name as student_last_name,
                s.grade as student_grade
            FROM events e
            LEFT JOIN event_registrations er ON e.id = er.event_id AND er.parent_id = $1
            LEFT JOIN students s ON er.student_id = s.id
            WHERE e.status = 'active'
        `;

        const queryParams = [parentId];
        let paramCount = 1;

        // Add search filters
        if (searchTerm) {
            paramCount++;
            query += ` AND (
                e.title ILIKE $${paramCount} OR 
                e.description ILIKE $${paramCount} OR 
                e.location ILIKE $${paramCount} OR
                e.event_type ILIKE $${paramCount}
            )`;
            queryParams.push(`%${searchTerm}%`);
        }

        if (studentId) {
            paramCount++;
            query += ` AND er.student_id = $${paramCount}`;
            queryParams.push(studentId);
        }

        if (eventType) {
            paramCount++;
            query += ` AND e.event_type = $${paramCount}`;
            queryParams.push(eventType);
        }

        if (dateFrom) {
            paramCount++;
            query += ` AND e.start_date >= $${paramCount}`;
            queryParams.push(dateFrom);
        }

        if (dateTo) {
            paramCount++;
            query += ` AND e.start_date <= $${paramCount}`;
            queryParams.push(dateTo);
        }

        if (status) {
            if (status === 'registered') {
                query += ` AND er.id IS NOT NULL`;
            } else if (status === 'not_registered') {
                query += ` AND er.id IS NULL`;
            } else if (status === 'paid') {
                query += ` AND er.payment_status = 'paid'`;
            } else if (status === 'pending') {
                query += ` AND er.payment_status = 'pending'`;
            }
        }

        // Add sorting
        const validSortFields = ['start_date', 'title', 'event_type', 'location', 'fee'];
        const validSortOrders = ['ASC', 'DESC'];
        
        if (validSortFields.includes(sortBy) && validSortOrders.includes(sortOrder.toUpperCase())) {
            query += ` ORDER BY e.${sortBy} ${sortOrder.toUpperCase()}`;
        } else {
            query += ` ORDER BY e.start_date ASC`;
        }

        const eventsResult = await db.query(query, queryParams);

        // Get unique event types for filter dropdown
        const eventTypesResult = await db.query(`
            SELECT DISTINCT event_type FROM events WHERE status = 'active' ORDER BY event_type
        `);

        // Process events data
        const events = eventsResult.rows.map(event => ({
            ...event,
            start_date: moment(event.start_date).format('MMM DD, YYYY HH:mm'),
            end_date: moment(event.end_date).format('MMM DD, YYYY HH:mm'),
            registration_date: event.registration_date ? moment(event.registration_date).format('MMM DD, YYYY') : null,
            is_registered: !!event.registration_date,
            student_name: event.student_first_name ? `${event.student_first_name} ${event.student_last_name}` : null
        }));

        // Group events by registration status for better display
        const registeredEvents = events.filter(event => event.is_registered);
        const availableEvents = events.filter(event => !event.is_registered);

        res.render('parents/search-events', {
            title: 'Search Events - School Events',
            events: {
                registered: registeredEvents,
                available: availableEvents,
                all: events
            },
            students: studentsResult.rows,
            eventTypes: eventTypesResult.rows.map(row => row.event_type),
            filters: {
                searchTerm,
                studentId,
                eventType,
                dateFrom,
                dateTo,
                status,
                sortBy,
                sortOrder
            },
            user: req.session.user
        });

    } catch (error) {
        console.error('Search events error:', error);
        res.render('parents/search-events', {
            title: 'Search Events - School Events',
            events: { registered: [], available: [], all: [] },
            students: [],
            eventTypes: [],
            filters: {},
            error: 'Failed to search events',
            user: req.session.user
        });
    }
});

// Search students (AJAX endpoint)
router.get('/search-students', requireAuth, async (req, res) => {
    try {
        const parentId = req.session.user.id;
        const { searchTerm = '' } = req.query;

        let query = `
            SELECT id, first_name, last_name, grade, section, age
            FROM students 
            WHERE parent_id = $1
        `;

        const queryParams = [parentId];

        if (searchTerm) {
            query += ` AND (
                first_name ILIKE $2 OR 
                last_name ILIKE $2 OR 
                CONCAT(first_name, ' ', last_name) ILIKE $2 OR
                grade::text ILIKE $2 OR
                section ILIKE $2
            )`;
            queryParams.push(`%${searchTerm}%`);
        }

        query += ` ORDER BY first_name, last_name`;

        const result = await db.query(query, queryParams);

        res.json({
            success: true,
            students: result.rows
        });

    } catch (error) {
        console.error('Search students error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to search students'
        });
    }
});

// Get events for specific student
router.get('/students/:studentId/events', requireAuth, async (req, res) => {
    try {
        const parentId = req.session.user.id;
        const studentId = req.params.studentId;

        // Verify the student belongs to the parent
        const studentResult = await db.query(`
            SELECT * FROM students WHERE id = $1 AND parent_id = $2
        `, [studentId, parentId]);

        if (studentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Student not found'
            });
        }

        const student = studentResult.rows[0];

        // Get all events and registration status for this student
        const eventsResult = await db.query(`
            SELECT 
                e.*,
                er.registration_date,
                er.payment_status,
                er.payment_amount
            FROM events e
            LEFT JOIN event_registrations er ON e.id = er.event_id AND er.student_id = $1
            WHERE e.status = 'active'
            ORDER BY e.start_date ASC
        `, [studentId]);

        const events = eventsResult.rows.map(event => ({
            ...event,
            start_date: moment(event.start_date).format('MMM DD, YYYY HH:mm'),
            end_date: moment(event.end_date).format('MMM DD, YYYY HH:mm'),
            registration_date: event.registration_date ? moment(event.registration_date).format('MMM DD, YYYY') : null,
            is_registered: !!event.registration_date
        }));

        res.json({
            success: true,
            student,
            events
        });

    } catch (error) {
        console.error('Get student events error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get student events'
        });
    }
});

// Get event statistics for parent
router.get('/event-stats', requireAuth, async (req, res) => {
    try {
        const parentId = req.session.user.id;

        const statsResult = await db.query(`
            SELECT 
                COUNT(DISTINCT er.event_id) as total_events_registered,
                COUNT(er.id) as total_registrations,
                SUM(er.payment_amount) as total_fees_paid,
                COUNT(CASE WHEN er.payment_status = 'pending' THEN 1 END) as pending_payments,
                COUNT(CASE WHEN er.payment_status = 'paid' THEN 1 END) as paid_registrations,
                AVG(er.payment_amount) as average_fee
            FROM event_registrations er
            WHERE er.parent_id = $1
        `, [parentId]);

        // Get events by type
        const eventsByTypeResult = await db.query(`
            SELECT 
                e.event_type,
                COUNT(er.id) as registration_count
            FROM events e
            JOIN event_registrations er ON e.id = er.event_id
            WHERE er.parent_id = $1
            GROUP BY e.event_type
            ORDER BY registration_count DESC
        `, [parentId]);

        // Get monthly registration trend
        const monthlyTrendResult = await db.query(`
            SELECT 
                DATE_TRUNC('month', er.registration_date) as month,
                COUNT(er.id) as registrations
            FROM event_registrations er
            WHERE er.parent_id = $1
            GROUP BY DATE_TRUNC('month', er.registration_date)
            ORDER BY month DESC
            LIMIT 6
        `, [parentId]);

        res.json({
            success: true,
            stats: statsResult.rows[0],
            eventsByType: eventsByTypeResult.rows,
            monthlyTrend: monthlyTrendResult.rows.map(row => ({
                month: moment(row.month).format('MMM YYYY'),
                registrations: parseInt(row.registrations)
            }))
        });

    } catch (error) {
        console.error('Get event stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get event statistics'
        });
    }
});

// Feedback form (GET)
router.get('/feedback', requireAuth, (req, res) => {
    res.render('parents/feedback', {
        title: 'Parent Feedback - School Events',
        user: req.session.user,
        success: req.query.success,
        error: req.query.error
    });
});

// Submit feedback (POST)
router.post('/feedback', requireAuth, async (req, res) => {
    const { message, rating } = req.body;
    const parentId = req.session.user.id;
    try {
        if (!message || message.trim().length < 5) {
            return res.redirect('/parents/feedback?error=Please enter a meaningful message.');
        }
        await db.query(
            'INSERT INTO feedback (parent_id, message, rating) VALUES ($1, $2, $3)',
            [parentId, message.trim(), rating ? parseInt(rating) : null]
        );
        res.redirect('/parents/feedback?success=Thank you for your feedback!');
    } catch (error) {
        console.error('Feedback submit error:', error);
        res.redirect('/parents/feedback?error=Failed to submit feedback');
    }
});

module.exports = router; 