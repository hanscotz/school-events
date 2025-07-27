# 🎓 School Events Management System

A comprehensive web application for managing school events where parents can view, register, and track their children's participation in various school activities. Built with Express.js, EJS, PostgreSQL, and Bootstrap.

## ✨ Features

### For Parents
- **User Authentication**: Secure login and registration system
- **Student Management**: Add and manage multiple children
- **Event Browsing**: View all upcoming school events with details
- **Event Registration**: Easy registration for events with payment tracking
- **Email Notifications**: Real-time email notifications for:
  - Event registration confirmations
  - Event reminders
  - New event announcements
- **Dashboard**: Overview of upcoming events, registrations, and statistics
- **Profile Management**: Update personal information and change passwords

### For Administrators
- **Event Management**: Create, edit, and delete school events
- **User Management**: Manage parent accounts and student profiles
- **Registration Tracking**: Monitor event registrations and payments
- **Financial Reports**: Generate revenue and participation reports
- **Bulk Notifications**: Send announcements to all parents
- **System Analytics**: View comprehensive system statistics

### Technical Features
- **Responsive Design**: Mobile-friendly interface with Bootstrap 5
- **Modern UI**: Purple color scheme with smooth animations
- **Real-time Updates**: Live notification system
- **Email Integration**: Nodemailer for automated email notifications
- **Database Management**: PostgreSQL with proper relationships
- **Security**: Password hashing, session management, and input validation

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd school-events
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp config.env.example config.env
   ```
   
   Edit `config.env` with your configuration:
   ```env
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=school_events
   DB_USER=postgres
   DB_PASSWORD=your_password

   # Email Configuration (Gmail)
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password

   # Server Configuration
   PORT=3000
   SESSION_SECRET=your_session_secret_key

   # Application Settings
   APP_NAME=School Events
   APP_URL=http://localhost:3000
   ```

4. **Set up the database**
   ```bash
   # Create PostgreSQL database
   createdb school_events
   
   # Initialize database tables and sample data
   npm run init-db
   ```

5. **Start the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

6. **Access the application**
   - Open your browser and go to `http://localhost:3000`
   - Default admin credentials:
     - Email: `admin@school.com`
     - Password: `admin123`

## 📧 Email Setup

To enable email notifications, you need to configure Gmail:

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password**:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
3. **Update config.env** with your Gmail credentials

## 🗄️ Database Schema

The application uses the following main tables:

- **users**: Parent and admin accounts
- **students**: Student information linked to parents
- **events**: School events with details
- **event_registrations**: Event participation records
- **notifications**: In-app notification system
- **email_logs**: Email delivery tracking

## 🎨 Customization

### Colors
The application uses a purple color scheme defined in `public/css/style.css`:
```css
:root {
    --primary-purple: #6f42c1;
    --secondary-purple: #8e44ad;
    --light-purple: #e9d5ff;
    --dark-purple: #4c1d95;
}
```

### Styling
- Modify `public/css/style.css` for custom styling
- Update Bootstrap classes in EJS templates
- Customize animations in the CSS file

## 📱 Usage Guide

### For Parents

1. **Registration**
   - Click "Register" on the homepage
   - Fill in your details and create an account
   - Add your children's information

2. **Adding Students**
   - Go to Parent Dashboard
   - Click "Add Student"
   - Enter student details (name, grade, section)

3. **Event Registration**
   - Browse events on the Events page
   - Click on an event to view details
   - Select your child and click "Register"
   - Receive email confirmation

4. **Managing Registrations**
   - View all registrations in Parent Dashboard
   - Cancel registrations if needed
   - Track payment status

### For Administrators

1. **Creating Events**
   - Go to Admin Dashboard
   - Click "Create Event"
   - Fill in event details (title, description, dates, location, fee)
   - Save and notify all parents

2. **Managing Users**
   - Access "Manage Users" from admin menu
   - Add new parent accounts
   - Edit user information
   - Monitor user activity

3. **Generating Reports**
   - View event participation reports
   - Generate financial reports
   - Export data to CSV

## 🔧 API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `GET /auth/logout` - User logout

### Events
- `GET /events` - List all events
- `GET /events/:id` - Get event details
- `POST /events/:id/register` - Register for event
- `POST /events/:id/cancel` - Cancel registration

### Admin
- `GET /admin/dashboard` - Admin dashboard
- `GET /admin/users` - Manage users
- `GET /admin/reports/events` - Event reports
- `GET /admin/reports/financial` - Financial reports

## 🛠️ Development

### Project Structure
```
school-events/
├── database/
│   ├── connection.js
│   └── init.js
├── public/
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── main.js
├── routes/
│   ├── auth.js
│   ├── events.js
│   ├── parents.js
│   └── admin.js
├── services/
│   └── emailService.js
├── views/
│   ├── layout.ejs
│   ├── index.ejs
│   ├── auth/
│   ├── events/
│   ├── parents/
│   └── admin/
├── server.js
├── package.json
└── README.md
```

### Adding New Features

1. **New Routes**: Add to appropriate route file in `routes/`
2. **New Views**: Create EJS templates in `views/`
3. **Database Changes**: Update `database/init.js`
4. **Styling**: Modify `public/css/style.css`

### Testing
```bash
# Run database tests
npm test

# Check for linting issues
npm run lint
```

## 🚀 Deployment

### Production Setup

1. **Environment Variables**
   - Set `NODE_ENV=production`
   - Configure production database
   - Set up production email service

2. **Database**
   - Use production PostgreSQL instance
   - Set up proper backups
   - Configure connection pooling

3. **Server**
   - Use PM2 or similar process manager
   - Set up reverse proxy (Nginx)
   - Configure SSL certificates

### Docker Deployment
```bash
# Build Docker image
docker build -t school-events .

# Run container
docker run -p 3000:3000 school-events
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

## 🔄 Updates

### Version 1.0.0
- Initial release
- Basic event management
- Parent registration system
- Email notifications
- Admin dashboard

### Planned Features
- Mobile app integration
- Advanced reporting
- Payment gateway integration
- Multi-language support
- API for third-party integrations

---

**Built with ❤️ for better school-parent communication** 