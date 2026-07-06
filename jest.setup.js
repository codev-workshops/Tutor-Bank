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
  useSession: () => {
    const React = require('react')
    const snapshotUser = React.useSyncExternalStore(
      () => () => {},
      () => null,
      () => null
    )

    if (snapshotUser) {
      return {
        data: { user: snapshotUser },
        status: 'authenticated',
      }
    }

    try {
      const storedUser = global.localStorage.getItem('user')
      if (!storedUser) {
        return unauthenticatedSession
      }

      if (storedUser === cachedStoredUser && cachedAuthenticatedSession) {
        return cachedAuthenticatedSession
      }

      cachedStoredUser = storedUser
      cachedAuthenticatedSession = {
        data: { user: JSON.parse(storedUser) },
        status: 'authenticated',
      }
      return cachedAuthenticatedSession
    } catch {
      return unauthenticatedSession
    }
  },
  signIn: jest.fn(async (_provider, options = {}) => {
    const { email, password } = options

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      return {
        error: data.error || 'Login failed',
        ok: false,
        status: response.status,
        url: null,
      }
    }

    const user = await response.json()
    global.localStorage.setItem('user', JSON.stringify(user))

    return {
      error: null,
      ok: true,
      status: 200,
      url: null,
    }
  }),
}))

const unauthenticatedSession = { data: null, status: 'unauthenticated' }
let cachedStoredUser = null
let cachedAuthenticatedSession = null

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(global, 'localStorage', { value: localStorageMock })
