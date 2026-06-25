# Tutor-Bank Agent Guide

## Tech Stack
- **Next.js 16.2** - App Router with Web Request/Response APIs
- **React 19** - Latest React with Server Components
- **Prisma 7** - PostgreSQL ORM with custom client generation
- **NextAuth.js 4** - Authentication with JWT sessions
- **TypeScript 5** - Full type safety
- **Jest** - Testing with jsdom environment
- **Tailwind CSS 4** - Styling

## Architecture

### Directory Structure
```
src/
├── app/              # Next.js App Router
│   ├── api/         # API routes (auth, bookings, tutors, etc.)
│   ├── dashboard/   # Protected dashboard pages
│   ├── login/       # Login page
│   └── register/    # Registration page
├── __tests__/       # Test files (api, components, integration)
├── lib/            # Core utilities (auth, prisma, session)
├── generated/      # Prisma client (auto-generated)
└── middleware.ts   # NextAuth route protection
```

### Key Patterns
- **Route Handlers**: Use Web Request/Response APIs, not Express-style
- **Authentication**: NextAuth.js with JWT strategy, bcryptjs for passwords
- **Database**: Prisma with PostgreSQL adapter, custom client location
- **Session Management**: Server-side via NextAuth, no localStorage
- **Route Protection**: Middleware pattern for protected routes

### Database Schema
- **Users**: Tutors and Students with roles
- **Bookings**: Student-Tutor sessions with status tracking
- **TimeSlots**: Tutor availability with booking references
- **Subjects**: Tutor-subject relationships
- **Notifications**: User notifications with read status
- **NextAuth Models**: Account, Session, VerificationToken

## Development Commands
- `npm run dev` - Start development server
- `npm run build` - Production build
- `npm run lint` - ESLint
- `npm test` - Run tests
- `npm run test:coverage` - Coverage report
- `npm run test:ci` - CI tests with coverage

## Testing
- **Framework**: Jest with jsdom environment
- **Coverage Target**: 85%+ overall, 90%+ for API routes
- **Test Locations**: `src/__tests__/api/`, `src/__tests__/components/`
- **Mocks**: Prisma mocked globally in `jest.setup.js`
- **Requirements**: All new API routes need tests in corresponding directories

## Custom Skills (Auto-loaded)
- `route-handlers` - Next.js 16 API patterns, validation, error handling
- `auth-security` - bcryptjs, JWT, input validation, security best practices
- `testing` - Jest/Vitest patterns, route handler testing, mocking
- `migration-safety` - Prisma migration safety, rollback procedures

## Critical Constraints
- **No localStorage** - Use NextAuth session hooks
- **Transaction Safety** - Use Prisma transactions for multi-step operations
- **Input Validation** - Validate all inputs (use Zod when available)
- **Error Handling** - Structured error responses with proper status codes
- **Security Headers** - Add security headers to API responses
- **Role-based Access** - Validate user roles in protected routes

## Important Files
- `src/lib/auth.ts` - NextAuth configuration
- `src/lib/prisma.ts` - Prisma client singleton
- `src/middleware.ts` - Route protection configuration
- `prisma/schema.prisma` - Database schema
- `jest.config.js` - Test configuration
- `jest.setup.js` - Test setup and mocks

## Environment Variables
Required (see `.env.example`):
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - NextAuth secret key
- `NEXTAUTH_URL` - Application URL
