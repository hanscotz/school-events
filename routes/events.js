const express = require('express');
const moment = require('moment');
const db = require('../database/connection');
const notificationService = require('../services/notificationService');
const { requireAuth, requireAdmin, requireTeacher, requireAdminOrTeacher } = require('./auth');
const router = express.Router();

// Get all events (public view)
router.get('/', async (req, res) => {
    try {
        const eventsResult = await db.query(`
            SELECT e.*, 
                   COUNT(er.id) as registered_count,
                   u.first_name || ' ' || u.last_name as created_by_name,
                   ec.name as category_name,
                   ec.color as category_color,
                   ec.icon as category_icon
            FROM events e
            LEFT JOIN event_registrations er ON e.id = er.event_id
            LEFT JOIN users u ON e.created_by = u.id
            LEFT JOIN event_categories ec ON e.category = ec.name
            WHERE e.status = 'active'
            GROUP BY e.id, u.first_name, u.last_name, ec.name, ec.color, ec.icon
            ORDER BY e.start_date ASC
        `);

        const events = eventsResult.rows.map(event => ({
            ...event,
            start_date_formatted: moment(event.start_date).format('MMMM DD, YYYY'),
            start_time_formatted: moment(event.start_date).format('HH:mm'),
            end_date_formatted: moment(event.end_date).format('MMMM DD, YYYY'),
            end_time_formatted: moment(event.end_date).format('HH:mm'),
            registration_deadline_formatted: event.registration_deadline ? 
                moment(event.registration_deadline).format('MMMM DD, YYYY') : null,
            is_full: event.max_participants && event.registered_count >= event.max_participants,
            days_until_event: moment(event.start_date).diff(moment(), 'days'),
            is_registration_open: !event.registration_deadline || 
                moment().isBefore(moment(event.registration_deadline))
        }));

        res.render('events/index', { 
            title: 'School Events',
            events,
            user: req.session.user,
            moment
        });

    } catch (error) {
        console.error('Events error:', error);
        res.render('events/index', { 
            title: 'School Events',
            events: [],
            error: 'Failed to load events',
            user: req.session.user,
            moment
        });
    }
});

// Get single event details
router.get('/:id', async (req, res) => {
    try {
        const eventResult = await db.query(`
            SELECT e.*, 
                   u.first_name || ' ' || u.last_name as created_by_name,
                   ec.name as category_name,
                   ec.color as category_color,
                   ec.icon as category_icon,
                   COUNT(er.id) as registered_count
            FROM events e
            LEFT JOIN users u ON e.created_by = u.id
            LEFT JOIN event_categories ec ON e.category = ec.name
            LEFT JOIN event_registrations er ON e.id = er.event_id
            WHERE e.id = $1
            GROUP BY e.id, u.first_name, u.last_name, ec.name, ec.color, ec.icon
        `, [req.params.id]);

        if (eventResult.rows.length === 0) {
            return res.status(404).render('error', { 
                title: 'Event Not Found',
                error: 'Event not found',
                user: req.session.user 
            });
        }

        const event = eventResult.rows[0];

        // Get registered students for this event (if user is teacher or admin)
        let registrations = [];
        if (req.session.user && ['teacher', 'admin'].includes(req.session.user.role)) {
            const registrationsResult = await db.query(`
                SELECT 
                    er.*,
                    s.first_name || ' ' || s.last_name as student_name,
                    s.grade,
                    s.section,
                    u.first_name || ' ' || u.last_name as parent_name,
                    u.email as parent_email,
                    u.phone as parent_phone,
                    t.first_name || ' ' || t.last_name as teacher_name
                FROM event_registrations er
                JOIN students s ON er.student_id = s.id
                JOIN users u ON er.parent_id = u.id
                JOIN users t ON er.teacher_id = t.id
                WHERE er.event_id = $1
                ORDER BY er.registration_date DESC
            `, [req.params.id]);
            
            registrations = registrationsResult.rows;
        }

        res.render('events/show', { 
            title: `${event.title} - School Events`,
            event: {
                ...event,
                start_date_formatted: moment(event.start_date).format('MMMM DD, YYYY'),
                start_time_formatted: moment(event.start_date).format('HH:mm'),
                end_date_formatted: moment(event.end_date).format('MMMM DD, YYYY'),
                end_time_formatted: moment(event.end_date).format('HH:mm'),
                registration_deadline_formatted: event.registration_deadline ? 
                    moment(event.registration_deadline).format('MMMM DD, YYYY') : null,
                is_full: event.max_participants && event.registered_count >= event.max_participants,
                is_registration_open: !event.registration_deadline || 
                    moment().isBefore(moment(event.registration_deadline))
            },
            registrations,
            user: req.session.user,
            moment
        });

    } catch (error) {
        console.error('Event details error:', error);
        res.status(500).render('error', { 
            title: 'Error',
            error: 'Failed to load event details',
            user: req.session.user 
        });
    }
});

