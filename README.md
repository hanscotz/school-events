# 🎓 School Events Management System

A comprehensive, modern web application for managing school events with role-based access for administrators, teachers, and parents. Built with Node.js, Express, PostgreSQL, and featuring beautiful responsive UI.

## ✨ Features

### 🔐 Role-Based Access Control
- **Administrators**: Full system control, user management, event creation
- **Teachers**: Student management, event registration, class oversight
- **Parents**: Event viewing, payment processing, notifications

### 🎯 Core Functionality

#### For Administrators
- 📊 Comprehensive dashboard with system analytics
- 👥 User management (create teachers, approve parents)
- 🎪 Event creation and management
- 📋 Parent registration approval workflow
- 🏫 Class and student oversight
- 📈 Detailed reporting and analytics
- ⚙️ System settings and configuration

#### For Teachers
- 👨‍🏫 Student management for assigned classes
- ➕ Add and edit student records
- 📝 Register students for events
- 📊 Class participation tracking
- 📋 Event registration management
- 📑 Class summary and reports

#### For Parents
- 👶 View children's information and activities
- 🔔 Receive notifications (email, SMS, in-app)
- 💳 Secure payment processing with Stripe
- 📱 Mobile-responsive dashboard
- 📋 Payment history and receipts
- 💬 Submit feedback to school
- 🔍 Browse and search school events

### 🔔 Advanced Notification System
- **Email Notifications**: Beautiful HTML templates with multiple providers
- **SMS Notifications**: Multi-provider SMS support with delivery tracking
- **In-App Notifications**: Real-time notifications with read status
- **Event-Driven**: Automatic notifications for registrations, payments, approvals

### 💳 Integrated Payment System
- **Stripe Integration**: Secure payment processing
- **Payment Tracking**: Complete transaction history
- **Automatic Receipts**: Email and SMS confirmations
- **Payment Reminders**: Automated overdue payment notifications
- **Refund Management**: Admin-controlled refund processing

### 🎨 Modern UI/UX
- **Responsive Design**: Works on all devices
- **Beautiful Animations**: AOS animations and smooth transitions
- **Dark/Light Themes**: Customizable appearance
- **Intuitive Navigation**: Role-based navigation menus
- **Interactive Components**: Real-time updates and feedback

## 🛠️ Technology Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **PostgreSQL** - Primary database
- **bcryptjs** - Password hashing
- **express-session** - Session management
- **multer** - File upload handling
- **moment** - Date manipulation

### Frontend
- **EJS** - Template engine
- **Bootstrap 5** - CSS framework
- **AOS** - Animation library
- **SweetAlert2** - Beautiful alerts
- **Bootstrap Icons** - Icon library

### Services
- **Stripe** - Payment processing
- **Nodemailer** - Email service
- **SMS Service** - Multi-provider SMS
- **UUID** - Unique identifiers

### Security
- **Helmet** - Security headers
- **CSRF Protection** - Cross-site request forgery protection
- **Rate Limiting** - API rate limiting
- **Input Validation** - Express validator
- **Session Security** - Secure session handling

## 🚀 Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

### 1. Clone the Repository
   ```bash
git clone https://github.com/your-username/school-events.git
   cd school-events
   ```

### 2. Install Dependencies
   ```bash
   npm install
   ```

### 3. Environment Configuration
Create a `config.env` file in the root directory:

   ```env
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=school_events
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# Session Secret
SESSION_SECRET=your_super_secret_session_key

# Email Configuration (Gmail example)
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password
EMAIL_ENABLED=true

# SMS Configuration
SMS_API_KEY=your_sms_api_key
SMS_API_URL=https://api.sms-provider.com
SMS_FROM_NUMBER=+1234567890
SMS_ENABLED=true

# Payment Configuration
STRIPE_PUBLIC_KEY=pk_test_your_stripe_public_key
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
PAYMENT_CURRENCY=usd

# Application Configuration
   PORT=3000
NODE_ENV=development
   APP_URL=http://localhost:3000
   ```

### 4. Database Setup
   ```bash
# Create the database
   createdb school_events
   
# Run the database schema
psql -d school_events -f database/schema.sql

# Or use the setup script
node database/setup-new-db.js
```

### 5. Start the Application
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

The application will be available at `http://localhost:3000`

## 📊 Database Schema

### Core Tables
- **users** - User accounts (admin, teacher, parent)
- **students** - Student records with class assignments
- **classes** - Class management with teacher assignments
- **events** - School events with detailed information
- **event_registrations** - Student event registrations
- **payments** - Payment transaction tracking

### Workflow Tables
- **parent_registration_requests** - Parent signup approval queue
- **notifications** - In-app notification system
- **email_logs** - Email delivery tracking
- **sms_logs** - SMS delivery tracking
- **audit_logs** - Security and action auditing

