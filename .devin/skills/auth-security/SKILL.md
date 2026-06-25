---
name: auth-security
description: Authentication security best practices for Next.js with bcryptjs, session management, and secure password handling
triggers: ["user", "model"]
argument-hint: [auth-feature]
---

You are an expert in authentication security. Follow these security best practices for all authentication-related code in this project.

## Password Hashing with bcryptjs

### Proper Password Hashing
Always use bcryptjs with proper cost factor:

```typescript
import bcrypt from "bcryptjs";

// Hash password with cost factor of 10 (minimum recommended)
const passwordHash = await bcrypt.hash(password, 10);

// Verify password
const isValid = await bcrypt.compare(password, user.passwordHash);
```

### Password Requirements
Enforce strong password requirements:

```typescript
import { z } from "zod";

const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: passwordSchema,
  name: z.string().min(2, "Name must be at least 2 characters"),
});
```

## Session/JWT Token Management

### JWT Token Implementation
Replace the TODO in login route with proper JWT management:

```typescript
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = "7d";

function generateToken(userId: string, email: string, role: string): string {
  return jwt.sign(
    { userId, email, role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function verifyToken(token: string): { userId: string; email: string; role: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; email: string; role: string };
  } catch (error) {
    return null;
  }
}

// In login route
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;
    
    // Validate credentials
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }
    
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }
    
    // Generate JWT token
    const token = generateToken(user.id, user.email, user.role);
    
    // Set HTTP-only cookie
    const cookieStore = await cookies();
    cookieStore.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });
    
    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

### Token Verification Middleware
Create middleware to protect routes:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function authenticateRequest(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value;
  
  if (!token) {
    return null;
  }
  
  const payload = verifyToken(token);
  return payload;
}

export async function requireAuth(request: NextRequest) {
  const user = await authenticateRequest(request);
  
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }
  
  return user;
}
```

## Input Validation and Sanitization

### Email Validation
Always validate and sanitize email inputs:

```typescript
import { z } from "zod";

const emailSchema = z.string()
  .email("Invalid email address")
  .toLowerCase()
  .trim()
  .max(254, "Email is too long");

// Usage
const validatedEmail = emailSchema.parse(inputEmail);
```

### Name Validation
Sanitize user names to prevent XSS:

```typescript
const nameSchema = z.string()
  .min(2, "Name must be at least 2 characters")
  .max(100, "Name is too long")
  .trim()
  .regex(/^[a-zA-Z\s'-]+$/, "Name can only contain letters, spaces, hyphens, and apostrophes");
```

### SQL Injection Prevention with Prisma
Prisma automatically prevents SQL injection when used correctly:

```typescript
// Good - parameterized queries
const user = await prisma.user.findUnique({
  where: { email: validatedEmail }
});

// Good - using Prisma's query builder
const users = await prisma.user.findMany({
  where: {
    name: { contains: searchName, mode: "insensitive" }
  }
});

// Bad - never use raw SQL with user input
const result = await prisma.$queryRawUnsafe(
  `SELECT * FROM User WHERE email = '${userInput}'`
);
```

## Environment Variable Security

### Secret Management
Never commit secrets to the repository. Use environment variables:

```typescript
// .env.example
DATABASE_URL="postgresql://user:password@localhost:5432/tutor_bank"
JWT_SECRET="generate-with-openssl-rand-base64-32"
NODE_ENV="development"

// Generate JWT secret with:
// openssl rand -base64 32
```

### Environment Variable Validation
Validate environment variables at startup:

```typescript
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  NODE_ENV: z.enum(["development", "production", "test"]),
});

const env = envSchema.parse(process.env);

export { env };
```

## Rate Limiting for Auth Endpoints

### Implement Rate Limiting
Prevent brute force attacks on authentication endpoints:

