const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../config.env') });
const db = require('../database/connection');

// Create transporter with enhanced configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false,
        ciphers: 'SSLv3'
    },
    debug: true, // Enable debug output
    logger: true // Log to console
});

// Enhanced email templates for new workflow
const emailTemplates = {
    eventRegistration: (parentName, studentName, eventTitle, eventDate, fee) => `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background: linear-gradient(135deg, #6f42c1, #8e44ad); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="margin: 0; font-size: 28px;">🎓 School Events</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Event Registration Confirmation</p>
            </div>
            
            <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h2 style="color: #6f42c1; margin-bottom: 20px;">Hello ${parentName}!</h2>
                
                <p style="font-size: 16px; line-height: 1.6; color: #333;">
                    Your child <strong>${studentName}</strong> has been successfully registered for the following event:
                </p>
                
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6f42c1;">
                    <h3 style="color: #6f42c1; margin: 0 0 10px 0;">${eventTitle}</h3>
                    <p style="margin: 5px 0;"><strong>Date:</strong> ${eventDate}</p>
                    <p style="margin: 5px 0;"><strong>Participation Fee:</strong> $${fee}</p>
                </div>
                
                <p style="font-size: 16px; line-height: 1.6; color: #333;">
                    Please ensure the participation fee is paid before the event date. You can view all event details and manage registrations through your parent dashboard.
                </p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.APP_URL}/dashboard" style="background: linear-gradient(135deg, #6f42c1, #8e44ad); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">
                        View Dashboard
                    </a>
                </div>
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                
                <p style="font-size: 14px; color: #666; text-align: center;">
                    If you have any questions, please contact the school administration.<br>
                    Thank you for your participation!
                </p>
            </div>
        </div>
    `,
    
    eventReminder: (parentName, studentName, eventTitle, eventDate, location) => `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background: linear-gradient(135deg, #e74c3c, #c0392b); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="margin: 0; font-size: 28px;">🎓 School Events</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Event Reminder</p>
            </div>
            
            <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h2 style="color: #e74c3c; margin-bottom: 20px;">Hello ${parentName}!</h2>
                
                <p style="font-size: 16px; line-height: 1.6; color: #333;">
                    This is a friendly reminder about the upcoming event for <strong>${studentName}</strong>:
                </p>
                
                <div style="background: #fff5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e74c3c;">
                    <h3 style="color: #e74c3c; margin: 0 0 10px 0;">${eventTitle}</h3>
                    <p style="margin: 5px 0;"><strong>Date:</strong> ${eventDate}</p>
                    <p style="margin: 5px 0;"><strong>Location:</strong> ${location}</p>
                </div>
                
                <p style="font-size: 16px; line-height: 1.6; color: #333;">
                    Please ensure your child arrives on time and brings any required materials. We look forward to seeing you there!
                </p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.APP_URL}/dashboard" style="background: linear-gradient(135deg, #e74c3c, #c0392b); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">
                        View Event Details
                    </a>
                </div>
            </div>
        </div>
    `,
    
    newEventNotification: (parentName, eventTitle, eventDate, eventType, fee) => `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background: linear-gradient(135deg, #27ae60, #2ecc71); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="margin: 0; font-size: 28px;">🎓 School Events</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">New Event Announcement</p>
            </div>
            
            <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h2 style="color: #27ae60; margin-bottom: 20px;">Hello ${parentName}!</h2>
                
                <p style="font-size: 16px; line-height: 1.6; color: #333;">
                    A new exciting event has been announced at our school:
                </p>
                
                <div style="background: #f0fff4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #27ae60;">
                    <h3 style="color: #27ae60; margin: 0 0 10px 0;">${eventTitle}</h3>
                    <p style="margin: 5px 0;"><strong>Type:</strong> ${eventType}</p>
                    <p style="margin: 5px 0;"><strong>Date:</strong> ${eventDate}</p>
                    <p style="margin: 5px 0;"><strong>Participation Fee:</strong> $${fee}</p>
                </div>
                
                <p style="font-size: 16px; line-height: 1.6; color: #333;">
                    Don't miss out on this opportunity! Register your child now to secure their spot.
                </p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.APP_URL}/events" style="background: linear-gradient(135deg, #27ae60, #2ecc71); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">
                        Register Now
                    </a>
                </div>
            </div>
        </div>
    `,

    // New template for teacher event registration notification
    teacherRegistrationNotification: (parentName, studentName, eventTitle, eventDate, fee, teacherName, paymentDueDate) => `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background: linear-gradient(135deg, #007bff, #0056b3); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="margin: 0; font-size: 28px;">🎓 School Events</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Your Child Has Been Registered!</p>
            </div>
            
            <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h2 style="color: #007bff; margin-bottom: 20px;">Dear ${parentName},</h2>
                
                <p style="font-size: 16px; line-height: 1.6; color: #333;">
                    Great news! <strong>${teacherName}</strong> has registered <strong>${studentName}</strong> for an upcoming school event.
                </p>
                
                <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff;">
                    <h3 style="color: #007bff; margin: 0 0 15px 0;">${eventTitle}</h3>
                    <p style="margin: 5px 0;"><strong>📅 Event Date:</strong> ${eventDate}</p>
                    <p style="margin: 5px 0;"><strong>👨‍🏫 Registered by:</strong> ${teacherName}</p>
                    <p style="margin: 5px 0;"><strong>💰 Participation Fee:</strong> $${fee}</p>
                    <p style="margin: 5px 0;"><strong>⏰ Payment Due:</strong> ${paymentDueDate}</p>
                </div>
                
                <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
                    <p style="margin: 0; color: #856404;">
                        <strong>⚠️ Action Required:</strong> Please log in to your parent portal to complete the payment for this event registration.
                    </p>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.APP_URL}/parents/dashboard" style="background: linear-gradient(135deg, #007bff, #0056b3); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold; margin-right: 10px;">
                        Make Payment
                    </a>
                    <a href="${process.env.APP_URL}/events" style="background: #6c757d; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">
                        View Event Details
                    </a>
                </div>
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                
                <p style="font-size: 14px; color: #666; text-align: center;">
                    If you have any questions about this registration, please contact your child's teacher or the school administration.<br>
                    Thank you for your prompt attention to this matter!
                </p>
            </div>
        </div>
    `,

    // Payment reminder template
    paymentReminder: (parentName, studentName, eventTitle, amount, dueDate, daysLeft) => `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background: linear-gradient(135deg, #fd7e14, #e55a00); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="margin: 0; font-size: 28px;">💰 School Events</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Payment Reminder</p>
            </div>
            
            <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h2 style="color: #fd7e14; margin-bottom: 20px;">Hello ${parentName}!</h2>
                
                <p style="font-size: 16px; line-height: 1.6; color: #333;">
                    This is a friendly reminder that payment is due for <strong>${studentName}</strong>'s event registration.
                </p>
                
                <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #fd7e14;">
                    <h3 style="color: #fd7e14; margin: 0 0 15px 0;">${eventTitle}</h3>
                    <p style="margin: 5px 0;"><strong>💰 Amount Due:</strong> $${amount}</p>
                    <p style="margin: 5px 0;"><strong>⏰ Due Date:</strong> ${dueDate}</p>
                    <p style="margin: 5px 0;"><strong>⏳ Days Left:</strong> ${daysLeft} days</p>
                </div>
                
                <p style="font-size: 16px; line-height: 1.6; color: #333;">
                    Please complete your payment as soon as possible to secure your child's participation in this event.
                </p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.APP_URL}/parents/dashboard" style="background: linear-gradient(135deg, #fd7e14, #e55a00); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">
                        Pay Now
                    </a>
                </div>
            </div>
        </div>
    `,

    // Payment confirmation template
    paymentConfirmation: (parentName, studentName, eventTitle, amount, referenceNumber, paymentDate) => `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="margin: 0; font-size: 28px;">✅ School Events</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Payment Confirmed!</p>
            </div>
            
            <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h2 style="color: #28a745; margin-bottom: 20px;">Thank you ${parentName}!</h2>
                
                <p style="font-size: 16px; line-height: 1.6; color: #333;">
                    Your payment has been successfully processed for <strong>${studentName}</strong>'s event registration.
                </p>
                
                <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
                    <h3 style="color: #28a745; margin: 0 0 15px 0;">${eventTitle}</h3>
                    <p style="margin: 5px 0;"><strong>💰 Amount Paid:</strong> $${amount}</p>
                    <p style="margin: 5px 0;"><strong>📧 Reference Number:</strong> ${referenceNumber}</p>
                    <p style="margin: 5px 0;"><strong>📅 Payment Date:</strong> ${paymentDate}</p>
                </div>
                
                <p style="font-size: 16px; line-height: 1.6; color: #333;">
                    Your child's participation in this event is now confirmed. You will receive further details closer to the event date.
                </p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.APP_URL}/parents/dashboard" style="background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">
                        View Dashboard
                    </a>
                </div>
            </div>
        </div>
    `,

    // Parent account approval template
    parentAccountApproval: (parentName, tempPassword, childrenNames) => `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background: linear-gradient(135deg, #6f42c1, #8e44ad); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="margin: 0; font-size: 28px;">🎉 School Events</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Welcome to Our School Community!</p>
            </div>
            
            <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h2 style="color: #6f42c1; margin-bottom: 20px;">Dear ${parentName},</h2>
                
                <p style="font-size: 16px; line-height: 1.6; color: #333;">
                    Congratulations! Your parent account has been approved by our school administration. You now have access to our school events management system.
                </p>
                
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6f42c1;">
                    <h3 style="color: #6f42c1; margin: 0 0 15px 0;">Your Account Details</h3>
                    <p style="margin: 5px 0;"><strong>📧 Username:</strong> Your email address</p>
                    <p style="margin: 5px 0;"><strong>🔑 Temporary Password:</strong> <code style="background: #e9ecef; padding: 2px 4px;">${tempPassword}</code></p>
                    <p style="margin: 5px 0;"><strong>👶 Your Children:</strong> ${childrenNames}</p>
                </div>
                
                <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
                    <p style="margin: 0; color: #856404;">
                        <strong>⚠️ Important:</strong> Please change your password after your first login for security purposes.
                    </p>
                </div>
                
                <p style="font-size: 16px; line-height: 1.6; color: #333;">
                    Through your parent portal, you can:
                </p>
                
                <ul style="color: #333; line-height: 1.6;">
                    <li>View all school events and activities</li>
                    <li>Receive notifications when your child is registered for events</li>
                    <li>Make online payments for event participation fees</li>
                    <li>Track payment history and receipts</li>
                    <li>Communicate with teachers and school administration</li>
                </ul>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.APP_URL}/auth/login" style="background: linear-gradient(135deg, #6f42c1, #8e44ad); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">
                        Login to Your Account
                    </a>
                </div>
            </div>
        </div>
    `
};

