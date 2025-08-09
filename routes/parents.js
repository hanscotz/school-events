const express = require('express');
const moment = require('moment');
const db = require('../database/connection');
const paymentService = require('../services/paymentService');
const notificationService = require('../services/notificationService');
const { requireAuth, requireParent } = require('./auth');
const router = express.Router();

// Parent Dashboard
router.get('/dashboard', requireParent, async (req, res) => {
    try {
        const parentId = req.session.user.id;

        // Get parent's children
        const childrenResult = await db.query(`
            SELECT 
                s.*,
                s.first_name || ' ' || s.last_name as full_name,
                u.first_name || ' ' || u.last_name as teacher_name
            FROM students s
            LEFT JOIN users u ON s.class_teacher_id = u.id
            WHERE s.parent_id = $1 AND s.is_active = true
            ORDER BY s.grade, s.first_name
        `, [parentId]);

        // Get pending payments
        const pendingPaymentsResult = await paymentService.getPendingPayments(parentId);

        // Get recent registrations
        const recentRegistrationsResult = await db.query(`
            SELECT 
                er.*,
                e.title as event_title,
                e.start_date as event_date,
                e.location as event_location,
                s.first_name || ' ' || s.last_name as student_name,
                t.first_name || ' ' || t.last_name as teacher_name
            FROM event_registrations er
            JOIN events e ON er.event_id = e.id
            JOIN students s ON er.student_id = s.id
            JOIN users t ON er.teacher_id = t.id
            WHERE er.parent_id = $1
            ORDER BY er.registration_date DESC
            LIMIT 5
        `, [parentId]);

        // Get unread notifications
        const notificationsResult = await db.query(`
            SELECT * FROM notifications 
            WHERE user_id = $1 AND is_read = false
            ORDER BY created_at DESC
            LIMIT 10
        `, [parentId]);

        // Get payment history summary
        const paymentHistoryResult = await paymentService.getParentPaymentHistory(parentId, 5, 0);

        res.render('parents/dashboard', {
            title: 'Parent Dashboard - School Events',
            children: childrenResult.rows,
            pendingPayments: pendingPaymentsResult.success ? pendingPaymentsResult.pendingPayments : [],
            recentRegistrations: recentRegistrationsResult.rows,
            notifications: notificationsResult.rows,
            paymentHistory: paymentHistoryResult.success ? paymentHistoryResult.payments : [],
            user: req.session.user,
            moment
        });

    } catch (error) {
        console.error('Parent dashboard error:', error);
        res.render('parents/dashboard', {
            title: 'Parent Dashboard - School Events',
            children: [],
            pendingPayments: [],
            recentRegistrations: [],
            notifications: [],
            paymentHistory: [],
            error: 'Failed to load dashboard data',
            user: req.session.user,
            moment
        });
    }
});

// View all children
router.get('/students', requireParent, async (req, res) => {
    try {
        const parentId = req.session.user.id;

        const childrenResult = await db.query(`
            SELECT 
                s.*,
                s.first_name || ' ' || s.last_name as full_name,
                u.first_name || ' ' || u.last_name as teacher_name,
                u.email as teacher_email,
                COUNT(er.id) as event_count
            FROM students s
            LEFT JOIN users u ON s.class_teacher_id = u.id
            LEFT JOIN event_registrations er ON s.id = er.student_id
            WHERE s.parent_id = $1 AND s.is_active = true
            GROUP BY s.id, u.first_name, u.last_name, u.email
            ORDER BY s.grade, s.first_name
        `, [parentId]);

        res.render('parents/students', {
            title: 'My Children - School Events',
            students: childrenResult.rows,
            success: req.query.success,
            error: req.query.error,
            user: req.session.user,
            moment
        });

    } catch (error) {
        console.error('Students page error:', error);
        res.render('parents/students', {
            title: 'My Children - School Events',
            students: [],
            error: 'Failed to load children data',
            user: req.session.user,
            moment
        });
    }
});

// Add child to parent account - form
router.get('/students/add', requireParent, async (req, res) => {
    try {
        const classes = await db.query(`SELECT DISTINCT grade, section FROM classes WHERE is_active = true ORDER BY grade, section`);
        res.render('parents/add-student', {
            title: 'Add Child - School Events',
            classes: classes.rows,
            user: req.session.user
        });
    } catch (error) {
        console.error('Parent add child page error:', error);
        res.render('error', { title: 'Error', error: 'Failed to load page', user: req.session.user });
    }
});

