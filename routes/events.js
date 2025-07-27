const express = require('express');
const moment = require('moment');
const db = require('../database/connection');
const emailService = require('../services/emailService');
const { requireAuth, requireAdmin } = require('./auth');
const router = express.Router();

// Get all events
router.get('/', async (req, res) => {
    try {
        const eventsResult = await db.query(`
            SELECT e.*, 
                   COUNT(er.id) as registered_count,
                   u.first_name as created_by_name
            FROM events e
            LEFT JOIN event_registrations er ON e.id = er.event_id
            LEFT JOIN users u ON e.created_by = u.id
            WHERE e.status = 'active'
            GROUP BY e.id, u.first_name
            ORDER BY e.start_date ASC
        `);

        const events = eventsResult.rows.map(event => ({
            ...event,
            start_date: moment(event.start_date).format('YYYY-MM-DD HH:mm'),
            end_date: moment(event.end_date).format('YYYY-MM-DD HH:mm'),
            is_full: event.current_participants >= event.max_participants
        }));

        res.render('events/index', { 
            title: 'Events - School Events',
            events,
            user: req.session.user 
        });

    } catch (error) {
        console.error('Events error:', error);
        res.render('events/index', { 
            title: 'Events - School Events',
            events: [],
            error: 'Failed to load events',
            user: req.session.user 
        });
    }
});

// Admin routes for event management
router.get('/admin/create', requireAdmin, (req, res) => {
    res.render('events/create', { 
        title: 'Create Event - School Events',
        user: req.session.user 
    });
});

router.post('/admin/create', requireAdmin, async (req, res) => {
    try {
        const {
            title,
            description,
            event_type,
            location,
            start_date,
            end_date,
            fee,
            max_participants
        } = req.body;

        // Validate input
        if (!title || !event_type || !location || !start_date || !end_date) {
            return res.render('events/create', { 
                title: 'Create Event - School Events',
                error: 'Please fill in all required fields',
                user: req.session.user 
            });
        }

        // Create event
        const eventResult = await db.query(`
            INSERT INTO events (title, description, event_type, location, start_date, end_date, fee, max_participants, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `, [
            title,
            description,
            event_type,
            location,
            start_date,
            end_date,
            parseFloat(fee) || 0,
            parseInt(max_participants) || null,
            req.session.user.id
        ]);

        const event = eventResult.rows[0];

        // Send notifications to all parents
        await emailService.sendBulkEventNotification({
            title: event.title,
            start_date: moment(event.start_date).format('MMMM DD, YYYY at HH:mm'),
            event_type: event.event_type,
            fee: event.fee
        });

        res.redirect(`/events/${event.id}?success=Event created successfully`);

    } catch (error) {
        console.error('Create event error:', error);
        res.render('events/create', { 
            title: 'Create Event - School Events',
            error: 'Failed to create event',
            user: req.session.user 
        });
    }
});

// Edit event
router.get('/admin/:id/edit', requireAdmin, async (req, res) => {
    try {
        const eventId = req.params.id;
        const eventResult = await db.query(
            'SELECT * FROM events WHERE id = $1',
            [eventId]
        );

        if (eventResult.rows.length === 0) {
            return res.status(404).render('error', { 
                title: 'Event Not Found',
                error: 'Event not found',
                user: req.session.user 
            });
        }

        const event = eventResult.rows[0];
        event.start_date = moment(event.start_date).format('YYYY-MM-DDTHH:mm');
        event.end_date = moment(event.end_date).format('YYYY-MM-DDTHH:mm');

        res.render('events/edit', { 
            title: 'Edit Event - School Events',
            event,
            user: req.session.user 
        });

    } catch (error) {
        console.error('Edit event error:', error);
        res.redirect('/events');
    }
});