// ADMIN ONLY: Create event page
router.get('/create', requireAdmin, async (req, res) => {
    try {
        // Get event categories
        const categoriesResult = await db.query(`
            SELECT * FROM event_categories 
            WHERE is_active = true 
            ORDER BY name
        `);

        res.render('events/create', { 
            title: 'Create Event - School Events',
            categories: categoriesResult.rows,
            user: req.session.user 
        });

    } catch (error) {
        console.error('Create event page error:', error);
        res.render('events/create', { 
            title: 'Create Event - School Events',
            categories: [],
            error: 'Failed to load page',
            user: req.session.user 
        });
    }
});

// ADMIN ONLY: Create event POST
router.post('/create', requireAdmin, async (req, res) => {
    try {
        const {
            title,
            description,
            event_type,
            category,
            location,
            start_date,
            end_date,
            registration_deadline,
            fee,
            max_participants,
            min_age,
            max_age
        } = req.body;

        // Validate input
        if (!title || !event_type || !location || !start_date || !end_date) {
            const categoriesResult = await db.query(`
                SELECT * FROM event_categories 
                WHERE is_active = true 
                ORDER BY name
            `);

            return res.render('events/create', { 
                title: 'Create Event - School Events',
                categories: categoriesResult.rows,
                error: 'Please fill in all required fields',
                formData: req.body,
                user: req.session.user 
            });
        }

        // Validate dates
        if (moment(start_date).isAfter(moment(end_date))) {
            const categoriesResult = await db.query(`
                SELECT * FROM event_categories 
                WHERE is_active = true 
                ORDER BY name
            `);

            return res.render('events/create', { 
                title: 'Create Event - School Events',
                categories: categoriesResult.rows,
                error: 'Start date must be before end date',
                formData: req.body,
                user: req.session.user 
            });
        }

        // Create event
        const eventResult = await db.query(`
            INSERT INTO events (
                title, description, event_type, category, location, 
                start_date, end_date, registration_deadline, fee, 
                max_participants, min_age, max_age, created_by, status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'active')
            RETURNING *
        `, [
            title,
            description,
            event_type,
            category,
            location,
            start_date,
            end_date,
            registration_deadline || null,
            parseFloat(fee) || 0,
            parseInt(max_participants) || null,
            parseInt(min_age) || null,
            parseInt(max_age) || null,
            req.session.user.id
        ]);

        const event = eventResult.rows[0];

        // Create notification for all users about new event
        const allUsersResult = await db.query(`
            SELECT id FROM users 
            WHERE role IN ('parent', 'teacher') 
            AND is_active = true
        `);

        for (const user of allUsersResult.rows) {
            await notificationService.createInAppNotification({
                userId: user.id,
                title: `New Event: ${event.title}`,
                message: `A new ${event.event_type} event has been created. Check it out!`,
                type: 'info',
                category: 'event',
                actionUrl: `/events/${event.id}`
            });
        }

        res.redirect(`/events/${event.id}?success=Event created successfully`);

    } catch (error) {
        console.error('Create event error:', error);
        
        const categoriesResult = await db.query(`
            SELECT * FROM event_categories 
            WHERE is_active = true 
            ORDER BY name
        `);

        res.render('events/create', { 
            title: 'Create Event - School Events',
            categories: categoriesResult.rows,
            error: 'An error occurred while creating the event',
            formData: req.body,
            user: req.session.user 
        });
    }
});