// Add child to parent account - submit
router.post('/students/add', requireParent, async (req, res) => {
    try {
        const parentId = req.session.user.id;
        const { indexNo, firstName, lastName, dateOfBirth, grade, section } = req.body;

        // Verify student exists and is not already linked to another parent
        const studentResult = await db.query(`
            SELECT id, parent_id FROM students 
            WHERE student_id = $1 AND LOWER(first_name) = LOWER($2) AND LOWER(last_name) = LOWER($3)
              AND date_of_birth = $4 AND grade = $5 AND section = $6 AND is_active = true
        `, [indexNo, firstName, lastName, dateOfBirth, grade, section]);

        if (studentResult.rows.length === 0) {
            const classes = await db.query(`SELECT DISTINCT grade, section FROM classes WHERE is_active = true ORDER BY grade, section`);
            return res.render('parents/add-student', {
                title: 'Add Child - School Events',
                error: 'We could not verify the student with the provided details.',
                classes: classes.rows,
                formData: req.body,
                user: req.session.user
            });
        }

        const student = studentResult.rows[0];
        if (student.parent_id && student.parent_id !== parentId) {
            const classes = await db.query(`SELECT DISTINCT grade, section FROM classes WHERE is_active = true ORDER BY grade, section`);
            return res.render('parents/add-student', {
                title: 'Add Child - School Events',
                error: 'This student is already linked to another parent account.',
                classes: classes.rows,
                formData: req.body,
                user: req.session.user
            });
        }

        await db.query(`UPDATE students SET parent_id = $1 WHERE id = $2`, [parentId, student.id]);
        res.redirect('/parents/students?success=Child added to your account');
    } catch (error) {
        console.error('Parent add child submit error:', error);
        res.render('parents/add-student', {
            title: 'Add Child - School Events',
            error: 'An error occurred. Please try again.',
            user: req.session.user
        });
    }
});

// View child's event registrations
router.get('/students/:studentId/events', requireParent, async (req, res) => {
    try {
        const parentId = req.session.user.id;
        const studentId = req.params.studentId;

        // Verify student belongs to parent
        const studentResult = await db.query(`
            SELECT s.*, s.first_name || ' ' || s.last_name as full_name
            FROM students s
            WHERE s.id = $1 AND s.parent_id = $2 AND s.is_active = true
        `, [studentId, parentId]);

        if (studentResult.rows.length === 0) {
            return res.status(404).render('error', {
                title: 'Student Not Found',
                error: 'Student not found or access denied',
                user: req.session.user
            });
        }

        const student = studentResult.rows[0];

        // Get student's event registrations
        const registrationsResult = await db.query(`
            SELECT 
                er.*,
                e.title as event_title,
                e.description as event_description,
                e.start_date as event_date,
                e.end_date as event_end_date,
                e.location as event_location,
                e.event_type,
                e.category,
                t.first_name || ' ' || t.last_name as teacher_name,
                CASE 
                    WHEN er.payment_status = 'pending' AND e.registration_deadline > CURRENT_TIMESTAMP 
                    THEN EXTRACT(DAYS FROM (e.registration_deadline - CURRENT_TIMESTAMP))
                    ELSE NULL
                END as days_to_pay
            FROM event_registrations er
            JOIN events e ON er.event_id = e.id
            JOIN users t ON er.teacher_id = t.id
            WHERE er.student_id = $1
            ORDER BY e.start_date DESC
        `, [studentId]);

        res.render('parents/student-events', {
            title: `${student.full_name}'s Events - School Events`,
            student: student,
            registrations: registrationsResult.rows,
            user: req.session.user,
            moment
        });

    } catch (error) {
        console.error('Student events error:', error);
        res.status(500).render('error', {
            title: 'Error',
            error: 'Failed to load student events',
            user: req.session.user
        });
    }
});

