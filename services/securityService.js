const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../database/connection');

class SecurityService {
    constructor() {
        this.SALT_ROUNDS = 12;
        this.MAX_LOGIN_ATTEMPTS = 5;
        this.LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
    }

    // Hash password with bcrypt
    async hashPassword(password) {
        try {
            const salt = await bcrypt.genSalt(this.SALT_ROUNDS);
            return await bcrypt.hash(password, salt);
        } catch (error) {
            console.error('Password hashing error:', error);
            throw new Error('Password hashing failed');
        }
    }

    // Compare password with hash
    async comparePassword(password, hashedPassword) {
        try {
            return await bcrypt.compare(password, hashedPassword);
        } catch (error) {
            console.error('Password comparison error:', error);
            return false;
        }
    }

    // Generate secure token
    generateSecureToken(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }

    // Authenticate user
    async authenticateUser(email, password, ipAddress) {
        try {
            const user = await db.query(`
                SELECT * FROM users 
                WHERE email = $1 AND is_active = true
            `, [email]);

            if (user.rows.length === 0) {
                return { success: false, message: 'Invalid credentials' };
            }

            const userData = user.rows[0];

            // Check if account is locked
            if (userData.locked_until && new Date() < userData.locked_until) {
                const remainingTime = Math.ceil((new Date(userData.locked_until) - new Date()) / 1000 / 60);
                return { 
                    success: false, 
                    message: `Account is locked. Try again in ${remainingTime} minutes.` 
                };
            }

            // Verify password
            const isPasswordValid = await this.comparePassword(password, userData.password_hash);
            
            if (!isPasswordValid) {
                await this.incrementLoginAttempts(userData.id);
                return { success: false, message: 'Invalid credentials' };
            }

            // Reset login attempts
            await this.resetLoginAttempts(userData.id);

            // Update last login
            await db.query(`
                UPDATE users 
                SET last_login = CURRENT_TIMESTAMP 
                WHERE id = $1
            `, [userData.id]);

            // Remove sensitive data
            delete userData.password_hash;
            delete userData.password_reset_token;
            delete userData.email_verification_token;

            return { success: true, user: userData };

        } catch (error) {
            console.error('Authentication error:', error);
            return { success: false, message: 'Authentication failed' };
        }
    }

    // Increment login attempts
    async incrementLoginAttempts(userId) {
        try {
            await db.query(`
                UPDATE users 
                SET login_attempts = login_attempts + 1,
                    locked_until = CASE 
                        WHEN login_attempts + 1 >= $1 THEN CURRENT_TIMESTAMP + INTERVAL '15 minutes'
                        ELSE locked_until
                    END
                WHERE id = $2
            `, [this.MAX_LOGIN_ATTEMPTS, userId]);
        } catch (error) {
            console.error('Error incrementing login attempts:', error);
        }
    }

    // Reset login attempts
    async resetLoginAttempts(userId) {
        try {
            await db.query(`
                UPDATE users 
                SET login_attempts = 0, locked_until = NULL
                WHERE id = $1
            `, [userId]);
        } catch (error) {
            console.error('Error resetting login attempts:', error);
        }
    }

    // Generate password reset token
    async generatePasswordResetToken(email) {
        try {
            const token = this.generateSecureToken();
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

            const result = await db.query(`
                UPDATE users 
                SET password_reset_token = $1, password_reset_expires = $2
                WHERE email = $3 AND is_active = true
                RETURNING id
            `, [token, expiresAt, email]);

            return result.rows.length > 0 ? token : null;
        } catch (error) {
            console.error('Password reset token generation error:', error);
            return null;
        }
    }

    // Reset password with token
    async resetPasswordWithToken(token, newPassword) {
        try {
            const hashedPassword = await this.hashPassword(newPassword);

            const result = await db.query(`
                UPDATE users 
                SET password_hash = $1, 
                    password_reset_token = NULL, 
                    password_reset_expires = NULL,
                    login_attempts = 0,
                    locked_until = NULL
                WHERE password_reset_token = $2 
                AND password_reset_expires > CURRENT_TIMESTAMP
                AND is_active = true
                RETURNING id
            `, [hashedPassword, token]);

            return result.rows.length > 0;
        } catch (error) {
            console.error('Password reset error:', error);
            return false;
        }
    }

    // Validate password strength
    validatePasswordStrength(password) {
        const feedback = [];
        let score = 0;

        if (password.length >= 8) score += 1;
        else feedback.push('Password should be at least 8 characters long');

        if (/[A-Z]/.test(password)) score += 1;
        else feedback.push('Password should contain at least one uppercase letter');

        if (/[a-z]/.test(password)) score += 1;
        else feedback.push('Password should contain at least one lowercase letter');

        if (/\d/.test(password)) score += 1;
        else feedback.push('Password should contain at least one number');

        if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;
        else feedback.push('Password should contain at least one special character');

        let strength = 'weak';
        if (score >= 4) strength = 'strong';
        else if (score >= 3) strength = 'medium';

        return {
            score,
            strength,
            feedback,
            isValid: score >= 3
        };
    }

    // Sanitize input
    sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        
        return input
            .replace(/['";\\]/g, '')
            .replace(/--/g, '')
            .replace(/\/\*.*?\*\//g, '')
            .trim();
    }
}

module.exports = new SecurityService(); 