// ADMIN ONLY: Edit event page
router.get('/:id/edit', requireAdmin, async (req, res) => {
    try {
        const eventResult = await db.query(`
            SELECT * FROM events WHERE id = $1
        `, [req.params.id]);

        if (eventResult.rows.length === 0) {
            return res.status(404).render('error', { 
                title: 'Event Not Found',
                error: 'Event not found',
                user: req.session.user 
            });
        }

        const categoriesResult = await db.query(`
            SELECT * FROM event_categories 
            WHERE is_active = true 
            ORDER BY name
        `);

        const event = eventResult.rows[0];

        res.render('events/edit', { 
            title: `Edit ${event.title} - School Events`,
            event: {
                ...event,
                start_date: moment(event.start_date).format('YYYY-MM-DDTHH:mm'),
                end_date: moment(event.end_date).format('YYYY-MM-DDTHH:mm'),
                registration_deadline: event.registration_deadline ? 
                    moment(event.registration_deadline).format('YYYY-MM-DDTHH:mm') : ''
            },
            categories: categoriesResult.rows,
            user: req.session.user 
        });

    } catch (error) {
        console.error('Edit event page error:', error);
        res.status(500).render('error', { 
            title: 'Error',
            error: 'Failed to load event for editing',
            user: req.session.user 
        });
    }
});

// ADMIN ONLY: Update event POST
router.post('/:id/edit', requireAdmin, async (req, res) => {
    try {
        const eventId = req.params.id;
        const {
            title,
            description,
            event_type,
            category,
            location,
            start_date,
            end_date,
            registration_deadline,
            fee,
            max_participants,
            min_age,
            max_age,
            status
        } = req.body;

        // Validate input
        if (!title || !event_type || !location || !start_date || !end_date) {
            return res.redirect(`/events/${eventId}/edit?error=Please fill in all required fields`);
        }

        // Update event
        await db.query(`
            UPDATE events 
            SET 
                title = $1, description = $2, event_type = $3, category = $4,
                location = $5, start_date = $6, end_date = $7, 
                registration_deadline = $8, fee = $9, max_participants = $10,
                min_age = $11, max_age = $12, status = $13, updated_at = CURRENT_TIMESTAMP
            WHERE id = $14
        `, [
            title, description, event_type, category, location,
            start_date, end_date, registration_deadline || null,
            parseFloat(fee) || 0, parseInt(max_participants) || null,
            parseInt(min_age) || null, parseInt(max_age) || null,
            status, eventId
        ]);

        res.redirect(`/events/${eventId}?success=Event updated successfully`);

    } catch (error) {
        console.error('Update event error:', error);
        res.redirect(`/events/${req.params.id}/edit?error=An error occurred while updating the event`);
    }
});

// ADMIN ONLY: Delete event
router.post('/:id/delete', requireAdmin, async (req, res) => {
    try {
        // Check if there are any registrations
        const registrationsResult = await db.query(`
            SELECT COUNT(*) as count FROM event_registrations WHERE event_id = $1
        `, [req.params.id]);

        const registrationCount = parseInt(registrationsResult.rows[0].count);

        if (registrationCount > 0) {
            return res.redirect(`/events/${req.params.id}?error=Cannot delete event with existing registrations`);
        }

        // Delete event
        await db.query(`
            DELETE FROM events WHERE id = $1
        `, [req.params.id]);

        res.redirect('/events?success=Event deleted successfully');

    } catch (error) {
        console.error('Delete event error:', error);
        res.redirect(`/events/${req.params.id}?error=An error occurred while deleting the event`);
    }
});

