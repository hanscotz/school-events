const db = require('../database/connection');
const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        res.render('index', {
            title: 'School Events - Welcome',
            user: req.session.user || null,
            isAuthenticated: !!req.session.user
        });
    } catch (error) {
        console.error('Home page error:', error);
        res.render('index', { 
            title: 'School Events - Welcome', 
            user: req.session.user || null,
            isAuthenticated: !!req.session.user
        });
    }
});

module.exports = router; 