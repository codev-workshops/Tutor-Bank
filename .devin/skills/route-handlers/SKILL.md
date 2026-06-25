---
name: route-handlers
description: Next.js 16 route handler best practices with Web Request/Response APIs, input validation, error handling, and TypeScript patterns
triggers: ["user", "model"]
argument-hint: [route-path]
---

You are an expert in Next.js 16 route handlers. Follow these best practices when working with API routes in this project.

## Next.js 16 Route Handler Patterns

### Web Request/Response APIs
Next.js 16 uses standard Web Request/Response APIs, not Express-style req/res objects:

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const param = searchParams.get("param");
  
  return NextResponse.json({ data: param });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  
  return NextResponse.json({ success: true }, { status: 201 });
}
```

### Route Parameters
For dynamic routes like `/api/tutors/[id]`, use the RouteContext pattern:

```typescript
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/tutors/[id]">
) {
  const { id } = await ctx.params;
  // Use id parameter
}
```

## Input Validation with Zod

Always validate input using Zod schemas:

```typescript
import { z } from "zod";

const bookingSchema = z.object({
  studentId: z.string().cuid(),
  tutorId: z.string().cuid(),
  slotId: z.string().cuid(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = bookingSchema.parse(body);
    // Use validatedData
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
  }
}
```

## Error Handling

### Custom Error Classes
Create custom error classes for better error management:

```typescript
class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

class ValidationError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(400, message, details);
    this.name = "ValidationError";
  }
}

class NotFoundError extends ApiError {
  constructor(resource: string) {
    super(404, `${resource} not found`);
    this.name = "NotFoundError";
  }
}
```

### Structured Error Responses
Always return structured error responses:

```typescript
export async function GET(request: NextRequest) {
  try {
    // Route logic
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.statusCode }
      );
    }
    
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

## TypeScript Typing

### Request/Response Types
Define proper types for your route handlers:

```typescript
interface BookingRequestBody {
  studentId: string;
  tutorId: string;
  slotId: string;
}

interface BookingResponse {
  id: string;
  studentId: string;
  tutorId: string;
  slotId: string;
  status: string;
  createdAt: Date;
}

export async function POST(request: NextRequest): Promise<NextResponse<BookingResponse>> {
  const body: BookingRequestBody = await request.json();
  // ...
}
```

## Database Transaction Safety

For multi-step operations, always use transactions:

```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, tutorId, slotId } = body;
    
    const booking = await prisma.$transaction(async (tx) => {
      // Check slot availability
      const slot = await tx.timeSlot.findUnique({ where: { id: slotId } });
      if (!slot || slot.isBooked) {
        throw new ValidationError("Slot is not available");
      }
      
      // Create booking
      const booking = await tx.booking.create({
        data: { studentId, tutorId, slotId }
      });
      
      // Update slot
      await tx.timeSlot.update({
        where: { id: slotId },
        data: { isBooked: true }
      });
      
      // Create notification
      await tx.notification.create({
        data: {
          userId: tutorId,
          message: `New booking request for slot on ${slot.date.toLocaleDateString()}`
        }
      });
      
      return booking;
    });
    
    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    // Error handling
  }
}
```

## Security Headers

Add security headers to responses:

```typescript
export async function GET(request: NextRequest) {
  const response = NextResponse.json({ data: "..." });
  
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  
  return response;
}
```

## CORS Configuration

For cross-origin requests, configure CORS properly:

```typescript
const allowedOrigins = [
  process.env.ALLOWED_ORIGIN || "http://localhost:3000"
];

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  
  if (origin && allowedOrigins.includes(origin)) {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }
  
  return new NextResponse(null, { status: 204 });
}

// Add CORS headers to other responses
export async function GET(request: NextRequest) {
  const response = NextResponse.json({ data: "..." });
  const origin = request.headers.get("origin");
  
  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
  }
  
  return response;
}
```

## Logging

Replace console.error with proper logging:

```typescript
// Create a logger utility
function logger(level: "info" | "warn" | "error", message: string, meta?: unknown) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  
  if (level === "error") {
    console.error(logMessage, meta || "");
  } else {
    console.log(logMessage, meta || "");
  }
}

// Usage in route handlers
export async function GET(request: NextRequest) {
  try {
    logger("info", "Fetching bookings", { userId: "..." });
    // ...
  } catch (error) {
    logger("error", "Error fetching bookings", error);
    // ...
  }
}
```

## Rate Limiting

Implement rate limiting for sensitive endpoints:

```typescript
// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(identifier: string, limit: number = 10, window: number = 60000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + window });
    return true;
  }
  
  if (record.count >= limit) {
    return false;
  }
  
  record.count++;
  return true;
}

// Usage in auth routes
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  
  if (!checkRateLimit(ip, 5, 60000)) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    );
  }
  
  // Continue with authentication
}
```

## Project-Specific Patterns

### Current Project Issues to Address
- Replace TODO comment in login route with proper session management
- Add Zod validation to all route handlers
- Implement proper error handling with custom error classes
- Add transaction safety to booking creation
- Replace console.error with proper logging
- Add security headers to responses
- Implement rate limiting for auth endpoints

### Prisma Client Usage
Always use the singleton prisma client from `@/lib/prisma`:

```typescript
import { prisma } from "@/lib/prisma";

// Good
const user = await prisma.user.findUnique({ where: { email } });

// Bad - don't create new instances
const client = new PrismaClient();
```

## Checklist for New Route Handlers

- [ ] Use NextRequest/NextResponse from "next/server"
- [ ] Implement proper TypeScript types
- [ ] Add Zod validation for request body
- [ ] Use custom error classes for error handling
- [ ] Implement transaction safety for multi-step operations
- [ ] Add proper logging (not console.error)
- [ ] Include security headers
- [ ] Add CORS configuration if needed
- [ ] Implement rate limiting for sensitive endpoints
- [ ] Return structured error responses
- [ ] Handle edge cases (null checks, empty results)
- [ ] Add proper HTTP status codes
- [ ] Include proper error messages without exposing sensitive data