const sendEmail = async (to, subject, htmlContent) => {
    try {
        // Check if email configuration is valid
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.log('⚠️  Email configuration missing - skipping email send');
            return { success: false, error: 'Email configuration not set up' };
        }

        const mailOptions = {
            from: `"School Events" <${process.env.EMAIL_USER}>`,
            to: to,
            subject: subject,
            html: htmlContent
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully:', info.messageId);
        return { success: true, messageId: info.messageId };

    } catch (error) {
        console.error('❌ Email sending failed:', error.message);
        
        // Provide helpful error messages for common issues
        if (error.code === 'EAUTH') {
            console.log('🔧 Gmail Authentication Error - Solutions:');
            console.log('1. Enable 2-Factor Authentication on your Gmail account');
            console.log('2. Generate an App Password (not your regular password)');
            console.log('3. Update EMAIL_PASS in config.env with the App Password');
            console.log('4. Or use a different email service (Outlook, Yahoo, etc.)');
            console.log('5. Make sure the App Password has no extra spaces');
        }
        
        return { success: false, error: error.message };
    }
};

// Specific email functions
const sendEventRegistrationEmail = async (parentEmail, parentName, studentName, eventTitle, eventDate, fee) => {
    const subject = `Event Registration Confirmation - ${eventTitle}`;
    const htmlContent = emailTemplates.eventRegistration(parentName, studentName, eventTitle, eventDate, fee);
    return await sendEmail(parentEmail, subject, htmlContent);
};

