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

// Email templates
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

// Send a custom notification (arbitrary subject and HTML)
const sendCustomNotification = async ({ to, subject, html }) => {
    return await sendEmail(to, subject, html);
};

module.exports = {
    sendEmail,
    sendEventRegistrationEmail,
    sendEventReminderEmail,
    sendNewEventNotification,
    sendCustomNotification
};