---
name: testing
description: Testing patterns for Next.js route handlers, Prisma database operations, and authentication flows with Jest/Vitest
triggers: ["user", "model"]
argument-hint: [test-type]
---

You are an expert in testing Next.js applications with Prisma. Follow these testing patterns and best practices.

## Test Setup

### Vitest Configuration
Set up Vitest for testing Next.js route handlers:

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "src/test/"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

### Test Database Setup
Configure a separate test database:

```typescript
// src/test/setup.ts
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || "postgresql://test:test@localhost:5432/tutor_bank_test",
    },
  },
});

beforeAll(async () => {
  // Run migrations
  await prisma.$executeRawUnsafe("DROP SCHEMA IF EXISTS public CASCADE");
  await prisma.$executeRawUnsafe("CREATE SCHEMA public");
  await prisma.$executeRawUnsafe("GRANT ALL ON SCHEMA public TO test");
  await prisma.$executeRawUnsafe("GRANT ALL ON ALL TABLES IN SCHEMA public TO test");
});

afterEach(async () => {
  // Clean up database after each test
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname='public'
  `;
  
  for (const { tablename } of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "public"."${tablename}" CASCADE`);
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

## Route Handler Testing

### Testing GET Requests
Test GET endpoints with proper assertions:

```typescript
// src/test/api/tutors.test.ts
import { POST } from "@/app/api/tutors/route";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

describe("GET /api/tutors", () => {
  beforeEach(async () => {
    // Setup test data
    await prisma.user.create({
      data: {
        id: "tutor-1",
        email: "tutor@example.com",
        name: "Test Tutor",
        passwordHash: await bcrypt.hash("password", 10),
        role: "TUTOR",
        bio: "Test bio",
        hourlyRate: 50,
      },
    });
  });

  it("should return list of tutors", async () => {
    const request = new NextRequest("http://localhost:3000/api/tutors?subject=Math");
    const response = await GET(request);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data[0]).toHaveProperty("id");
    expect(data[0]).toHaveProperty("name");
    expect(data[0]).toHaveProperty("email");
  });

  it("should filter tutors by subject", async () => {
    const request = new NextRequest("http://localhost:3000/api/tutors?subject=Math");
    const response = await GET(request);
    const data = await response.json();
    
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].subjects).toBeDefined();
  });

  it("should handle errors gracefully", async () => {
    // Mock database error
    jest.spyOn(prisma.user, "findMany").mockRejectedValue(new Error("Database error"));
    
    const request = new NextRequest("http://localhost:3000/api/tutors");
    const response = await GET(request);
    const data = await response.json();
    
    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });
});
```

### Testing POST Requests
Test POST endpoints with validation:

```typescript
// src/test/api/auth/register.test.ts
import { POST } from "@/app/api/auth/register/route";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

describe("POST /api/auth/register", () => {
  it("should register a new user successfully", async () => {
    const requestBody = {
      email: "newuser@example.com",
      name: "New User",
      password: "SecurePass123!",
      role: "STUDENT",
    };
    
    const request = new NextRequest("http://localhost:3000/api/auth/register", {
      method: "POST",
      body: JSON.stringify(requestBody),
    });
    
    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(201);
    expect(data).toHaveProperty("id");
    expect(data).toHaveProperty("email");
    expect(data.email).toBe(requestBody.email);
    expect(data).not.toHaveProperty("passwordHash");
  });

  it("should reject duplicate email", async () => {
    // Create existing user
    await prisma.user.create({
      data: {
        id: "existing-1",
        email: "existing@example.com",
        name: "Existing User",
        passwordHash: await bcrypt.hash("password", 10),
        role: "STUDENT",
      },
    });
    
    const requestBody = {
      email: "existing@example.com",
      name: "Another User",
      password: "SecurePass123!",
    };
    
    const request = new NextRequest("http://localhost:3000/api/auth/register", {
      method: "POST",
      body: JSON.stringify(requestBody),
    });
    
    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(409);
    expect(data.error).toBe("User already exists");
  });

  it("should validate required fields", async () => {
    const requestBody = {
      email: "test@example.com",
      // Missing name and password
    };
    
    const request = new NextRequest("http://localhost:3000/api/auth/register", {
      method: "POST",
      body: JSON.stringify(requestBody),
    });
    
    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing required fields");
  });

  it("should hash password securely", async () => {
    const requestBody = {
      email: "secure@example.com",
      name: "Secure User",
      password: "SecurePass123!",
    };
    
    const request = new NextRequest("http://localhost:3000/api/auth/register", {
      method: "POST",
      body: JSON.stringify(requestBody),
    });
    
    await POST(request);
    
    const user = await prisma.user.findUnique({
      where: { email: requestBody.email },
    });
    
    expect(user).toBeDefined();
    expect(user?.passwordHash).not.toBe(requestBody.password);
    expect(user?.passwordHash.length).toBeGreaterThan(50); // bcrypt hash length
  });
});
```

### Testing Dynamic Routes
Test dynamic route parameters:

```typescript
// src/test/api/tutors/[id].test.ts
import { GET } from "@/app/api/tutors/[id]/route";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