const sendEventReminderEmail = async (parentEmail, parentName, studentName, eventTitle, eventDate, location) => {
    const subject = `Event Reminder - ${eventTitle}`;
    const htmlContent = emailTemplates.eventReminder(parentName, studentName, eventTitle, eventDate, location);
    return await sendEmail(parentEmail, subject, htmlContent);
};

const sendNewEventNotification = async (parentEmail, parentName, eventTitle, eventDate, eventType, fee) => {
    const subject = `New Event Announcement - ${eventTitle}`;
    const htmlContent = emailTemplates.newEventNotification(parentName, eventTitle, eventDate, eventType, fee);
    return await sendEmail(parentEmail, subject, htmlContent);
};

// Send bulk event notification to all parents
const sendBulkEventNotification = async (eventData) => {
    try {
        // Get all parent users
        const parentsResult = await db.query(`
            SELECT u.email, u.full_name 
            FROM users u 
            WHERE u.role = 'parent' 
            AND u.email IS NOT NULL 
            AND u.email != ''
        `);

        if (parentsResult.rows.length === 0) {
            console.log('ℹ️  No parent users found for bulk notification');
            return { success: true, sent: 0 };
        }

        const parents = parentsResult.rows;
        let successCount = 0;
        let errorCount = 0;

        console.log(`📧 Sending bulk notification to ${parents.length} parents...`);

        // Send notification to each parent
        for (const parent of parents) {
            try {
                const result = await sendNewEventNotification(
                    parent.email,
                    parent.full_name,
                    eventData.title,
                    eventData.start_date,
                    eventData.event_type,
                    eventData.fee
                );

                if (result.success) {
                    successCount++;
                } else {
                    errorCount++;
                    console.error(`❌ Failed to send to ${parent.email}:`, result.error);
                }

                // Small delay to avoid overwhelming the email server
                await new Promise(resolve => setTimeout(resolve, 100));

            } catch (error) {
                errorCount++;
                console.error(`❌ Error sending to ${parent.email}:`, error.message);
            }
        }

        console.log(`✅ Bulk notification completed: ${successCount} sent, ${errorCount} failed`);
        return { 
            success: true, 
            sent: successCount, 
            failed: errorCount,
            total: parents.length 
        };

    } catch (error) {
        console.error('❌ Bulk notification error:', error.message);
        return { success: false, error: error.message };
    }
};