router.post('/admin/:id/edit', requireAdmin, async (req, res) => {
    try {
        const eventId = req.params.id;
        const {
            title,
            description,
            event_type,
            location,
            start_date,
            end_date,
            fee,
            max_participants,
            status
        } = req.body;

        await db.query(`
            UPDATE events 
            SET title = $1, description = $2, event_type = $3, location = $4, 
                start_date = $5, end_date = $6, fee = $7, max_participants = $8, 
                status = $9, updated_at = CURRENT_TIMESTAMP
            WHERE id = $10
        `, [
            title,
            description,
            event_type,
            location,
            start_date,
            end_date,
            parseFloat(fee) || 0,
            parseInt(max_participants) || null,
            status,
            eventId
        ]);

        res.redirect(`/events/${eventId}?success=Event updated successfully`);

    } catch (error) {
        console.error('Update event error:', error);
        res.redirect(`/events/${req.params.id}/edit?error=Failed to update event`);
    }
});

// Delete event
router.post('/admin/:id/delete', requireAdmin, async (req, res) => {
    try {
        const eventId = req.params.id;

        // Check if there are registrations
        const registrationsResult = await db.query(
            'SELECT COUNT(*) as count FROM event_registrations WHERE event_id = $1',
            [eventId]
        );

        if (parseInt(registrationsResult.rows[0].count) > 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Cannot delete event with existing registrations' 
            });
        }

        await db.query('DELETE FROM events WHERE id = $1', [eventId]);

        res.json({ 
            success: true, 
            message: 'Event deleted successfully' 
        });

    } catch (error) {
        console.error('Delete event error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to delete event' 
        });
    }
});

// Get single event (add numeric validation)
router.get('/:id', async (req, res) => {
    try {
        const eventId = req.params.id;
        if (!/^[0-9]+$/.test(eventId)) {
            return res.status(400).render('error', {
                title: 'Invalid Event ID',
                error: 'Invalid event ID',
                user: req.session.user
            });
        }

        const eventResult = await db.query(`
            SELECT e.*, 
                   COUNT(er.id) as registered_count,
                   u.first_name as created_by_name
            FROM events e
            LEFT JOIN event_registrations er ON e.id = er.event_id
            LEFT JOIN users u ON e.created_by = u.id
            WHERE e.id = $1
            GROUP BY e.id, u.first_name
        `, [eventId]);

        if (eventResult.rows.length === 0) {
            return res.status(404).render('error', { 
                title: 'Event Not Found',
                error: 'Event not found',
                user: req.session.user 
            });
        }

        const event = eventResult.rows[0];
        event.start_date = moment(event.start_date).format('YYYY-MM-DD HH:mm');
        event.end_date = moment(event.end_date).format('YYYY-MM-DD HH:mm');

        // Get registered students for this event
        const registrationsResult = await db.query(`
            SELECT er.*, s.first_name as student_first_name, s.last_name as student_last_name,
                   u.first_name as parent_first_name, u.last_name as parent_last_name
            FROM event_registrations er
            JOIN students s ON er.student_id = s.id
            JOIN users u ON er.parent_id = u.id
            WHERE er.event_id = $1
            ORDER BY er.registration_date DESC
        `, [eventId]);

        res.render('events/show', { 
            title: `${event.title} - School Events`,
            event,
            registrations: registrationsResult.rows,
            user: req.session.user 
        });

    } catch (error) {
        console.error('Event detail error:', error);
        res.status(500).render('error', { 
            title: 'Error',
            error: 'Failed to load event details',
            user: req.session.user 
        });
    }
});