// Payment page for a specific registration
router.get('/payment/:registrationId', requireParent, async (req, res) => {
    try {
        const parentId = req.session.user.id;
        const registrationId = req.params.registrationId;

        // Get registration details
        const registrationResult = await db.query(`
            SELECT 
                er.*,
                e.title as event_title,
                e.description as event_description,
                e.start_date as event_date,
                e.location as event_location,
                e.fee as event_fee,
                s.first_name || ' ' || s.last_name as student_name,
                t.first_name || ' ' || t.last_name as teacher_name
            FROM event_registrations er
            JOIN events e ON er.event_id = e.id
            JOIN students s ON er.student_id = s.id
            JOIN users t ON er.teacher_id = t.id
            WHERE er.id = $1 AND er.parent_id = $2
        `, [registrationId, parentId]);

        if (registrationResult.rows.length === 0) {
            return res.status(404).render('error', {
                title: 'Registration Not Found',
                error: 'Registration not found or access denied',
                user: req.session.user
            });
        }

        const registration = registrationResult.rows[0];

        if (registration.payment_status !== 'pending') {
            return res.redirect(`/parents/payment-history?message=Payment already processed`);
        }

        // Create payment intent
        const paymentIntentResult = await paymentService.createPaymentIntent({
            registrationId: registrationId,
            amount: registration.event_fee,
            parentId: parentId,
            studentName: registration.student_name,
            eventTitle: registration.event_title,
            parentEmail: req.session.user.email
        });

        if (!paymentIntentResult.success) {
            return res.render('parents/payment', {
                title: 'Payment - School Events',
                registration: registration,
                error: paymentIntentResult.error,
                user: req.session.user,
                moment
            });
        }

        res.render('parents/payment', {
            title: 'Payment - School Events',
            registration: registration,
            paymentData: paymentIntentResult,
            stripePublicKey: process.env.STRIPE_PUBLIC_KEY,
            user: req.session.user,
            moment
        });

    } catch (error) {
        console.error('Payment page error:', error);
        res.status(500).render('error', {
            title: 'Error',
            error: 'Failed to load payment page',
            user: req.session.user
        });
    }
});

// Process payment completion
router.post('/payment/:registrationId/complete', requireParent, async (req, res) => {
    try {
        const { paymentIntentId } = req.body;
        const parentId = req.session.user.id;
        const registrationId = req.params.registrationId;

        // Verify registration belongs to parent
        const registrationResult = await db.query(`
            SELECT id FROM event_registrations 
            WHERE id = $1 AND parent_id = $2
        `, [registrationId, parentId]);

        if (registrationResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Registration not found or access denied'
            });
        }

        // Process payment completion
        const paymentResult = await paymentService.processPaymentCompletion(paymentIntentId);

        if (!paymentResult.success) {
            return res.status(400).json({
                success: false,
                message: paymentResult.error
            });
        }

        res.json({
            success: true,
            message: 'Payment processed successfully',
            redirectUrl: '/parents/dashboard?success=Payment completed successfully'
        });

    } catch (error) {
        console.error('Payment completion error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while processing payment'
        });
    }
});

// Payment history
router.get('/payment-history', requireParent, async (req, res) => {
    try {
        const parentId = req.session.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const offset = (page - 1) * limit;

        const paymentHistoryResult = await paymentService.getParentPaymentHistory(parentId, limit, offset);

        if (!paymentHistoryResult.success) {
            throw new Error(paymentHistoryResult.error);
        }

        const totalPages = Math.ceil(paymentHistoryResult.total / limit);

        res.render('parents/payment-history', {
            title: 'Payment History - School Events',
            payments: paymentHistoryResult.payments,
            currentPage: page,
            totalPages: totalPages,
            totalPayments: paymentHistoryResult.total,
            message: req.query.message,
            user: req.session.user,
            moment
        });

    } catch (error) {
        console.error('Payment history error:', error);
        res.render('parents/payment-history', {
            title: 'Payment History - School Events',
            payments: [],
            currentPage: 1,
            totalPages: 1,
            totalPayments: 0,
            error: 'Failed to load payment history',
            user: req.session.user,
            moment
        });
    }
});

// Notifications page
router.get('/notifications', requireParent, async (req, res) => {
    try {
        const parentId = req.session.user.id;

        const notificationsResult = await db.query(`
            SELECT * FROM notifications 
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 50
        `, [parentId]);

        // Mark all notifications as read
        await db.query(`
            UPDATE notifications 
            SET is_read = true, read_at = CURRENT_TIMESTAMP
            WHERE user_id = $1 AND is_read = false
        `, [parentId]);

        res.render('parents/notifications', {
            title: 'Notifications - School Events',
            notifications: notificationsResult.rows,
            user: req.session.user,
            moment
        });

    } catch (error) {
        console.error('Notifications error:', error);
        res.render('parents/notifications', {
            title: 'Notifications - School Events',
            notifications: [],
            error: 'Failed to load notifications',
            user: req.session.user,
            moment
        });
    }
});