// New email functions for enhanced workflow

// Teacher registration notification to parent
const sendTeacherRegistrationNotification = async (parentEmail, parentName, studentName, eventTitle, eventDate, fee, teacherName, paymentDueDate) => {
    const subject = `Your Child Has Been Registered for ${eventTitle}`;
    const htmlContent = emailTemplates.teacherRegistrationNotification(parentName, studentName, eventTitle, eventDate, fee, teacherName, paymentDueDate);
    
    // Log the email attempt
    await logEmail({
        recipientEmail: parentEmail,
        recipientName: parentName,
        subject: subject,
        content: htmlContent,
        templateUsed: 'teacher_registration_notification'
    });
    
    return await sendEmail(parentEmail, subject, htmlContent);
};

// Payment reminder email
const sendPaymentReminderEmail = async (parentEmail, parentName, studentName, eventTitle, amount, dueDate, daysLeft) => {
    const subject = `Payment Reminder - ${eventTitle}`;
    const htmlContent = emailTemplates.paymentReminder(parentName, studentName, eventTitle, amount, dueDate, daysLeft);
    
    await logEmail({
        recipientEmail: parentEmail,
        recipientName: parentName,
        subject: subject,
        content: htmlContent,
        templateUsed: 'payment_reminder'
    });
    
    return await sendEmail(parentEmail, subject, htmlContent);
};

