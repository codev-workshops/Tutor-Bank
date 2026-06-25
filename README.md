# Tutor Bank

A platform where tutors can register, set their subjects and hourly rates, manage availability time slots, and students can search, browse, and book tutoring sessions.

## Tech Stack

- **Framework**: Next.js 16.2 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Styling**: Tailwind CSS

## Features

- **Tutor Registration**: Tutors can sign up, set subjects they teach, hourly rate, and bio
- **Time Slot Management**: Tutors select dates and specify available hours (from-to)
- **Search Tutors**: Students can search tutors by name or subject
- **Booking System**: Students can book available time slots
- **Notifications**: Tutors receive booking notifications and can confirm/reject
- **Status Tracking**: Full booking lifecycle (Pending → Confirmed/Rejected/Cancelled)

## Getting Started

### Prerequisites

- Node.js 20.9+
- PostgreSQL database

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/codev-workshops/Tutor-Bank.git
   cd Tutor-Bank
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your PostgreSQL connection string
   ```

4. Run database migrations:
   ```bash
   npx prisma migrate dev
   ```

5. Generate Prisma client:
   ```bash
   npx prisma generate
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000)

## API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register a new user (tutor/student) |
| POST | `/api/auth/login` | Login |
| GET | `/api/tutors` | List/search tutors (query: `name`, `subject`) |
| GET | `/api/tutors/[id]` | Get tutor details with available slots |
| PUT | `/api/tutors/[id]` | Update tutor profile (bio, hourlyRate, subjects) |
| GET | `/api/tutors/[id]/slots` | Get tutor's time slots |
| POST | `/api/tutors/[id]/slots` | Add a time slot |
| GET | `/api/subjects` | List all subjects |
| POST | `/api/subjects` | Create a subject |
| POST | `/api/bookings` | Create a booking |
| GET | `/api/bookings` | Get bookings for a user |
| PATCH | `/api/bookings/[id]` | Update booking status (confirm/reject/cancel) |
| GET | `/api/notifications` | Get notifications for a user |
| PATCH | `/api/notifications` | Mark notification as read |

## Database Schema

- **User** - Stores both tutors and students (differentiated by role)
- **Subject** - Available tutoring subjects
- **TutorSubject** - Many-to-many relation between tutors and subjects
- **TimeSlot** - Tutor availability windows (date + start/end time)
- **Booking** - Links student, tutor, and time slot with status tracking
- **Notification** - In-app notifications for booking events

## TODO

- [ ] Implement proper authentication (JWT/session-based)
- [ ] Add input validation (zod)
- [ ] Add proper error handling middleware
- [ ] Implement real-time notifications (WebSocket/SSE)
- [ ] Add tutor rating/review system
- [ ] Add payment integration
- [ ] Add email notifications