```typescript
const authRateLimit = new Map<string, { count: number; resetTime: number }>();

function checkAuthRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = authRateLimit.get(identifier);
  const limit = 5; // 5 attempts
  const window = 15 * 60 * 1000; // 15 minutes
  
  if (!record || now > record.resetTime) {
    authRateLimit.set(identifier, { count: 1, resetTime: now + window });
    return true;
  }
  
  if (record.count >= limit) {
    return false;
  }
  
  record.count++;
  return true;
}

// Usage in login route
export async function POST(request: Request) {
  const body = await request.json();
  const { email } = body;
  
  if (!checkAuthRateLimit(email)) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      { status: 429 }
    );
  }
  
  // Continue with login logic
}
```

## Secure Password Reset Flow

### Password Reset Implementation
Implement secure password reset with tokens:

```typescript
import crypto from "crypto";

function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function generateResetExpiry(): Date {
  return new Date(Date.now() + 3600000); // 1 hour from now
}

// Store reset token in database
// Add to User model: resetToken string?, resetTokenExpiry DateTime?

async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  
  if (!user) {
    // Don't reveal whether user exists
    return;
  }
  
  const resetToken = generateResetToken();
  const resetTokenExpiry = generateResetExpiry();
  
  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken, resetTokenExpiry }
  });
  
  // Send email with reset link
  // Reset link: /reset-password?token=resetToken
}

async function resetPassword(token: string, newPassword: string) {
  const user = await prisma.user.findFirst({
    where: {
      resetToken: token,
      resetTokenExpiry: { gte: new Date() }
    }
  });
  
  if (!user) {
    throw new Error("Invalid or expired reset token");
  }
  
  const passwordHash = await bcrypt.hash(newPassword, 10);
  
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      resetToken: null,
      resetTokenExpiry: null
    }
  });
}
```

## Security Headers

### Add Security Headers
Add security headers to all responses:

```typescript
import { NextResponse } from "next/server";

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  
  return response;
}

// Usage in route handlers
export async function POST(request: Request) {
  const response = NextResponse.json({ success: true });
  return addSecurityHeaders(response);
}
```

## Error Message Security

### Don't Expose Sensitive Information
Never reveal sensitive information in error messages:

```typescript
// Bad - reveals whether user exists
if (!user) {
  return NextResponse.json(
    { error: "User with this email does not exist" },
    { status: 401 }
  );
}

// Good - generic message
if (!user) {
  return NextResponse.json(
    { error: "Invalid credentials" },
    { status: 401 }
  );
}
```

## HTTPS and Secure Cookies

### Force HTTPS in Production
Ensure cookies are only sent over HTTPS in production:

```typescript
cookieStore.set("auth-token", token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production", // Only send over HTTPS
  sameSite: "lax",
  maxAge: 60 * 60 * 24 * 7,
  path: "/",
});
```

## Project-Specific Security Issues

### Current Issues to Address
1. Replace TODO comment in login route with proper JWT session management
2. Add password strength requirements to registration
3. Implement rate limiting for login endpoint
4. Add proper environment variable validation
5. Implement secure password reset flow
6. Add security headers to all responses
7. Sanitize all user inputs
8. Implement proper error messages that don't expose sensitive information

### Prisma Security Considerations
- Always use parameterized queries (Prisma handles this automatically)
- Validate all inputs before database operations
- Use transactions for multi-step operations
- Implement proper row-level security checks

## Security Checklist

- [ ] Password hashing with bcryptjs (cost factor ≥ 10)
- [ ] Strong password requirements (8+ chars, mixed case, numbers, special chars)
- [ ] JWT token implementation with secure secret
- [ ] HTTP-only, secure cookies for session management
- [ ] Input validation with Zod schemas
- [ ] Output sanitization to prevent XSS
- [ ] SQL injection prevention (Prisma handles this)
- [ ] Rate limiting on auth endpoints
- [ ] Environment variable validation
- [ ] Security headers on all responses
- [ ] Generic error messages (don't reveal user existence)
- [ ] HTTPS-only cookies in production
- [ ] Secure password reset flow
- [ ] Regular security audits
- [ ] Keep dependencies updated