// Payment confirmation email
const sendPaymentConfirmationEmail = async (parentEmail, parentName, studentName, eventTitle, amount, referenceNumber, paymentDate) => {
    const subject = `Payment Confirmed - ${eventTitle}`;
    const htmlContent = emailTemplates.paymentConfirmation(parentName, studentName, eventTitle, amount, referenceNumber, paymentDate);
    
    await logEmail({
        recipientEmail: parentEmail,
        recipientName: parentName,
        subject: subject,
        content: htmlContent,
        templateUsed: 'payment_confirmation'
    });
    
    return await sendEmail(parentEmail, subject, htmlContent);
};

// Parent account approval email
const sendParentAccountApprovalEmail = async (parentEmail, parentName, tempPassword, childrenNames) => {
    const subject = 'Welcome! Your Parent Account Has Been Approved';
    const htmlContent = emailTemplates.parentAccountApproval(parentName, tempPassword, childrenNames);
    
    await logEmail({
        recipientEmail: parentEmail,
        recipientName: parentName,
        subject: subject,
        content: htmlContent,
        templateUsed: 'parent_account_approval'
    });
    
    return await sendEmail(parentEmail, subject, htmlContent);
};

// Send a custom notification (arbitrary subject and HTML)
const sendCustomNotification = async ({ to, subject, html }) => {
    return await sendEmail(to, subject, html);
};

// Enhanced bulk email with better error handling
const sendBulkTeacherRegistrationNotifications = async (registrations) => {
    const results = [];
    
    for (const registration of registrations) {
        try {
            const result = await sendTeacherRegistrationNotification(
                registration.parentEmail,
                registration.parentName,
                registration.studentName,
                registration.eventTitle,
                registration.eventDate,
                registration.fee,
                registration.teacherName,
                registration.paymentDueDate
            );
            
            results.push({
                parentEmail: registration.parentEmail,
                success: result.success,
                error: result.error
            });
            
            // Small delay to avoid overwhelming the email server
            await new Promise(resolve => setTimeout(resolve, 200));
            
        } catch (error) {
            results.push({
                parentEmail: registration.parentEmail,
                success: false,
                error: error.message
            });
        }
    }
    
    return results;
};

// Log email to database
const logEmail = async (emailData) => {
    try {
        await db.query(`
            INSERT INTO email_logs (
                recipient_email, recipient_name, subject, content, 
                template_used, status, sent_at
            ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        `, [
            emailData.recipientEmail,
            emailData.recipientName,
            emailData.subject,
            emailData.content,
            emailData.templateUsed,
            'sent'
        ]);
    } catch (error) {
        console.error('Error logging email:', error);
    }
};

module.exports = {
    sendEmail,
    sendEventRegistrationEmail,
    sendEventReminderEmail,
    sendNewEventNotification,
    sendBulkEventNotification,
    sendCustomNotification,
    // New functions for enhanced workflow
    sendTeacherRegistrationNotification,
    sendPaymentReminderEmail,
    sendPaymentConfirmationEmail,
    sendParentAccountApprovalEmail,
    sendBulkTeacherRegistrationNotifications,
    logEmail
};