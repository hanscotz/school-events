const emailService = require('./emailService');
const smsService = require('./smsService');
const db = require('../database/connection');

class NotificationService {
    constructor() {
        this.emailEnabled = process.env.EMAIL_ENABLED !== 'false';
        this.smsEnabled = process.env.SMS_ENABLED !== 'false';
    }

    /**
     * Send registration notification to parent when teacher registers their child
     */
    async sendEventRegistrationNotification(registrationData) {
        try {
            const {
                parentEmail,
                parentPhone,
                parentName,
                studentName,
                eventTitle,
                eventDate,
                fee,
                teacherName,
                paymentDueDate
            } = registrationData;

            const results = {
                email: { success: false, error: null },
                sms: { success: false, error: null }
            };

            // Send email notification
            if (this.emailEnabled && parentEmail) {
                try {
                    const emailResult = await emailService.sendTeacherRegistrationNotification(
                        parentEmail,
                        parentName,
                        studentName,
                        eventTitle,
                        eventDate,
                        fee,
                        teacherName,
                        paymentDueDate
                    );
                    results.email = emailResult;
                } catch (error) {
                    results.email.error = error.message;
                }
            }

            // Send SMS notification
            if (this.smsEnabled && parentPhone) {
                try {
                    const smsResult = await smsService.sendEventRegistrationNotification(
                        parentPhone,
                        parentName,
                        studentName,
                        eventTitle,
                        eventDate,
                        fee
                    );
                    results.sms = smsResult;
                } catch (error) {
                    results.sms.error = error.message;
                }
            }

            // Create in-app notification
            await this.createInAppNotification({
                userId: registrationData.parentId,
                title: `${studentName} Registered for ${eventTitle}`,
                message: `${teacherName} has registered ${studentName} for "${eventTitle}" on ${eventDate}. Payment of $${fee} is required by ${paymentDueDate}.`,
                type: 'info',
                category: 'event',
                actionUrl: '/parents/dashboard'
            });

            return {
                success: results.email.success || results.sms.success,
                results: results
            };

        } catch (error) {
            console.error('Error sending registration notification:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send payment reminder notifications
     */
    async sendPaymentReminder(reminderData) {
        try {
            const {
                parentEmail,
                parentPhone,
                parentName,
                studentName,
                eventTitle,
                amount,
                dueDate,
                daysLeft
            } = reminderData;

            const results = {
                email: { success: false, error: null },
                sms: { success: false, error: null }
            };

            // Send email reminder
            if (this.emailEnabled && parentEmail) {
                try {
                    const emailResult = await emailService.sendPaymentReminderEmail(
                        parentEmail,
                        parentName,
                        studentName,
                        eventTitle,
                        amount,
                        dueDate,
                        daysLeft
                    );
                    results.email = emailResult;
                } catch (error) {
                    results.email.error = error.message;
                }
            }

            // Send SMS reminder
            if (this.smsEnabled && parentPhone) {
                try {
                    const smsResult = await smsService.sendPaymentReminder(
                        parentPhone,
                        parentName,
                        studentName,
                        eventTitle,
                        amount,
                        dueDate
                    );
                    results.sms = smsResult;
                } catch (error) {
                    results.sms.error = error.message;
                }
            }

            // Create in-app notification
            await this.createInAppNotification({
                userId: reminderData.parentId,
                title: `Payment Reminder - ${eventTitle}`,
                message: `Payment of $${amount} is due in ${daysLeft} days for ${studentName}'s registration to "${eventTitle}".`,
                type: 'warning',
                category: 'payment',
                actionUrl: '/parents/dashboard'
            });

            return {
                success: results.email.success || results.sms.success,
                results: results
            };

        } catch (error) {
            console.error('Error sending payment reminder:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send payment confirmation notifications
     */
    async sendPaymentConfirmation(confirmationData) {
        try {
            const {
                parentEmail,
                parentPhone,
                parentName,
                studentName,
                eventTitle,
                amount,
                referenceNumber,
                paymentDate
            } = confirmationData;

            const results = {
                email: { success: false, error: null },
                sms: { success: false, error: null }
            };

            // Send email confirmation
            if (this.emailEnabled && parentEmail) {
                try {
                    const emailResult = await emailService.sendPaymentConfirmationEmail(
                        parentEmail,
                        parentName,
                        studentName,
                        eventTitle,
                        amount,
                        referenceNumber,
                        paymentDate
                    );
                    results.email = emailResult;
                } catch (error) {
                    results.email.error = error.message;
                }
            }

            // Send SMS confirmation
            if (this.smsEnabled && parentPhone) {
                try {
                    const smsResult = await smsService.sendPaymentConfirmation(
                        parentPhone,
                        parentName,
                        studentName,
                        eventTitle,
                        amount,
                        referenceNumber
                    );
                    results.sms = smsResult;
                } catch (error) {
                    results.sms.error = error.message;
                }
            }

            // Create in-app notification
            await this.createInAppNotification({
                userId: confirmationData.parentId,
                title: `Payment Confirmed - ${eventTitle}`,
                message: `Payment of $${amount} has been confirmed for ${studentName}'s registration. Reference: ${referenceNumber}`,
                type: 'success',
                category: 'payment',
                actionUrl: '/parents/dashboard'
            });

            return {
                success: results.email.success || results.sms.success,
                results: results
            };

        } catch (error) {
            console.error('Error sending payment confirmation:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send parent account approval notification
     */
    async sendParentAccountApproval(approvalData) {
        try {
            const {
                parentEmail,
                parentPhone,
                parentName,
                tempPassword,
                childrenNames
            } = approvalData;

            const results = {
                email: { success: false, error: null },
                sms: { success: false, error: null }
            };

            // Send email notification
            if (this.emailEnabled && parentEmail) {
                try {
                    const emailResult = await emailService.sendParentAccountApprovalEmail(
                        parentEmail,
                        parentName,
                        tempPassword,
                        childrenNames
                    );
                    results.email = emailResult;
                } catch (error) {
                    results.email.error = error.message;
                }
            }

            // Send SMS notification
            if (this.smsEnabled && parentPhone) {
                try {
                    const smsResult = await smsService.sendAccountApprovalNotification(
                        parentPhone,
                        parentName,
                        tempPassword
                    );
                    results.sms = smsResult;
                } catch (error) {
                    results.sms.error = error.message;
                }
            }

            // Create in-app notification
            await this.createInAppNotification({
                userId: approvalData.parentId,
                title: 'Welcome! Account Approved',
                message: `Your parent account has been approved. You can now access the school events system and manage your children's registrations.`,
                type: 'success',
                category: 'system',
                actionUrl: '/parents/dashboard'
            });

            return {
                success: results.email.success || results.sms.success,
                results: results
            };

        } catch (error) {
            console.error('Error sending account approval notification:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send event reminder notifications
     */
    async sendEventReminder(reminderData) {
        try {
            const {
                parentEmail,
                parentPhone,
                parentName,
                studentName,
                eventTitle,
                eventDate,
                location
            } = reminderData;

            const results = {
                email: { success: false, error: null },
                sms: { success: false, error: null }
            };

            // Send email reminder
            if (this.emailEnabled && parentEmail) {
                try {
                    const emailResult = await emailService.sendEventReminderEmail(
                        parentEmail,
                        parentName,
                        studentName,
                        eventTitle,
                        eventDate,
                        location
                    );
                    results.email = emailResult;
                } catch (error) {
                    results.email.error = error.message;
                }
            }

            // Send SMS reminder
            if (this.smsEnabled && parentPhone) {
                try {
                    const smsResult = await smsService.sendEventReminder(
                        parentPhone,
                        parentName,
                        studentName,
                        eventTitle,
                        eventDate,
                        location
                    );
                    results.sms = smsResult;
                } catch (error) {
                    results.sms.error = error.message;
                }
            }

            // Create in-app notification
            await this.createInAppNotification({
                userId: reminderData.parentId,
                title: `Event Reminder - ${eventTitle}`,
                message: `Reminder: ${studentName} is registered for "${eventTitle}" tomorrow at ${location}.`,
                type: 'reminder',
                category: 'event',
                actionUrl: '/events'
            });

            return {
                success: results.email.success || results.sms.success,
                results: results
            };

        } catch (error) {
            console.error('Error sending event reminder:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Create in-app notification
     */
    async createInAppNotification(notificationData) {
        try {
            await db.query(`
                INSERT INTO notifications (
                    user_id, title, message, type, category, action_url
                ) VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                notificationData.userId,
                notificationData.title,
                notificationData.message,
                notificationData.type,
                notificationData.category,
                notificationData.actionUrl
            ]);

            return { success: true };
        } catch (error) {
            console.error('Error creating in-app notification:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get notification preferences for a user
     */
    async getNotificationPreferences(userId) {
        try {
            const result = await db.query(`
                SELECT 
                    email, phone,
                    CASE WHEN email IS NOT NULL AND email != '' THEN true ELSE false END as email_enabled,
                    CASE WHEN phone IS NOT NULL AND phone != '' THEN true ELSE false END as sms_enabled
                FROM users 
                WHERE id = $1
            `, [userId]);

            if (result.rows.length === 0) {
                return { email_enabled: false, sms_enabled: false };
            }

            return result.rows[0];
        } catch (error) {
            console.error('Error getting notification preferences:', error);
            return { email_enabled: false, sms_enabled: false };
        }
    }

    /**
     * Bulk send notifications to multiple recipients
     */
    async bulkSendNotifications(notificationType, recipients, templateData) {
        const results = [];

        for (const recipient of recipients) {
            try {
                let result;
                const data = { ...templateData, ...recipient };

                switch (notificationType) {
                    case 'event_registration':
                        result = await this.sendEventRegistrationNotification(data);
                        break;
                    case 'payment_reminder':
                        result = await this.sendPaymentReminder(data);
                        break;
                    case 'payment_confirmation':
                        result = await this.sendPaymentConfirmation(data);
                        break;
                    case 'event_reminder':
                        result = await this.sendEventReminder(data);
                        break;
                    default:
                        result = { success: false, error: 'Unknown notification type' };
                }

                results.push({
                    recipientId: recipient.parentId,
                    success: result.success,
                    error: result.error
                });

                // Small delay to avoid overwhelming services
                await new Promise(resolve => setTimeout(resolve, 300));

            } catch (error) {
                results.push({
                    recipientId: recipient.parentId,
                    success: false,
                    error: error.message
                });
            }
        }

        return results;
    }

    /**
     * Get notification statistics for admin dashboard
     */
    async getNotificationStats(timeframe = '30 days') {
        try {
            const emailStats = await emailService.getEmailStats ? 
                await emailService.getEmailStats(timeframe) : 
                { total_sent: 0, successful: 0, failed: 0 };
            
            const smsStats = await smsService.getSMSStats(timeframe);
            
            const inAppStats = await db.query(`
                SELECT 
                    COUNT(*) as total_notifications,
                    COUNT(CASE WHEN is_read = false THEN 1 END) as unread,
                    COUNT(CASE WHEN is_read = true THEN 1 END) as read
                FROM notifications 
                WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '${timeframe}'
            `);

            return {
                email: emailStats,
                sms: smsStats,
                inApp: inAppStats.rows[0],
                timeframe: timeframe
            };
        } catch (error) {
            console.error('Error getting notification stats:', error);
            return {
                email: { total_sent: 0, successful: 0, failed: 0 },
                sms: { total_sent: 0, successful: 0, failed: 0, total_cost: 0 },
                inApp: { total_notifications: 0, unread: 0, read: 0 },
                timeframe: timeframe
            };
        }
    }
}

module.exports = new NotificationService();
