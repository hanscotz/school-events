const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { v4: uuidv4 } = require('uuid');
const db = require('../database/connection');
const notificationService = require('./notificationService');

class PaymentService {
    constructor() {
        this.stripeEnabled = !!process.env.STRIPE_SECRET_KEY;
        this.currency = process.env.PAYMENT_CURRENCY || 'usd';
    }

    /**
     * Create a payment intent for event registration
     */
    async createPaymentIntent(paymentData) {
        try {
            const {
                registrationId,
                amount,
                parentId,
                studentName,
                eventTitle,
                parentEmail
            } = paymentData;

            // Validate amount
            if (!amount || amount <= 0) {
                throw new Error('Invalid payment amount');
            }

            // Create payment record in database
            const paymentReference = uuidv4();
            const paymentId = await this.createPaymentRecord({
                registrationId,
                amount,
                currency: this.currency,
                paymentMethod: 'stripe',
                paymentReference,
                status: 'pending'
            });

            let clientSecret = null;
            let stripePaymentIntentId = null;

            // Create Stripe payment intent if enabled
            if (this.stripeEnabled) {
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: Math.round(amount * 100), // Convert to cents
                    currency: this.currency,
                    metadata: {
                        registrationId: registrationId,
                        paymentId: paymentId,
                        parentId: parentId,
                        studentName: studentName,
                        eventTitle: eventTitle
                    },
                    receipt_email: parentEmail,
                    description: `Payment for ${studentName} - ${eventTitle}`
                });

                clientSecret = paymentIntent.client_secret;
                stripePaymentIntentId = paymentIntent.id;

                // Update payment record with Stripe payment intent ID
                await db.query(`
                    UPDATE payments 
                    SET transaction_id = $1 
                    WHERE id = $2
                `, [stripePaymentIntentId, paymentId]);
            }

