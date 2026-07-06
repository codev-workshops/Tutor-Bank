import '@testing-library/jest-dom'

// Mock Prisma globally
jest.mock('@/lib/prisma', () => {
  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    booking: { create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    timeSlot: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    subject: { findMany: jest.fn(), upsert: jest.fn() },
    tutorSubject: { deleteMany: jest.fn(), create: jest.fn() },
    notification: { create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
  }

  prismaMock.$transaction = jest.fn(async (callback) => callback(prismaMock))

  return { prisma: prismaMock }
})

jest.mock('@auth/prisma-adapter', () => ({
  PrismaAdapter: jest.fn(() => ({})),
}))

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(async () => ({
    user: {
      id: 'test-user',
      name: 'Test User',
      email: 'test@test.com',
      role: 'STUDENT',
    },
  })),
}))

jest.mock('next-auth/react', () => ({
  SessionProvider: ({ children }) => children,
  useSession: jest.fn(() => ({
    data: null,
    status: 'unauthenticated',
  })),
  signIn: jest.fn(),
}))

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(global, 'localStorage', { value: localStorageMock })