describe("GET /api/tutors/[id]", () => {
  it("should return tutor by ID", async () => {
    const tutor = await prisma.user.create({
      data: {
        id: "tutor-test-1",
        email: "tutor@example.com",
        name: "Test Tutor",
        passwordHash: await bcrypt.hash("password", 10),
        role: "TUTOR",
        bio: "Test bio",
        hourlyRate: 50,
      },
    });
    
    const request = new NextRequest(`http://localhost:3000/api/tutors/${tutor.id}`);
    const response = await GET(request, { params: Promise.resolve({ id: tutor.id }) });
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.id).toBe(tutor.id);
    expect(data.name).toBe(tutor.name);
  });

  it("should return 404 for non-existent tutor", async () => {
    const request = new NextRequest("http://localhost:3000/api/tutors/non-existent");
    const response = await GET(request, { params: Promise.resolve({ id: "non-existent" }) });
    const data = await response.json();
    
    expect(response.status).toBe(404);
    expect(data.error).toBe("Tutor not found");
  });
});
```

## Authentication Flow Testing

### Testing Login Flow
Test authentication endpoints:

```typescript
// src/test/api/auth/login.test.ts
import { POST } from "@/app/api/auth/login/route";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await prisma.user.create({
      data: {
        id: "user-1",
        email: "test@example.com",
        name: "Test User",
        passwordHash: await bcrypt.hash("correctPassword", 10),
        role: "STUDENT",
      },
    });
  });

  it("should login with correct credentials", async () => {
    const requestBody = {
      email: "test@example.com",
      password: "correctPassword",
    };
    
    const request = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: JSON.stringify(requestBody),
    });
    
    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data).toHaveProperty("id");
    expect(data).toHaveProperty("email");
    expect(data).toHaveProperty("role");
    expect(data).not.toHaveProperty("passwordHash");
  });

  it("should reject incorrect password", async () => {
    const requestBody = {
      email: "test@example.com",
      password: "wrongPassword",
    };
    
    const request = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: JSON.stringify(requestBody),
    });
    
    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(401);
    expect(data.error).toBe("Invalid credentials");
  });

  it("should reject non-existent user", async () => {
    const requestBody = {
      email: "nonexistent@example.com",
      password: "password",
    };
    
    const request = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: JSON.stringify(requestBody),
    });
    
    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(401);
    expect(data.error).toBe("Invalid credentials");
  });
});
```

## Database Operation Testing

### Testing Prisma Operations
Test database operations in isolation:

```typescript
// src/test/lib/prisma.test.ts
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

describe("Prisma Operations", () => {
  describe("User creation and retrieval", () => {
    it("should create user with hashed password", async () => {
      const passwordHash = await bcrypt.hash("password123", 10);
      
      const user = await prisma.user.create({
        data: {
          id: "user-test-1",
          email: "test@example.com",
          name: "Test User",
          passwordHash,
          role: "STUDENT",
        },
      });
      
      expect(user.id).toBeDefined();
      expect(user.email).toBe("test@example.com");
      expect(user.passwordHash).toBe(passwordHash);
    });

    it("should find user by email", async () => {
      const createdUser = await prisma.user.create({
        data: {
          id: "user-test-2",
          email: "findme@example.com",
          name: "Find Me",
          passwordHash: await bcrypt.hash("password", 10),
          role: "STUDENT",
        },
      });
      
      const foundUser = await prisma.user.findUnique({
        where: { email: "findme@example.com" },
      });
      
      expect(foundUser).toBeDefined();
      expect(foundUser?.id).toBe(createdUser.id);
    });

    it("should handle unique constraint violations", async () => {
      await prisma.user.create({
        data: {
          id: "user-test-3",
          email: "unique@example.com",
          name: "Unique User",
          passwordHash: await bcrypt.hash("password", 10),
          role: "STUDENT",
        },
      });
      
      await expect(
        prisma.user.create({
          data: {
            id: "user-test-4",
            email: "unique@example.com", // Duplicate email
            name: "Another User",
            passwordHash: await bcrypt.hash("password", 10),
            role: "STUDENT",
          },
        })
      ).rejects.toThrow();
    });
  });

  describe("Booking operations", () => {
    it("should create booking with transaction", async () => {
      const student = await prisma.user.create({
        data: {
          id: "student-1",
          email: "student@example.com",
          name: "Student",
          passwordHash: await bcrypt.hash("password", 10),
          role: "STUDENT",
        },
      });
      
      const tutor = await prisma.user.create({
        data: {
          id: "tutor-1",
          email: "tutor@example.com",
          name: "Tutor",
          passwordHash: await bcrypt.hash("password", 10),
          role: "TUTOR",
        },
      });
      
      const slot = await prisma.timeSlot.create({
        data: {
          id: "slot-1",
          tutorId: tutor.id,
          date: new Date("2024-12-25"),
          startTime: new Date("2024-12-25T10:00:00"),
          endTime: new Date("2024-12-25T11:00:00"),
          isBooked: false,
        },
      });
      
      const booking = await prisma.$transaction(async (tx) => {
        const createdBooking = await tx.booking.create({
          data: {
            studentId: student.id,
            tutorId: tutor.id,
            slotId: slot.id,
          },
        });
        
        await tx.timeSlot.update({
          where: { id: slot.id },
          data: { isBooked: true },
        });
        
        return createdBooking;
      });
      
      expect(booking).toBeDefined();
      expect(booking.studentId).toBe(student.id);
      
      const updatedSlot = await prisma.timeSlot.findUnique({
        where: { id: slot.id },
      });
      expect(updatedSlot?.isBooked).toBe(true);
    });
  });
});
```

## Integration Testing

### Testing Multi-Step Operations
Test complete workflows:

```typescript
// src/test/integration/booking-flow.test.ts
import { POST as createBooking } from "@/app/api/bookings/route";
import { PATCH as updateBooking } from "@/app/api/bookings/[id]/route";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