// Register for event (POST)
router.post('/:id/register', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.id;
        const { studentId } = req.body;
        const parentId = req.session.user.id;

        // Validate student belongs to parent
        const studentResult = await db.query(
            'SELECT * FROM students WHERE id = $1 AND parent_id = $2',
            [studentId, parentId]
        );

        if (studentResult.rows.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid student selected' 
            });
        }

        // Check if already registered
        const existingRegistration = await db.query(
            'SELECT * FROM event_registrations WHERE event_id = $1 AND student_id = $2',
            [eventId, studentId]
        );

        if (existingRegistration.rows.length > 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Student is already registered for this event' 
            });
        }

        // Get event details
        const eventResult = await db.query(
            'SELECT * FROM events WHERE id = $1',
            [eventId]
        );

        if (eventResult.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Event not found' 
            });
        }

        const event = eventResult.rows[0];

        // Check if event is full
        if (event.current_participants >= event.max_participants) {
            return res.status(400).json({ 
                success: false, 
                error: 'Event is full' 
            });
        }

        // Create registration
        const registrationResult = await db.query(`
            INSERT INTO event_registrations (event_id, student_id, parent_id, payment_amount)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [eventId, studentId, parentId, event.fee]);

        // Update event participant count
        await db.query(
            'UPDATE events SET current_participants = current_participants + 1 WHERE id = $1',
            [eventId]
        );

        // Send email notification
        const student = studentResult.rows[0];
        const parentName = `${req.session.user.firstName} ${req.session.user.lastName}`;
        const studentName = `${student.first_name} ${student.last_name}`;
        
        await emailService.sendEventRegistrationEmail(
            req.session.user.email,
            parentName,
            studentName,
            event.title,
            moment(event.start_date).format('MMMM DD, YYYY at HH:mm'),
            event.fee
        );

        // Create notification
        await db.query(`
            INSERT INTO notifications (user_id, title, message, type)
            VALUES ($1, $2, $3, $4)
        `, [
            parentId,
            'Event Registration Successful',
            `Your child ${studentName} has been registered for ${event.title}`,
            'success'
        ]);

        res.json({ 
            success: true, 
            message: 'Registration successful! Check your email for confirmation.' 
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Registration failed. Please try again.' 
        });
    }
});

// Get parent's students for event registration (AJAX endpoint)
router.get('/:id/registration-students', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.id;
        const parentId = req.session.user.id;

        console.log('Fetching students for parent:', parentId, 'event:', eventId);

        // Get parent's students
        const studentsResult = await db.query(`
            SELECT s.id, s.first_name, s.last_name, s.grade, s.section, s.date_of_birth
            FROM students s
            WHERE s.parent_id = $1
            ORDER BY s.first_name, s.last_name
        `, [parentId]);

        console.log('Students found:', studentsResult.rows.length);

        // Check which students are already registered for this event
        const registeredStudentsResult = await db.query(`
            SELECT er.student_id
            FROM event_registrations er
            WHERE er.event_id = $1 AND er.parent_id = $2
        `, [eventId, parentId]);

        const registeredStudentIds = registeredStudentsResult.rows.map(row => row.student_id);
        console.log('Already registered student IDs:', registeredStudentIds);

        // Add registration status to each student
        const students = studentsResult.rows.map(student => ({
            ...student,
            is_registered: registeredStudentIds.includes(student.id),
            full_name: `${student.first_name} ${student.last_name}`
        }));

        console.log('Final students data:', students);

        res.json({
            success: true,
            students: students
        });

    } catch (error) {
        console.error('Get registration students error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load students'
        });
    }
});

// Cancel registration
router.post('/:id/cancel', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.id;
        const { studentId } = req.body;
        const parentId = req.session.user.id;

        // Find registration
        const registrationResult = await db.query(`
            SELECT er.*, e.title, s.first_name as student_first_name, s.last_name as student_last_name
            FROM event_registrations er
            JOIN events e ON er.event_id = e.id
            JOIN students s ON er.student_id = s.id
            WHERE er.event_id = $1 AND er.student_id = $2 AND er.parent_id = $3
        `, [eventId, studentId, parentId]);

        if (registrationResult.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Registration not found' 
            });
        }

        const registration = registrationResult.rows[0];

        // Delete registration
        await db.query(
            'DELETE FROM event_registrations WHERE id = $1',
            [registration.id]
        );

        // Update event participant count
        await db.query(
            'UPDATE events SET current_participants = current_participants - 1 WHERE id = $1',
            [eventId]
        );

        // Create notification
        await db.query(`
            INSERT INTO notifications (user_id, title, message, type)
            VALUES ($1, $2, $3, $4)
        `, [
            parentId,
            'Registration Cancelled',
            `Registration for ${registration.title} has been cancelled`,
            'info'
        ]);

        res.json({ 
            success: true, 
            message: 'Registration cancelled successfully' 
        });

    } catch (error) {
        console.error('Cancel registration error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to cancel registration' 
        });
    }
});

module.exports = router; 