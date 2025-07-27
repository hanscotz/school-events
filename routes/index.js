const db = require('../database/connection');
const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        // Fetch up to 6 recent feedbacks with rating and parent name
        const feedbackResult = await db.query(`
            SELECT f.message, f.rating, f.created_at, u.first_name, u.last_name
            FROM feedback f
            JOIN users u ON f.parent_id = u.id
            WHERE f.message IS NOT NULL AND LENGTH(f.message) > 5
            ORDER BY f.featured DESC, f.created_at DESC
            LIMIT 6
        `);
        res.render('index', {
            title: 'School Events - Welcome',
            feedback: feedbackResult.rows
        });
    } catch (error) {
        console.error('Home page feedback error:', error);
        res.render('index', { title: 'School Events - Welcome', feedback: [] });
    }
});

module.exports = router; 