describe("Booking Integration Flow", () => {
  it("should complete full booking workflow", async () => {
    // Setup: Create users and slot
    const student = await prisma.user.create({
      data: {
        id: "student-integration-1",
        email: "student@integration.com",
        name: "Integration Student",
        passwordHash: await bcrypt.hash("password", 10),
        role: "STUDENT",
      },
    });
    
    const tutor = await prisma.user.create({
      data: {
        id: "tutor-integration-1",
        email: "tutor@integration.com",
        name: "Integration Tutor",
        passwordHash: await bcrypt.hash("password", 10),
        role: "TUTOR",
      },
    });
    
    const slot = await prisma.timeSlot.create({
      data: {
        id: "slot-integration-1",
        tutorId: tutor.id,
        date: new Date("2024-12-25"),
        startTime: new Date("2024-12-25T10:00:00"),
        endTime: new Date("2024-12-25T11:00:00"),
        isBooked: false,
      },
    });
    
    // Step 1: Create booking
    const createRequest = new NextRequest("http://localhost:3000/api/bookings", {
      method: "POST",
      body: JSON.stringify({
        studentId: student.id,
        tutorId: tutor.id,
        slotId: slot.id,
      }),
    });
    
    const createResponse = await createBooking(createRequest);
    const booking = await createResponse.json();
    
    expect(createResponse.status).toBe(201);
    expect(booking.id).toBeDefined();
    
    // Verify slot is booked
    const updatedSlot = await prisma.timeSlot.findUnique({
      where: { id: slot.id },
    });
    expect(updatedSlot?.isBooked).toBe(true);
    
    // Verify notification was created
    const notification = await prisma.notification.findFirst({
      where: { userId: tutor.id },
    });
    expect(notification).toBeDefined();
    
    // Step 2: Confirm booking
    const updateRequest = new NextRequest(
      `http://localhost:3000/api/bookings/${booking.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "CONFIRMED" }),
      }
    );
    
    const updateResponse = await updateBooking(updateRequest, {
      params: Promise.resolve({ id: booking.id }),
    });
    const updatedBooking = await updateResponse.json();
    
    expect(updateResponse.status).toBe(200);
    expect(updatedBooking.status).toBe("CONFIRMED");
  });
});
```

## Mocking External Dependencies

### Mocking Prisma Client
Mock Prisma for unit tests:

```typescript
// src/test/mocks/prisma.ts
import { PrismaClient } from "@prisma/client";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    booking: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

export { prisma as mockedPrisma };
```

### Mocking Authentication
Mock authentication middleware:

```typescript
// src/test/mocks/auth.ts
import { cookies } from "next/headers";

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

export function mockAuthenticatedUser(user: { userId: string; email: string; role: string }) {
  (cookies as jest.Mock).mockReturnValue({
    get: jest.fn().mockReturnValue({ value: "valid-token" }),
  });
}

export function mockUnauthenticatedUser() {
  (cookies as jest.Mock).mockReturnValue({
    get: jest.fn().mockReturnValue(undefined),
  });
}
```

## Test Coverage Goals

### Coverage Targets
Aim for these coverage thresholds:

- Route handlers: 80%+
- Database operations: 90%+
- Authentication logic: 95%+
- Validation schemas: 100%
- Utility functions: 90%+

## Running Tests

### Package.json Scripts
Add these test scripts:

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:run": "vitest run"
  }
}
```

## Testing Checklist

- [ ] Separate test database configured
- [ ] Database cleanup between tests
- [ ] Route handler tests for all endpoints
- [ ] Authentication flow tests
- [ ] Input validation tests
- [ ] Error handling tests
- [ ] Database operation tests
- [ ] Integration tests for workflows
- [ ] Mocking external dependencies
- [ ] Test coverage meets targets
- [ ] Tests run in CI/CD pipeline
- [ ] Performance tests for critical paths