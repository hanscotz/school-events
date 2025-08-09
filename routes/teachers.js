const express = require('express');
const moment = require('moment');
const db = require('../database/connection');
const notificationService = require('../services/notificationService');
const { requireAuth, requireTeacher, requireAdminOrTeacher } = require('./auth');
const router = express.Router();

// Teacher Dashboard
router.get('/dashboard', requireTeacher, async (req, res) => {
    try {
        const teacherId = req.session.user.id;

        // Get teacher's classes
        const classesResult = await db.query(`
            SELECT 
                c.*,
                COUNT(s.id) as actual_student_count
            FROM classes c
            LEFT JOIN students s ON c.grade = s.grade AND c.section = s.section AND s.is_active = true
            WHERE c.class_teacher_id = $1 AND c.is_active = true
            GROUP BY c.id
            ORDER BY c.grade, c.section
        `, [teacherId]);

        // Get teacher's students
        const studentsResult = await db.query(`
            SELECT 
                s.*,
                s.first_name || ' ' || s.last_name as full_name,
                u.first_name || ' ' || u.last_name as parent_name,
                u.email as parent_email,
                u.phone as parent_phone
            FROM students s
            LEFT JOIN users u ON s.parent_id = u.id
            WHERE s.class_teacher_id = $1 AND s.is_active = true
            ORDER BY s.grade, s.section, s.first_name
        `, [teacherId]);

        // Get recent event registrations made by this teacher
        const recentRegistrationsResult = await db.query(`
            SELECT 
                er.*,
                e.title as event_title,
                e.start_date as event_date,
                s.first_name || ' ' || s.last_name as student_name,
                s.grade,
                s.section
            FROM event_registrations er
            JOIN events e ON er.event_id = e.id
            JOIN students s ON er.student_id = s.id
            WHERE er.teacher_id = $1
            ORDER BY er.registration_date DESC
            LIMIT 10
        `, [teacherId]);

        // Get active events available for registration
        const activeEventsResult = await db.query(`
            SELECT 
                e.*,
                COUNT(er.id) as registered_count,
                u.first_name || ' ' || u.last_name as created_by_name
            FROM events e
            LEFT JOIN event_registrations er ON e.id = er.event_id
            LEFT JOIN users u ON e.created_by = u.id
            WHERE e.status = 'active' 
            AND (e.registration_deadline IS NULL OR e.registration_deadline > CURRENT_TIMESTAMP)
            GROUP BY e.id, u.first_name, u.last_name
            ORDER BY e.start_date ASC
            LIMIT 5
        `, []);

        // Get statistics
        const statsResult = await db.query(`
            SELECT 
                COUNT(DISTINCT s.id) as total_students,
                COUNT(DISTINCT er.id) as total_registrations,
                COUNT(DISTINCT er.id) FILTER (WHERE er.payment_status = 'pending') as pending_payments,
                COUNT(DISTINCT er.id) FILTER (WHERE er.payment_status = 'paid') as paid_registrations
            FROM students s
            LEFT JOIN event_registrations er ON s.id = er.student_id AND er.teacher_id = $1
            WHERE s.class_teacher_id = $1 AND s.is_active = true
        `, [teacherId]);

        res.render('teachers/dashboard', {
            title: 'Teacher Dashboard - School Events',
            classes: classesResult.rows,
            students: studentsResult.rows,
            recentRegistrations: recentRegistrationsResult.rows,
            activeEvents: activeEventsResult.rows,
            stats: statsResult.rows[0],
            user: req.session.user,
            moment
        });

    } catch (error) {
        console.error('Teacher dashboard error:', error);
        res.render('teachers/dashboard', {
            title: 'Teacher Dashboard - School Events',
            classes: [],
            students: [],
            recentRegistrations: [],
            activeEvents: [],
            stats: { total_students: 0, total_registrations: 0, pending_payments: 0, paid_registrations: 0 },
            error: 'Failed to load dashboard data',
            user: req.session.user,
            moment
        });
    }
});

// Manage Students
router.get('/students', requireTeacher, async (req, res) => {
    try {
        const teacherId = req.session.user.id;

        const studentsResult = await db.query(`
            SELECT 
                s.*,
                s.first_name || ' ' || s.last_name as full_name,
                u.first_name || ' ' || u.last_name as parent_name,
                u.email as parent_email,
                u.phone as parent_phone,
                COUNT(er.id) as event_count,
                COUNT(er.id) FILTER (WHERE er.payment_status = 'pending') as pending_payments
            FROM students s
            LEFT JOIN users u ON s.parent_id = u.id
            LEFT JOIN event_registrations er ON s.id = er.student_id
            WHERE s.class_teacher_id = $1 AND s.is_active = true
            GROUP BY s.id, u.first_name, u.last_name, u.email, u.phone
            ORDER BY s.grade, s.section, s.first_name
        `, [teacherId]);

        res.render('teachers/students', {
            title: 'My Students - School Events',
            students: studentsResult.rows,
            user: req.session.user,
            moment
        });

    } catch (error) {
        console.error('Students page error:', error);
        res.render('teachers/students', {
            title: 'My Students - School Events',
            students: [],
            error: 'Failed to load students data',
            user: req.session.user,
            moment
        });
    }
});

