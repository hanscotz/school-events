const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
require('dotenv').config({ path: './config.env' });

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const db = require('./database/connection');

// Import routes
const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const parentRoutes = require('./routes/parents');
const adminRoutes = require('./routes/admin');
const indexRoutes = require('./routes/index');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Global middleware for user data
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.isAuthenticated = !!req.session.user;
    next();
});

// Routes
app.use('/auth', authRoutes.router || authRoutes);
app.use('/events', eventRoutes.router || eventRoutes);
app.use('/parents', parentRoutes.router || parentRoutes);
app.use('/admin', adminRoutes.router || adminRoutes);
app.use('/', indexRoutes);


// Dashboard route
app.get('/dashboard', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    res.render('dashboard', { 
        title: 'Dashboard',
        user: req.session.user 
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', { 
        title: 'Error',
        error: 'Something went wrong!',
        user: req.session.user 
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).render('error', { 
        title: 'Page Not Found',
        error: 'Page not found!',
        user: req.session.user 
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📧 Email notifications enabled`);
    console.log(`🎓 School Events Management System`);
});

module.exports = app; 