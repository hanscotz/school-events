const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/connection');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    next();
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/auth/login');
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
            'SELECT * FROM users WHERE email = $1',
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

        // Set session
        req.session.user = {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role,
            phone: user.phone
        };

        res.redirect('/dashboard');

    } catch (error) {
        console.error('Login error:', error);
        res.render('auth/login', { 
            title: 'Login - School Events',
            error: 'An error occurred during login' 
        });
    }
});

// Register page
router.get('/register', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.render('auth/register', { 
        title: 'Register - School Events',
        error: req.query.error 
    });
});

// Register POST
router.post('/register', async (req, res) => {
    try {
        const { firstName, lastName, email, password, confirmPassword, phone } = req.body;

        // Validate input
        if (!firstName || !lastName || !email || !password || !confirmPassword) {
            return res.render('auth/register', { 
                title: 'Register - School Events',
                error: 'Please fill in all required fields' 
            });
        }

        if (password !== confirmPassword) {
            return res.render('auth/register', { 
                title: 'Register - School Events',
                error: 'Passwords do not match' 
            });
        }

        if (password.length < 6) {
            return res.render('auth/register', { 
                title: 'Register - School Events',
                error: 'Password must be at least 6 characters long' 
            });
        }

        // Check if user already exists
        const existingUser = await db.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.render('auth/register', { 
                title: 'Register - School Events',
                error: 'Email already registered' 
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const newUser = await db.query(
            'INSERT INTO users (first_name, last_name, email, password_hash, phone, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [firstName, lastName, email, hashedPassword, phone || null, 'parent']
        );

        // Set session
        req.session.user = {
            id: newUser.rows[0].id,
            email: newUser.rows[0].email,
            firstName: newUser.rows[0].first_name,
            lastName: newUser.rows[0].last_name,
            role: newUser.rows[0].role,
            phone: newUser.rows[0].phone
        };

        res.redirect('/dashboard');

    } catch (error) {
        console.error('Registration error:', error);
        res.render('auth/register', { 
            title: 'Register - School Events',
            error: 'An error occurred during registration' 
        });
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/');
    });
});

// Profile page
router.get('/profile', requireAuth, async (req, res) => {
    try {
        const user = await db.query(
            'SELECT * FROM users WHERE id = $1',
            [req.session.user.id]
        );

        let eventCount = 0;
        let registrationCount = 0;
        let notificationCount = 0;

        if (user.rows[0].role === 'admin') {
            // Admin statistics
            const eventResult = await db.query('SELECT COUNT(*) as count FROM events');
            eventCount = parseInt(eventResult.rows[0].count);

            const registrationResult = await db.query('SELECT COUNT(*) as count FROM event_registrations');
            registrationCount = parseInt(registrationResult.rows[0].count);

            const notificationResult = await db.query('SELECT COUNT(*) as count FROM notifications');
            notificationCount = parseInt(notificationResult.rows[0].count);
        } else {
            // Parent statistics
            const students = await db.query(
                'SELECT * FROM students WHERE parent_id = $1',
                [req.session.user.id]
            );

            if (students.rows.length > 0) {
                const studentIds = students.rows.map(s => s.id);
                
                const registrationResult = await db.query(
                    'SELECT COUNT(*) as count FROM event_registrations WHERE student_id = ANY($1)',
                    [studentIds]
                );
                registrationCount = parseInt(registrationResult.rows[0].count);
            }

            const notificationResult = await db.query(
                'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1',
                [req.session.user.id]
            );
            notificationCount = parseInt(notificationResult.rows[0].count);
        }

        res.render('auth/profile', { 
            title: 'Profile - School Events',
            user: user.rows[0],
            eventCount,
            registrationCount,
            notificationCount
        });

    } catch (error) {
        console.error('Profile error:', error);
        res.redirect('/dashboard');
    }
});

// Update profile (POST)
router.post('/profile', requireAuth, upload.single('profile_pic'), async (req, res) => {
    try {
        const { first_name, last_name, email, phone } = req.body;
        let profilePicFilename = req.session.user.profile_pic;
        if (req.file) {
            profilePicFilename = req.file.filename;
        }
        await db.query(
            'UPDATE users SET first_name = $1, last_name = $2, email = $3, phone = $4, profile_pic = $5 WHERE id = $6',
            [first_name, last_name, email, phone, profilePicFilename, req.session.user.id]
        );
        req.session.user.profile_pic = profilePicFilename;
        res.redirect('/auth/profile?success=Profile updated successfully');
    } catch (error) {
        if (error.code === 'LIMIT_FILE_SIZE' || error.message.includes('File too large')) {
            return res.redirect('/auth/profile?error=Profile picture is too large. Max size is 2MB.');
        }
        console.error('Profile update error:', error);
        res.redirect('/auth/profile?error=Failed to update profile');
    }
});

// Change password
router.post('/change-password', requireAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;

        if (newPassword !== confirmPassword) {
            return res.redirect('/auth/profile?error=New passwords do not match');
        }

        if (newPassword.length < 6) {
            return res.redirect('/auth/profile?error=Password must be at least 6 characters long');
        }

        // Get current user
        const user = await db.query(
            'SELECT password_hash FROM users WHERE id = $1',
            [req.session.user.id]
        );

        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, user.rows[0].password_hash);
        if (!isValidPassword) {
            return res.redirect('/auth/profile?error=Current password is incorrect');
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update password
        await db.query(
            'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [hashedPassword, req.session.user.id]
        );

        res.redirect('/auth/profile?success=Password changed successfully');

    } catch (error) {
        console.error('Password change error:', error);
        res.redirect('/auth/profile?error=Failed to change password');
    }
});

module.exports = { router, requireAuth, requireAdmin }; 