// Add new student
router.get('/students/add', requireTeacher, async (req, res) => {
    try {
        // Get teacher's assigned classes
        const classesResult = await db.query(`
            SELECT * FROM classes 
            WHERE class_teacher_id = $1 AND is_active = true
            ORDER BY grade, section
        `, [req.session.user.id]);

        res.render('teachers/add-student', {
            title: 'Add Student - School Events',
            classes: classesResult.rows,
            user: req.session.user
        });

    } catch (error) {
        console.error('Add student page error:', error);
        res.render('teachers/add-student', {
            title: 'Add Student - School Events',
            classes: [],
            error: 'Failed to load page',
            user: req.session.user
        });
    }
});

router.post('/students/add', requireTeacher, async (req, res) => {
    try {
        const {
            studentId,
            firstName,
            lastName,
            grade,
            section,
            dateOfBirth,
            gender,
            address,
            emergencyContact,
            medicalInfo
        } = req.body;
        const teacherId = req.session.user.id;

        // Validate required fields
        if (!studentId || !firstName || !lastName || !grade || !dateOfBirth) {
            const classesResult = await db.query(`
                SELECT * FROM classes 
                WHERE class_teacher_id = $1 AND is_active = true
                ORDER BY grade, section
            `, [teacherId]);

            return res.render('teachers/add-student', {
                title: 'Add Student - School Events',
                classes: classesResult.rows,
                error: 'Please fill in all required fields',
                formData: req.body,
                user: req.session.user
            });
        }

        // Check if student ID already exists
        const existingStudent = await db.query(`
            SELECT id FROM students WHERE student_id = $1
        `, [studentId]);

        if (existingStudent.rows.length > 0) {
            const classesResult = await db.query(`
                SELECT * FROM classes 
                WHERE class_teacher_id = $1 AND is_active = true
                ORDER BY grade, section
            `, [teacherId]);

            return res.render('teachers/add-student', {
                title: 'Add Student - School Events',
                classes: classesResult.rows,
                error: 'A student with this ID already exists',
                formData: req.body,
                user: req.session.user
            });
        }

        // Verify teacher can add student to this grade/section and capacity not exceeded
        const classResult = await db.query(`
            SELECT id, max_students, current_students FROM classes 
            WHERE class_teacher_id = $1 AND grade = $2 AND section = $3 AND is_active = true
        `, [teacherId, grade, section]);

        if (classResult.rows.length === 0) {
            const classesResult = await db.query(`
                SELECT * FROM classes 
                WHERE class_teacher_id = $1 AND is_active = true
                ORDER BY grade, section
            `, [teacherId]);

            return res.render('teachers/add-student', {
                title: 'Add Student - School Events',
                classes: classesResult.rows,
                error: 'You can only add students to your assigned classes',
                formData: req.body,
                user: req.session.user
            });
        }

        // Check capacity
        const teacherClass = classResult.rows[0];
        const currentCountResult = await db.query(`
            SELECT COUNT(*)::int AS count FROM students 
            WHERE grade = $1 AND section = $2 AND is_active = true
        `, [grade, section]);
        const currentCount = currentCountResult.rows[0].count;
        if (teacherClass.max_students && currentCount >= teacherClass.max_students) {
            const classesResult = await db.query(`
                SELECT * FROM classes 
                WHERE class_teacher_id = $1 AND is_active = true
                ORDER BY grade, section
            `, [teacherId]);
            return res.render('teachers/add-student', {
                title: 'Add Student - School Events',
                classes: classesResult.rows,
                error: `Class capacity reached (${teacherClass.max_students} students).`,
                formData: req.body,
                user: req.session.user
            });
        }

        // Add student
        await db.query(`
            INSERT INTO students (
                student_id, first_name, last_name, grade, section,
                class_teacher_id, date_of_birth, gender, address,
                emergency_contact, medical_info
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
            studentId, firstName, lastName, grade, section,
            teacherId, dateOfBirth, gender, address,
            emergencyContact, medicalInfo
        ]);

        // Update class student count
        await db.query(`
            UPDATE classes 
            SET current_students = (
                SELECT COUNT(*) FROM students 
                WHERE grade = $1 AND section = $2 AND is_active = true
            )
            WHERE grade = $1 AND section = $2
        `, [grade, section]);

        res.redirect('/teachers/students?success=Student added successfully');

    } catch (error) {
        console.error('Add student error:', error);
        const classesResult = await db.query(`
            SELECT * FROM classes 
            WHERE class_teacher_id = $1 AND is_active = true
            ORDER BY grade, section
        `, [req.session.user.id]);

        res.render('teachers/add-student', {
            title: 'Add Student - School Events',
            classes: classesResult.rows,
            error: 'An error occurred while adding the student',
            formData: req.body,
            user: req.session.user
        });
    }
});

// New Event Request (Teacher) - Form
router.get('/event-requests/new', requireTeacher, async (req, res) => {
    try {
        const teacherId = req.session.user.id;
        const classesResult = await db.query(`
            SELECT id, name, grade, section FROM classes 
            WHERE class_teacher_id = $1 AND is_active = true
            ORDER BY grade, section
        `, [teacherId]);

        res.render('teachers/new-event-request', {
            title: 'Request New Event - School Events',
            classes: classesResult.rows,
            user: req.session.user,
            moment
        });
    } catch (error) {
        console.error('New event request page error:', error);
        res.status(500).render('error', {
            title: 'Error',
            error: 'Failed to load event request form',
            user: req.session.user
        });
    }
});

// New Event Request (Teacher) - Submit
router.post('/event-requests', requireTeacher, async (req, res) => {
    try {
        const teacherId = req.session.user.id;
        const {
            classId,
            title,
            description,
            event_type,
            location,
            start_date,
            end_date,
            registration_deadline,
            fee
        } = req.body;

        // Validate class belongs to this teacher
        const classResult = await db.query(`
            SELECT grade, section FROM classes WHERE id = $1 AND class_teacher_id = $2 AND is_active = true
        `, [classId, teacherId]);
        if (classResult.rows.length === 0) {
            return res.status(403).json({ success: false, message: 'Invalid class selection' });
        }
        const { grade, section } = classResult.rows[0];

        // Create event in draft status
        const eventResult = await db.query(`
            INSERT INTO events (
                title, description, event_type, location,
                start_date, end_date, registration_deadline, fee,
                status, created_by, class_grade, class_section
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9,$10,$11)
            RETURNING id
        `, [
            title, description || '', event_type, location,
            start_date, end_date, registration_deadline || null,
            parseFloat(fee) || 0,
            teacherId, grade, section
        ]);

        // Notify admins about new request
        const admins = await db.query(`SELECT id, first_name, last_name FROM users WHERE role = 'admin' AND is_active = true`);
        for (const admin of admins.rows) {
            await notificationService.createInAppNotification({
                userId: admin.id,
                title: 'New Event Request',
                message: `${req.session.user.firstName || ''} ${req.session.user.lastName || ''} requested a new event for ${grade} ${section}.`,
                type: 'info',
                category: 'event',
                actionUrl: '/admin/event-requests'
            });
        }

        res.json({ success: true, message: 'Event request submitted for approval', eventId: eventResult.rows[0].id });
    } catch (error) {
        console.error('Submit event request error:', error);
        res.status(500).json({ success: false, message: 'Failed to submit event request' });
    }
});

// Edit student
router.get('/students/:studentId/edit', requireTeacher, async (req, res) => {
    try {
        const teacherId = req.session.user.id;
        const studentId = req.params.studentId;

        // Get student details (only if teacher owns this student)
        const studentResult = await db.query(`
            SELECT * FROM students 
            WHERE id = $1 AND class_teacher_id = $2 AND is_active = true
        `, [studentId, teacherId]);

        if (studentResult.rows.length === 0) {
            return res.status(404).render('error', {
                title: 'Student Not Found',
                error: 'Student not found or access denied',
                user: req.session.user
            });
        }

        const student = studentResult.rows[0];

        res.render('teachers/edit-student', {
            title: `Edit ${student.first_name} ${student.last_name} - School Events`,
            student: {
                ...student,
                date_of_birth: moment(student.date_of_birth).format('YYYY-MM-DD')
            },
            user: req.session.user
        });

    } catch (error) {
        console.error('Edit student page error:', error);
        res.status(500).render('error', {
            title: 'Error',
            error: 'Failed to load student for editing',
            user: req.session.user
        });
    }
});

router.post('/students/:studentId/edit', requireTeacher, async (req, res) => {
    try {
        const teacherId = req.session.user.id;
        const studentId = req.params.studentId;
        const {
            firstName,
            lastName,
            dateOfBirth,
            gender,
            address,
            emergencyContact,
            medicalInfo
        } = req.body;

        // Verify teacher owns this student
        const studentResult = await db.query(`
            SELECT id FROM students 
            WHERE id = $1 AND class_teacher_id = $2 AND is_active = true
        `, [studentId, teacherId]);

        if (studentResult.rows.length === 0) {
            return res.status(404).render('error', {
                title: 'Student Not Found',
                error: 'Student not found or access denied',
                user: req.session.user
            });
        }

        // Update student
        await db.query(`
            UPDATE students 
            SET 
                first_name = $1, last_name = $2, date_of_birth = $3,
                gender = $4, address = $5, emergency_contact = $6,
                medical_info = $7, updated_at = CURRENT_TIMESTAMP
            WHERE id = $8
        `, [
            firstName, lastName, dateOfBirth, gender,
            address, emergencyContact, medicalInfo, studentId
        ]);

        res.redirect(`/teachers/students?success=Student updated successfully`);

    } catch (error) {
        console.error('Update student error:', error);
        res.redirect(`/teachers/students/${req.params.studentId}/edit?error=An error occurred while updating the student`);
    }
});

// Event Registration Management
router.get('/event-registrations', requireTeacher, async (req, res) => {
    try {
        const teacherId = req.session.user.id;

        const registrationsResult = await db.query(`
            SELECT 
                er.*,
                e.title as event_title,
                e.start_date as event_date,
                e.fee as event_fee,
                e.status as event_status,
                s.first_name || ' ' || s.last_name as student_name,
                s.grade,
                s.section,
                u.first_name || ' ' || u.last_name as parent_name,
                u.email as parent_email
            FROM event_registrations er
            JOIN events e ON er.event_id = e.id
            JOIN students s ON er.student_id = s.id
            LEFT JOIN users u ON er.parent_id = u.id
            WHERE er.teacher_id = $1
            ORDER BY er.registration_date DESC
        `, [teacherId]);

        res.render('teachers/event-registrations', {
            title: 'Event Registrations - School Events',
            registrations: registrationsResult.rows,
            user: req.session.user,
            moment
        });

    } catch (error) {
        console.error('Event registrations error:', error);
        res.render('teachers/event-registrations', {
            title: 'Event Registrations - School Events',
            registrations: [],
            error: 'Failed to load registrations',
            user: req.session.user,
            moment
        });
    }
});

// Quick register student for event (AJAX)
router.post('/quick-register', requireTeacher, async (req, res) => {
    try {
        const { eventId, studentId } = req.body;
        const teacherId = req.session.user.id;

        // Validate inputs
        if (!eventId || !studentId) {
            return res.status(400).json({
                success: false,
                message: 'Event ID and Student ID are required'
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

        // Verify student belongs to teacher
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

        // Register student
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
        console.error('Quick register error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while registering the student'
        });
    }
});

// Get class summary
router.get('/class-summary', requireTeacher, async (req, res) => {
    try {
        const teacherId = req.session.user.id;

        // Get class information
        const classResult = await db.query(`
            SELECT 
                c.*,
                COUNT(s.id) as actual_student_count
            FROM classes c
            LEFT JOIN students s ON c.grade = s.grade AND c.section = s.section AND s.is_active = true
            WHERE c.class_teacher_id = $1 AND c.is_active = true
            GROUP BY c.id
            ORDER BY c.grade, c.section
        `, [teacherId]);

        // Get event participation statistics
        const eventStatsResult = await db.query(`
            SELECT 
                e.title as event_title,
                e.start_date,
                COUNT(er.id) as registered_students,
                COUNT(er.id) FILTER (WHERE er.payment_status = 'paid') as paid_students,
                COUNT(er.id) FILTER (WHERE er.payment_status = 'pending') as pending_payments
            FROM events e
            LEFT JOIN event_registrations er ON e.id = er.event_id AND er.teacher_id = $1
            WHERE e.status = 'active'
            GROUP BY e.id, e.title, e.start_date
            HAVING COUNT(er.id) > 0
            ORDER BY e.start_date DESC
        `, [teacherId]);

        res.render('teachers/class-summary', {
            title: 'Class Summary - School Events',
            classes: classResult.rows,
            eventStats: eventStatsResult.rows,
            user: req.session.user,
            moment
        });

    } catch (error) {
        console.error('Class summary error:', error);
        res.render('teachers/class-summary', {
            title: 'Class Summary - School Events',
            classes: [],
            eventStats: [],
            error: 'Failed to load class summary',
            user: req.session.user,
            moment
        });
    }
});

module.exports = router;