// Search and view all events
router.get('/search-events', requireParent, async (req, res) => {
    try {
        const { search, category, type } = req.query;
        let whereClause = "WHERE e.status = 'active'";
        let queryParams = [];
        let paramCount = 1;

        if (search) {
            whereClause += ` AND (e.title ILIKE $${paramCount} OR e.description ILIKE $${paramCount})`;
            queryParams.push(`%${search}%`);
            paramCount++;
        }

        if (category) {
            whereClause += ` AND e.category = $${paramCount}`;
            queryParams.push(category);
            paramCount++;
        }

        if (type) {
            whereClause += ` AND e.event_type = $${paramCount}`;
            queryParams.push(type);
            paramCount++;
        }

        const eventsResult = await db.query(`
            SELECT 
                e.*,
                COUNT(er.id) as registered_count,
                u.first_name || ' ' || u.last_name as created_by_name,
                ec.color as category_color,
                ec.icon as category_icon
            FROM events e
            LEFT JOIN event_registrations er ON e.id = er.event_id
            LEFT JOIN users u ON e.created_by = u.id
            LEFT JOIN event_categories ec ON e.category = ec.name
            ${whereClause}
            GROUP BY e.id, u.first_name, u.last_name, ec.color, ec.icon
            ORDER BY e.start_date ASC
        `, queryParams);

        // Get categories for filter
        const categoriesResult = await db.query(`
            SELECT DISTINCT category FROM events 
            WHERE status = 'active' AND category IS NOT NULL
            ORDER BY category
        `);

        // Get event types for filter
        const typesResult = await db.query(`
            SELECT DISTINCT event_type FROM events 
            WHERE status = 'active'
            ORDER BY event_type
        `);

        const events = eventsResult.rows.map(event => ({
            ...event,
            start_date_formatted: moment(event.start_date).format('MMMM DD, YYYY'),
            start_time_formatted: moment(event.start_date).format('HH:mm'),
            is_full: event.max_participants && event.registered_count >= event.max_participants,
            is_registration_open: !event.registration_deadline || 
                moment().isBefore(moment(event.registration_deadline))
        }));

        res.render('parents/search-events', {
            title: 'Browse Events - School Events',
            events: events,
            categories: categoriesResult.rows,
            eventTypes: typesResult.rows,
            filters: { search, category, type },
            user: req.session.user,
            moment
        });

    } catch (error) {
        console.error('Search events error:', error);
        res.render('parents/search-events', {
            title: 'Browse Events - School Events',
            events: [],
            categories: [],
            eventTypes: [],
            filters: {},
            error: 'Failed to load events',
            user: req.session.user,
            moment
        });
    }
});

// Submit feedback
router.get('/feedback', requireParent, (req, res) => {
    res.render('parents/feedback', {
        title: 'Feedback - School Events',
        user: req.session.user
    });
});

router.post('/feedback', requireParent, async (req, res) => {
    try {
        const { message, rating, category, eventId } = req.body;
        const parentId = req.session.user.id;

        if (!message) {
            return res.render('parents/feedback', {
                title: 'Feedback - School Events',
                error: 'Please provide your feedback message',
                formData: req.body,
                user: req.session.user
            });
        }

        await db.query(`
            INSERT INTO feedback (parent_id, event_id, message, rating, category)
            VALUES ($1, $2, $3, $4, $5)
        `, [parentId, eventId || null, message, rating ? parseInt(rating) : null, category || 'general']);

        res.render('parents/feedback', {
            title: 'Feedback - School Events',
            success: 'Thank you for your feedback! It has been submitted successfully.',
            user: req.session.user
        });

    } catch (error) {
        console.error('Feedback submission error:', error);
        res.render('parents/feedback', {
            title: 'Feedback - School Events',
            error: 'An error occurred while submitting your feedback',
            formData: req.body,
            user: req.session.user
        });
    }
});

// API endpoint to get unread notification count
router.get('/api/notification-count', requireParent, async (req, res) => {
    try {
        const parentId = req.session.user.id;

        const result = await db.query(`
            SELECT COUNT(*) as count 
            FROM notifications 
            WHERE user_id = $1 AND is_read = false
        `, [parentId]);

        res.json({
            success: true,
            count: parseInt(result.rows[0].count)
        });

    } catch (error) {
        console.error('Notification count error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get notification count'
        });
    }
});

module.exports = router;