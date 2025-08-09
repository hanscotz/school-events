const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/connection');
const notificationService = require('../services/notificationService');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    next();
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    next();
};

// Middleware to check if user is teacher
const requireTeacher = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'teacher') {
        return res.status(403).json({ success: false, message: 'Teacher access required' });
    }
    next();
};

// Middleware to check if user is parent
const requireParent = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'parent') {
        return res.status(403).json({ success: false, message: 'Parent access required' });
    }
    next();
};

// Middleware for admin or teacher access
const requireAdminOrTeacher = (req, res, next) => {
    if (!req.session.user || !['admin', 'teacher'].includes(req.session.user.role)) {
        return res.status(403).json({ success: false, message: 'Admin or teacher access required' });
    }
    next();
};

// Multer config for profile pictures
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../public/uploads/profile_pics'));
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        const uniqueName = req.session.user.id + '_' + Date.now() + ext;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed!'));
        }
        cb(null, true);
    }
});

// Login page
router.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.render('auth/login', { 
        title: 'Login - School Events',
        error: req.query.error 
    });
});

// Login POST
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.render('auth/login', { 
                title: 'Login - School Events',
                error: 'Please provide both email and password' 
            });
        }

        // Find user
        const userResult = await db.query(
            'SELECT * FROM users WHERE email = $1 AND is_active = true',
            [email]
        );

        if (userResult.rows.length === 0) {
            return res.render('auth/login', { 
                title: 'Login - School Events',
                error: 'Invalid email or password' 
            });
        }

        const user = userResult.rows[0];

        // Check password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.render('auth/login', { 
                title: 'Login - School Events',
                error: 'Invalid email or password' 
            });
        }

        // Set session based on role
        req.session.user = {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role,
            phone: user.phone,
            profilePic: user.profile_pic
        };

        // Update last login
        await db.query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );

        // Redirect based on role
        switch (user.role) {
            case 'admin':
                res.redirect('/admin/dashboard');
                break;
            case 'teacher':
                res.redirect('/teachers/dashboard');
                break;
            case 'parent':
                res.redirect('/parents/dashboard');
                break;
            default:
                res.redirect('/dashboard');
        }

    } catch (error) {
        console.error('Login error:', error);
        res.render('auth/login', { 
            title: 'Login - School Events',
            error: 'An error occurred during login' 
        });
    }
});

// Parent registration page (with student verification)
router.get('/register', async (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    // Get distinct classes/sections for selection
    const classes = await db.query(`
        SELECT DISTINCT grade, section FROM classes WHERE is_active = true ORDER BY grade, section
    `);
    res.render('auth/register', { 
        title: 'Parent Registration - School Events',
        classes: classes.rows,
        success: req.query.success,
        error: req.query.error 
    });
});

// Parent registration POST with initial child verification
router.post('/register', async (req, res) => {
    try {
        const { firstName, lastName, email, phone, password, indexNo, childFirstName, childLastName, dateOfBirth, grade, section } = req.body;

        // Validate input
        if (!firstName || !lastName || !email || !password || !indexNo || !childFirstName || !childLastName || !dateOfBirth || !grade || !section) {
            const classes = await db.query(`SELECT DISTINCT grade, section FROM classes WHERE is_active = true ORDER BY grade, section`);
            return res.render('auth/register', { 
                title: 'Parent Registration - School Events',
                error: 'Please fill in all required fields',
                classes: classes.rows,
                formData: req.body
            });
        }

        // Check if email already exists
        const existingUser = await db.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            const classes = await db.query(`SELECT DISTINCT grade, section FROM classes WHERE is_active = true ORDER BY grade, section`);
            return res.render('auth/register', { 
                title: 'Parent Registration - School Events',
                error: 'An account with this email already exists',
                classes: classes.rows,
                formData: req.body
            });
        }

        // Verify child info must match an existing student
        const studentResult = await db.query(`
            SELECT id FROM students 
            WHERE student_id = $1 AND LOWER(first_name) = LOWER($2) AND LOWER(last_name) = LOWER($3) 
              AND date_of_birth = $4 AND grade = $5 AND section = $6 AND is_active = true
        `, [indexNo, childFirstName, childLastName, dateOfBirth, grade, section]);
        if (studentResult.rows.length === 0) {
            const classes = await db.query(`SELECT DISTINCT grade, section FROM classes WHERE is_active = true ORDER BY grade, section`);
            return res.render('auth/register', { 
                title: 'Parent Registration - School Events',
                error: 'We could not verify the student with the provided details. Please check and try again.',
                classes: classes.rows,
                formData: req.body
            });
        }

        // Create parent user immediately (since verified) and link to student
        const hashedPassword = await bcrypt.hash(password, 12);
        const userInsert = await db.query(`
            INSERT INTO users (email, password_hash, first_name, last_name, phone, role, is_active, email_verified)
            VALUES ($1, $2, $3, $4, $5, 'parent', true, true)
            RETURNING id
        `, [email, hashedPassword, firstName, lastName, phone || null]);
        const parentId = userInsert.rows[0].id;

        // Attach the verified student to this parent
        await db.query(`UPDATE students SET parent_id = $1 WHERE id = $2`, [parentId, studentResult.rows[0].id]);

        // Auto-login new parent
        req.session.user = {
            id: parentId,
            email,
            firstName,
            lastName,
            role: 'parent',
            phone: phone || null,
            profilePic: null
        };

        res.redirect('/parents/dashboard?success=Account created and student linked successfully');

    } catch (error) {
        console.error('Registration request error:', error);
        res.render('auth/register', { 
            title: 'Parent Registration Request - School Events',
            error: 'An error occurred while submitting your request. Please try again.',
            formData: req.body
        });
    }
});

