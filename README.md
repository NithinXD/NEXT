# Spa Booking Application

A Next.js application for booking spa appointments, similar to genik.io. This application allows users to browse services, book appointments, view their booking history, and manage their profile.

## Features

- User authentication with Supabase
- Service browsing and filtering
- Appointment booking system
- User dashboard with booking history
- Profile management
- Responsive design

## Tech Stack

- Next.js 14
- React 18
- Tailwind CSS
- Supabase (Authentication and Database)
- PostgreSQL

## Prerequisites

- Node.js 18+ and npm
- Supabase account and project

## Getting Started

1. Clone the repository:
```bash
git clone <repository-url>
cd spa-booking-app
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
   - The application uses Supabase for authentication and database.
   - The Supabase URL and anon key are already configured in `next.config.js`.

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Database Schema

The application uses the following tables in Supabase:

1. **profiles** - User profiles
   - id (UUID, references auth.users.id)
   - full_name (text)
   - phone (text)
   - address (text)
   - created_at (timestamp)
   - updated_at (timestamp)

2. **Services** - Spa services
   - id (UUID)
   - name (text)
   - description (text)
   - price (numeric)
   - duration (integer, minutes)
   - category (text)
   - image_url (text, optional)
   - created_at (timestamp)

3. **Bookings** - Appointment bookings
   - id (UUID)
   - user_id (UUID, references auth.users.id)
   - service_id (UUID, references Services.id)
   - booking_time (timestamp)
   - status (text: 'confirmed', 'cancelled', 'completed')
   - created_at (timestamp)
   - updated_at (timestamp)

4. **ContactMessages** - Contact form submissions
   - id (UUID)
   - name (text)
   - email (text)
   - phone (text, optional)
   - message (text)
   - created_at (timestamp)

## Deployment

This application can be deployed to Vercel:

1. Push your code to a GitHub repository
2. Import the project in Vercel
3. Configure environment variables
4. Deploy

## License

This project is licensed under the MIT License.