### Helper Tables
- **event_categories** - Event classification
- **sessions** - User session management
- **feedback** - Parent feedback system

## 🔄 Workflow Overview

### 1. User Registration & Approval
```
Parent Request → Admin Review → Account Creation → Email/SMS Notification
```

### 2. Student Management
```
Admin Creates Teachers → Teachers Add Students → Class Assignment → Parent Linking
```

### 3. Event Management
```
Admin Creates Event → Teachers Register Students → Parent Notification → Payment Processing
```

### 4. Payment Flow
```
Registration → Notification → Payment Portal → Stripe Processing → Confirmation
```

## 🎯 User Roles & Permissions

### Administrator
- ✅ Full system access
- ✅ User management
- ✅ Event creation/editing
- ✅ Parent approval workflow
- ✅ System reports
- ✅ Class management
- ✅ Payment oversight

### Teacher
- ✅ Student management (own classes)
- ✅ Event registration for students
- ✅ Class reports
- ✅ Student information editing
- ❌ User creation
- ❌ System administration

### Parent
- ✅ View children's activities
- ✅ Payment processing
- ✅ Notification management
- ✅ Event browsing
- ✅ Feedback submission
- ❌ Student registration
- ❌ Administrative functions

## 🔔 Notification Types

### Email Notifications
- Event registration confirmations
- Payment reminders and confirmations
- Account approval notifications
- Event reminders
- System announcements

### SMS Notifications
- Urgent payment reminders
- Event registration alerts
- Account status updates
- Emergency notifications

### In-App Notifications
- Real-time activity updates
- System messages
- Payment status changes
- Event updates

## 💳 Payment Features

### Supported Payment Methods
- Credit/Debit Cards (via Stripe)
- Digital Wallets (Apple Pay, Google Pay)
- Bank Transfers (configurable)

### Payment Security
- PCI DSS compliant via Stripe
- Encrypted transaction storage
- Secure payment forms
- Fraud detection

### Payment Management
- Automatic payment reminders
- Receipt generation
- Refund processing
- Payment history tracking

## 📱 Mobile Responsiveness

The application is fully responsive and works seamlessly on:
- 📱 Mobile phones (iOS/Android)
- 📱 Tablets (iPad, Android tablets)
- 💻 Desktop computers
- 🖥️ Large monitors

## 🔧 API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `POST /auth/register` - Parent registration request
- `GET /auth/profile` - User profile
- `POST /auth/profile` - Update profile

### Events
- `GET /events` - List all events
- `GET /events/:id` - Event details
- `POST /events/create` - Create event (admin)
- `POST /events/:id/edit` - Update event (admin)
- `POST /events/:eventId/register-student` - Register student (teacher)

### Parents
- `GET /parents/dashboard` - Parent dashboard
- `GET /parents/students` - Children list
- `GET /parents/payment/:registrationId` - Payment page
- `POST /parents/payment/:registrationId/complete` - Complete payment

### Admin
- `GET /admin/dashboard` - Admin dashboard
- `GET /admin/users` - User management
- `GET /admin/parent-requests` - Parent approval queue
- `POST /admin/parent-requests/:id/approve` - Approve parent

## 🧪 Testing

### Running Tests
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:auth
npm run test:payments
npm run test:notifications
```

### Test Coverage
- Authentication and authorization
- Payment processing
- Notification system
- Database operations
- API endpoints

## 🚀 Deployment

### Production Setup
1. Set up PostgreSQL database
2. Configure environment variables
3. Set up SSL certificates
4. Configure reverse proxy (nginx)
5. Set up process manager (PM2)

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d
```

### Environment Variables for Production
```env
NODE_ENV=production
APP_URL=https://your-domain.com
SESSION_SECRET=strong_production_secret
DB_SSL=true
```

## 🔒 Security Features

- **Password Security**: bcrypt hashing with salt rounds
- **Session Management**: Secure session handling with expiration
- **CSRF Protection**: Cross-site request forgery protection
- **Input Validation**: Comprehensive input sanitization
- **Rate Limiting**: API rate limiting to prevent abuse
- **SQL Injection Prevention**: Parameterized queries
- **XSS Protection**: Output encoding and CSP headers

## 📈 Performance Optimization

- **Database Indexing**: Optimized database queries
- **Caching**: Session and query caching
- **Compression**: Gzip compression for responses
- **CDN**: Static asset delivery via CDN
- **Lazy Loading**: Image and content lazy loading
- **Minification**: CSS and JS minification

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- 📧 Email: support@schoolevents.com
- 📱 Phone: +1 (555) 123-4567
- 💬 GitHub Issues: [Open an issue](https://github.com/your-username/school-events/issues)

## 🙏 Acknowledgments

- Bootstrap team for the excellent CSS framework
- Stripe for secure payment processing
- PostgreSQL community for the robust database
- All contributors and testers

---

**Built with ❤️ for better school management**