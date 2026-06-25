import '@testing-library/jest-dom'

// Mock Prisma globally
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    booking: { create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    timeSlot: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    subject: { findMany: jest.fn(), upsert: jest.fn() },
    tutorSubject: { deleteMany: jest.fn(), create: jest.fn() },
    notification: { create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
  },
}))

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(global, 'localStorage', { value: localStorageMock })