// TEACHER ONLY: Register student for event
router.post('/:eventId/register-student', requireTeacher, async (req, res) => {
    try {
        const { studentId } = req.body;
        const eventId = req.params.eventId;
        const teacherId = req.session.user.id;

        // Validate input
        if (!studentId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Student ID is required' 
            });
        }

        // Check if event exists and is active
        const eventResult = await db.query(`
            SELECT * FROM events 
            WHERE id = $1 AND status = 'active'
        `, [eventId]);

        if (eventResult.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Event not found or inactive' 
            });
        }

        const event = eventResult.rows[0];

        // Check if registration deadline has passed
        if (event.registration_deadline && moment().isAfter(moment(event.registration_deadline))) {
            return res.status(400).json({ 
                success: false, 
                message: 'Registration deadline has passed' 
            });
        }

        // Check if event is full
        const registrationCountResult = await db.query(`
            SELECT COUNT(*) as count FROM event_registrations WHERE event_id = $1
        `, [eventId]);

        const currentRegistrations = parseInt(registrationCountResult.rows[0].count);
        if (event.max_participants && currentRegistrations >= event.max_participants) {
            return res.status(400).json({ 
                success: false, 
                message: 'Event is full' 
            });
        }

        // Get student and parent details
        const studentResult = await db.query(`
            SELECT 
                s.*,
                u.id as parent_id,
                u.email as parent_email,
                u.phone as parent_phone,
                u.first_name || ' ' || u.last_name as parent_name
            FROM students s
            LEFT JOIN users u ON s.parent_id = u.id
            WHERE s.id = $1 AND s.class_teacher_id = $2 AND s.is_active = true
        `, [studentId, teacherId]);

        if (studentResult.rows.length === 0) {
            return res.status(403).json({ 
                success: false, 
                message: 'You can only register students from your own class' 
            });
        }

        const student = studentResult.rows[0];

        // Check if student is already registered
        const existingRegistration = await db.query(`
            SELECT id FROM event_registrations 
            WHERE event_id = $1 AND student_id = $2
        `, [eventId, studentId]);

        if (existingRegistration.rows.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Student is already registered for this event' 
            });
        }

        // Register student for event
        const registrationResult = await db.query(`
            INSERT INTO event_registrations (
                event_id, student_id, teacher_id, parent_id, 
                payment_amount, registration_date
            )
            VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
            RETURNING *
        `, [
            eventId, studentId, teacherId, student.parent_id, event.fee
        ]);

        // Send notification to parent if parent exists
        if (student.parent_id) {
            const paymentDueDate = event.registration_deadline ? 
                moment(event.registration_deadline).format('MMMM DD, YYYY') :
                moment().add(7, 'days').format('MMMM DD, YYYY');

            await notificationService.sendEventRegistrationNotification({
                parentId: student.parent_id,
                parentEmail: student.parent_email,
                parentPhone: student.parent_phone,
                parentName: student.parent_name,
                studentName: `${student.first_name} ${student.last_name}`,
                eventTitle: event.title,
                eventDate: moment(event.start_date).format('MMMM DD, YYYY'),
                fee: event.fee,
                teacherName: `${req.session.user.firstName} ${req.session.user.lastName}`,
                paymentDueDate: paymentDueDate
            });
        }

        res.json({ 
            success: true, 
            message: 'Student registered successfully',
            registration: registrationResult.rows[0]
        });

    } catch (error) {
        console.error('Student registration error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'An error occurred while registering the student' 
        });
    }
});

// Get teacher's students (for registration dropdown)
router.get('/api/teacher-students', requireTeacher, async (req, res) => {
    try {
        const studentsResult = await db.query(`
            SELECT 
                s.id,
                s.first_name || ' ' || s.last_name as name,
                s.grade,
                s.section,
                s.student_id
            FROM students s
            WHERE s.class_teacher_id = $1 AND s.is_active = true
            ORDER BY s.grade, s.section, s.first_name, s.last_name
        `, [req.session.user.id]);

        res.json({ 
            success: true, 
            students: studentsResult.rows 
        });

    } catch (error) {
        console.error('Get teacher students error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to load students' 
        });
    }
});

module.exports = router;