// Profile page
router.get('/profile', requireAuth, async (req, res) => {
    try {
        const userResult = await db.query(`
            SELECT 
                id, email, first_name, last_name, role, phone, 
                profile_pic, created_at, last_login 
            FROM users 
            WHERE id = $1
        `, [req.session.user.id]);

        if (userResult.rows.length === 0) {
            return res.redirect('/auth/login');
        }

        const user = userResult.rows[0];

        res.render('auth/profile', { 
            title: 'Profile - School Events',
            user: user,
            success: req.query.success,
            error: req.query.error
        });

    } catch (error) {
        console.error('Profile error:', error);
        res.redirect('/dashboard?error=Unable to load profile');
    }
});

// Update profile POST
router.post('/profile', requireAuth, upload.single('profilePic'), async (req, res) => {
    try {
        const { firstName, lastName, phone, currentPassword, newPassword } = req.body;
        const userId = req.session.user.id;

        // Validate required fields
        if (!firstName || !lastName) {
            return res.redirect('/auth/profile?error=First name and last name are required');
        }

        let updateFields = [];
        let updateValues = [];
        let paramCount = 1;

        // Update basic info
        updateFields.push(`first_name = $${paramCount++}`);
        updateValues.push(firstName);
        
        updateFields.push(`last_name = $${paramCount++}`);
        updateValues.push(lastName);

        if (phone) {
            updateFields.push(`phone = $${paramCount++}`);
            updateValues.push(phone);
        }

        // Handle profile picture upload
        if (req.file) {
            const profilePicPath = '/uploads/profile_pics/' + req.file.filename;
            updateFields.push(`profile_pic = $${paramCount++}`);
            updateValues.push(profilePicPath);
        }

        // Handle password change
        if (newPassword) {
            if (!currentPassword) {
                return res.redirect('/auth/profile?error=Current password is required to change password');
            }

            // Verify current password
            const userResult = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
            const isValidPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
            
            if (!isValidPassword) {
                return res.redirect('/auth/profile?error=Current password is incorrect');
            }

            // Hash new password
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
            updateFields.push(`password_hash = $${paramCount++}`);
            updateValues.push(hashedPassword);
        }

        // Update timestamp
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        updateValues.push(userId);

        // Execute update
        await db.query(`
            UPDATE users 
            SET ${updateFields.join(', ')}
            WHERE id = $${paramCount}
        `, updateValues);

        // Update session data
        req.session.user.firstName = firstName;
        req.session.user.lastName = lastName;
        req.session.user.phone = phone;
        if (req.file) {
            req.session.user.profilePic = '/uploads/profile_pics/' + req.file.filename;
        }

        res.redirect('/auth/profile?success=Profile updated successfully');

    } catch (error) {
        console.error('Profile update error:', error);
        res.redirect('/auth/profile?error=An error occurred while updating your profile');
    }
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/auth/login');
    });
});

// Support GET logout for links
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/auth/login');
    });
});

// Password reset request page
router.get('/forgot-password', (req, res) => {
    res.render('auth/forgot-password', { 
        title: 'Forgot Password - School Events',
        success: req.query.success,
        error: req.query.error 
    });
});

// Password reset request POST
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.render('auth/forgot-password', { 
                title: 'Forgot Password - School Events',
                error: 'Please provide your email address'
            });
        }

        // Check if user exists
        const userResult = await db.query(
            'SELECT id, first_name, last_name FROM users WHERE email = $1 AND is_active = true',
            [email]
        );

        if (userResult.rows.length === 0) {
            // Don't reveal if email exists or not for security
            return res.render('auth/forgot-password', { 
                title: 'Forgot Password - School Events',
                success: 'If an account with that email exists, you will receive password reset instructions.'
            });
        }

        const user = userResult.rows[0];
        const resetToken = uuidv4();
        const resetExpires = new Date(Date.now() + 3600000); // 1 hour

        // Store reset token
        await db.query(`
            UPDATE users 
            SET password_reset_token = $1, password_reset_expires = $2 
            WHERE id = $3
        `, [resetToken, resetExpires, user.id]);

        // Send reset email (implement email service)
        // For now, just log the reset token
        console.log(`Password reset token for ${email}: ${resetToken}`);

        res.render('auth/forgot-password', { 
            title: 'Forgot Password - School Events',
            success: 'If an account with that email exists, you will receive password reset instructions.'
        });

    } catch (error) {
        console.error('Password reset request error:', error);
        res.render('auth/forgot-password', { 
            title: 'Forgot Password - School Events',
            error: 'An error occurred. Please try again.'
        });
    }
});

// Export middleware functions and router
module.exports = {
    router,
    requireAuth,
    requireAdmin,
    requireTeacher,
    requireParent,
    requireAdminOrTeacher
};