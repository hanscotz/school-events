const db = require('../database/connection');

class SMSService {
    constructor() {
        this.apiKey = process.env.SMS_API_KEY || '';
        this.apiUrl = process.env.SMS_API_URL || 'https://api.sms-provider.com';
        this.fromNumber = process.env.SMS_FROM_NUMBER || '+1234567890';
    }

    /**
     * Send SMS notification
     * @param {string} phoneNumber - Recipient phone number
     * @param {string} message - SMS message content
     * @param {string} recipientName - Name of recipient
     * @param {string} template - Template used for analytics
     */
    async sendSMS(phoneNumber, message, recipientName = '', template = 'general') {
        try {
            console.log(`📱 Sending SMS to ${phoneNumber}: ${message}`);

            // For demo purposes, we'll simulate SMS sending
            // In production, integrate with your SMS provider (Twilio, AWS SNS, etc.)
            const success = await this.simulateSMSSending(phoneNumber, message);
            
            const status = success ? 'sent' : 'failed';
            const errorMessage = success ? null : 'Simulated failure for demo';
            
            // Log the SMS attempt
            await this.logSMS({
                recipientPhone: phoneNumber,
                recipientName: recipientName,
                message: message,
                templateUsed: template,
                status: status,
                errorMessage: errorMessage,
                cost: 0.05 // Simulated cost
            });

            return {
                success: success,
                message: success ? 'SMS sent successfully' : 'Failed to send SMS',
                error: errorMessage
            };

        } catch (error) {
            console.error('SMS sending error:', error);
            
            // Log the failed attempt
            await this.logSMS({
                recipientPhone: phoneNumber,
                recipientName: recipientName,
                message: message,
                templateUsed: template,
                status: 'failed',
                errorMessage: error.message,
                cost: 0
            });

            return {
                success: false,
                message: 'Failed to send SMS',
                error: error.message
            };
        }
    }

    /**
     * Simulate SMS sending for demo purposes
     * In production, replace with actual SMS provider integration
     */
    async simulateSMSSending(phoneNumber, message) {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Simulate 95% success rate
        return Math.random() > 0.05;
    }

    /**
     * Send event registration notification to parent
     */
    async sendEventRegistrationNotification(parentPhone, parentName, studentName, eventTitle, eventDate, fee) {
        const message = `🎓 ${studentName} has been registered for "${eventTitle}" on ${eventDate}. Fee: $${fee}. Please log in to make payment. - School Events System`;
        
        return await this.sendSMS(
            parentPhone, 
            message, 
            parentName, 
            'event_registration'
        );
    }

    /**
     * Send payment reminder notification
     */
    async sendPaymentReminder(parentPhone, parentName, studentName, eventTitle, amount, dueDate) {
        const message = `💰 Payment reminder: $${amount} due for ${studentName}'s registration to "${eventTitle}" by ${dueDate}. Log in to pay now. - School Events System`;
        
        return await this.sendSMS(
            parentPhone, 
            message, 
            parentName, 
            'payment_reminder'
        );
    }

    /**
     * Send payment confirmation notification
     */
    async sendPaymentConfirmation(parentPhone, parentName, studentName, eventTitle, amount, referenceNumber) {
        const message = `✅ Payment confirmed! $${amount} received for ${studentName}'s "${eventTitle}" registration. Reference: ${referenceNumber}. - School Events System`;
        
        return await this.sendSMS(
            parentPhone, 
            message, 
            parentName, 
            'payment_confirmation'
        );
    }

    /**
     * Send parent account approval notification
     */
    async sendAccountApprovalNotification(parentPhone, parentName, tempPassword) {
        const message = `🎉 Welcome! Your parent account has been approved. Login at our portal with email and temp password: ${tempPassword}. Change password after first login. - School Events System`;
        
        return await this.sendSMS(
            parentPhone, 
            message, 
            parentName, 
            'account_approval'
        );
    }

    /**
     * Send event reminder notification
     */
    async sendEventReminder(parentPhone, parentName, studentName, eventTitle, eventDate, location) {
        const message = `⏰ Reminder: ${studentName} is registered for "${eventTitle}" tomorrow at ${eventDate} in ${location}. Don't forget! - School Events System`;
        
        return await this.sendSMS(
            parentPhone, 
            message, 
            parentName, 
            'event_reminder'
        );
    }

    /**
     * Log SMS to database
     */
    async logSMS(smsData) {
        try {
            await db.query(`
                INSERT INTO sms_logs (
                    recipient_phone, recipient_name, message, template_used, 
                    status, error_message, cost, sent_at, delivered_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, $8)
            `, [
                smsData.recipientPhone,
                smsData.recipientName,
                smsData.message,
                smsData.templateUsed,
                smsData.status,
                smsData.errorMessage,
                smsData.cost,
                smsData.status === 'sent' ? new Date() : null
            ]);
        } catch (error) {
            console.error('Error logging SMS:', error);
        }
    }

    /**
     * Get SMS statistics for admin dashboard
     */
    async getSMSStats(timeframe = '30 days') {
        try {
            const stats = await db.query(`
                SELECT 
                    COUNT(*) as total_sent,
                    COUNT(CASE WHEN status = 'sent' THEN 1 END) as successful,
                    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
                    SUM(cost) as total_cost,
                    COUNT(DISTINCT recipient_phone) as unique_recipients
                FROM sms_logs 
                WHERE sent_at >= CURRENT_TIMESTAMP - INTERVAL '${timeframe}'
            `);

            return stats.rows[0];
        } catch (error) {
            console.error('Error getting SMS stats:', error);
            return {
                total_sent: 0,
                successful: 0,
                failed: 0,
                total_cost: 0,
                unique_recipients: 0
            };
        }
    }

    /**
     * Bulk send SMS to multiple recipients
     */
    async bulkSendSMS(recipients, message, template = 'bulk') {
        const results = [];
        
        for (const recipient of recipients) {
            const result = await this.sendSMS(
                recipient.phone, 
                message, 
                recipient.name, 
                template
            );
            
            results.push({
                phone: recipient.phone,
                name: recipient.name,
                success: result.success,
                error: result.error
            });
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        return results;
    }
}

module.exports = new SMSService();