            return {
                success: true,
                paymentId: paymentId,
                paymentReference: paymentReference,
                clientSecret: clientSecret,
                stripeEnabled: this.stripeEnabled,
                amount: amount,
                currency: this.currency
            };

        } catch (error) {
            console.error('Error creating payment intent:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Process payment completion
     */
    async processPaymentCompletion(paymentIntentId, paymentMethod = 'stripe') {
        try {
            let paymentData = null;

            if (this.stripeEnabled && paymentMethod === 'stripe') {
                // Retrieve payment intent from Stripe
                const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
                
                if (paymentIntent.status !== 'succeeded') {
                    throw new Error('Payment not completed successfully');
                }

                paymentData = {
                    transactionId: paymentIntent.id,
                    amount: paymentIntent.amount / 100, // Convert from cents
                    currency: paymentIntent.currency,
                    metadata: paymentIntent.metadata,
                    status: 'completed'
                };
            } else {
                // Handle other payment methods or manual confirmation
                paymentData = {
                    transactionId: paymentIntentId,
                    status: 'completed'
                };
            }

            // Update payment record in database
            const updateResult = await db.query(`
                UPDATE payments 
                SET 
                    status = $1,
                    gateway_response = $2,
                    processed_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE transaction_id = $3
                RETURNING *
            `, [
                paymentData.status,
                JSON.stringify(paymentData),
                paymentData.transactionId
            ]);

            if (updateResult.rows.length === 0) {
                throw new Error('Payment record not found');
            }

            const payment = updateResult.rows[0];

            // Update event registration payment status
            await db.query(`
                UPDATE event_registrations 
                SET 
                    payment_status = 'paid',
                    payment_amount = $1,
                    payment_method = $2,
                    payment_reference = $3,
                    payment_date = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $4
            `, [
                payment.amount,
                paymentMethod,
                payment.payment_reference,
                payment.registration_id
            ]);

            // Get registration details for notification
            const registrationResult = await db.query(`
                SELECT 
                    er.*,
                    e.title as event_title,
                    e.start_date as event_date,
                    s.first_name || ' ' || s.last_name as student_name,
                    u.email as parent_email,
                    u.phone as parent_phone,
                    u.first_name || ' ' || u.last_name as parent_name
                FROM event_registrations er
                JOIN events e ON er.event_id = e.id
                JOIN students s ON er.student_id = s.id
                JOIN users u ON er.parent_id = u.id
                WHERE er.id = $1
            `, [payment.registration_id]);

            if (registrationResult.rows.length > 0) {
                const registration = registrationResult.rows[0];

                // Send payment confirmation notifications
                await notificationService.sendPaymentConfirmation({
                    parentId: registration.parent_id,
                    parentEmail: registration.parent_email,
                    parentPhone: registration.parent_phone,
                    parentName: registration.parent_name,
                    studentName: registration.student_name,
                    eventTitle: registration.event_title,
                    amount: payment.amount,
                    referenceNumber: payment.payment_reference,
                    paymentDate: new Date().toLocaleDateString()
                });
            }

            return {
                success: true,
                payment: payment,
                registration: registrationResult.rows[0]
            };

        } catch (error) {
            console.error('Error processing payment completion:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Create payment record in database
     */
    async createPaymentRecord(paymentData) {
        try {
            const result = await db.query(`
                INSERT INTO payments (
                    registration_id, amount, currency, payment_method,
                    payment_reference, status, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING id
            `, [
                paymentData.registrationId,
                paymentData.amount,
                paymentData.currency,
                paymentData.paymentMethod,
                paymentData.paymentReference,
                paymentData.status
            ]);

            return result.rows[0].id;
        } catch (error) {
            console.error('Error creating payment record:', error);
            throw error;
        }
    }

    /**
     * Get payment details
     */
    async getPaymentDetails(paymentId) {
        try {
            const result = await db.query(`
                SELECT 
                    p.*,
                    er.event_id,
                    er.student_id,
                    er.parent_id,
                    e.title as event_title,
                    s.first_name || ' ' || s.last_name as student_name,
                    u.first_name || ' ' || u.last_name as parent_name
                FROM payments p
                JOIN event_registrations er ON p.registration_id = er.id
                JOIN events e ON er.event_id = e.id
                JOIN students s ON er.student_id = s.id
                JOIN users u ON er.parent_id = u.id
                WHERE p.id = $1
            `, [paymentId]);

            if (result.rows.length === 0) {
                return { success: false, error: 'Payment not found' };
            }

            return {
                success: true,
                payment: result.rows[0]
            };
        } catch (error) {
            console.error('Error getting payment details:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get payment history for a parent
     */
    async getParentPaymentHistory(parentId, limit = 20, offset = 0) {
        try {
            const result = await db.query(`
                SELECT 
                    p.*,
                    er.registration_date,
                    e.title as event_title,
                    e.start_date as event_date,
                    s.first_name || ' ' || s.last_name as student_name
                FROM payments p
                JOIN event_registrations er ON p.registration_id = er.id
                JOIN events e ON er.event_id = e.id
                JOIN students s ON er.student_id = s.id
                WHERE er.parent_id = $1
                ORDER BY p.created_at DESC
                LIMIT $2 OFFSET $3
            `, [parentId, limit, offset]);

            const countResult = await db.query(`
                SELECT COUNT(*) as total
                FROM payments p
                JOIN event_registrations er ON p.registration_id = er.id
                WHERE er.parent_id = $1
            `, [parentId]);

            return {
                success: true,
                payments: result.rows,
                total: parseInt(countResult.rows[0].total),
                limit: limit,
                offset: offset
            };
        } catch (error) {
            console.error('Error getting payment history:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get pending payments for a parent
     */
    async getPendingPayments(parentId) {
        try {
            const result = await db.query(`
                SELECT 
                    er.*,
                    e.title as event_title,
                    e.start_date as event_date,
                    e.fee as event_fee,
                    e.registration_deadline,
                    s.first_name || ' ' || s.last_name as student_name,
                    EXTRACT(DAYS FROM (e.registration_deadline - CURRENT_TIMESTAMP)) as days_left
                FROM event_registrations er
                JOIN events e ON er.event_id = e.id
                JOIN students s ON er.student_id = s.id
                WHERE er.parent_id = $1 
                AND er.payment_status = 'pending'
                AND e.status = 'active'
                AND e.registration_deadline > CURRENT_TIMESTAMP
                ORDER BY e.registration_deadline ASC
            `, [parentId]);

            return {
                success: true,
                pendingPayments: result.rows
            };
        } catch (error) {
            console.error('Error getting pending payments:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Process refund
     */
    async processRefund(paymentId, refundAmount, reason) {
        try {
            // Get payment details
            const paymentResult = await this.getPaymentDetails(paymentId);
            if (!paymentResult.success) {
                throw new Error('Payment not found');
            }

            const payment = paymentResult.payment;

            if (payment.status !== 'completed') {
                throw new Error('Cannot refund incomplete payment');
            }

            let refundId = null;

            // Process Stripe refund if applicable
            if (this.stripeEnabled && payment.payment_method === 'stripe' && payment.transaction_id) {
                const refund = await stripe.refunds.create({
                    payment_intent: payment.transaction_id,
                    amount: Math.round(refundAmount * 100), // Convert to cents
                    reason: 'requested_by_customer',
                    metadata: {
                        originalPaymentId: paymentId,
                        refundReason: reason
                    }
                });

                refundId = refund.id;
            }

            // Update payment status
            await db.query(`
                UPDATE payments 
                SET 
                    status = 'refunded',
                    gateway_response = jsonb_set(
                        COALESCE(gateway_response, '{}'),
                        '{refund}',
                        $1
                    ),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
            `, [
                JSON.stringify({
                    refundId: refundId,
                    refundAmount: refundAmount,
                    refundReason: reason,
                    refundDate: new Date().toISOString()
                }),
                paymentId
            ]);

            // Update event registration
            await db.query(`
                UPDATE event_registrations 
                SET 
                    payment_status = 'refunded',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [payment.registration_id]);

            return {
                success: true,
                refundId: refundId,
                refundAmount: refundAmount
            };

        } catch (error) {
            console.error('Error processing refund:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get payment statistics for admin dashboard
     */
    async getPaymentStats(timeframe = '30 days') {
        try {
            const result = await db.query(`
                SELECT 
                    COUNT(*) as total_payments,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_payments,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_payments,
                    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payments,
                    COUNT(CASE WHEN status = 'refunded' THEN 1 END) as refunded_payments,
                    SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_revenue,
                    AVG(CASE WHEN status = 'completed' THEN amount ELSE NULL END) as average_payment
                FROM payments 
                WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '${timeframe}'
            `);

            return {
                success: true,
                stats: result.rows[0],
                timeframe: timeframe
            };
        } catch (error) {
            console.error('Error getting payment stats:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Send payment reminders for overdue payments
     */
    async sendPaymentReminders() {
        try {
            // Get overdue payments (deadline passed but payment still pending)
            const overdueResult = await db.query(`
                SELECT 
                    er.*,
                    e.title as event_title,
                    e.start_date as event_date,
                    e.fee as event_fee,
                    e.registration_deadline,
                    s.first_name || ' ' || s.last_name as student_name,
                    u.email as parent_email,
                    u.phone as parent_phone,
                    u.first_name || ' ' || u.last_name as parent_name,
                    EXTRACT(DAYS FROM (CURRENT_TIMESTAMP - e.registration_deadline)) as days_overdue
                FROM event_registrations er
                JOIN events e ON er.event_id = e.id
                JOIN students s ON er.student_id = s.id
                JOIN users u ON er.parent_id = u.id
                WHERE er.payment_status = 'pending'
                AND e.status = 'active'
                AND e.registration_deadline < CURRENT_TIMESTAMP
                AND e.start_date > CURRENT_TIMESTAMP
            `);

            const reminderResults = [];

            for (const registration of overdueResult.rows) {
                const reminderResult = await notificationService.sendPaymentReminder({
                    parentId: registration.parent_id,
                    parentEmail: registration.parent_email,
                    parentPhone: registration.parent_phone,
                    parentName: registration.parent_name,
                    studentName: registration.student_name,
                    eventTitle: registration.event_title,
                    amount: registration.event_fee,
                    dueDate: new Date(registration.registration_deadline).toLocaleDateString(),
                    daysLeft: -registration.days_overdue // Negative because it's overdue
                });

                reminderResults.push({
                    registrationId: registration.id,
                    success: reminderResult.success,
                    error: reminderResult.error
                });

                // Small delay to avoid overwhelming services
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            return {
                success: true,
                overdueCount: overdueResult.rows.length,
                reminderResults: reminderResults
            };

        } catch (error) {
            console.error('Error sending payment reminders:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new PaymentService();
