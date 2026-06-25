/**
 * @jest-environment node
 */
import { POST as register } from '@/app/api/auth/register/route'
import { POST as login } from '@/app/api/auth/login/route'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

jest.mock('bcryptjs')

describe('Auth Flow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Complete registration flow', () => {
    it('should register a user and verify user created with hashed password', async () => {
      const hashedPassword = 'hashed_password_123'
      const mockUser = {
        id: 'user-1',
        email: 'newuser@test.com',
        name: 'New User',
        role: 'STUDENT',
        passwordHash: hashedPassword,
      }

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
      ;(bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword)
      ;(prisma.user.create as jest.Mock).mockResolvedValue(mockUser)

      const req = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'newuser@test.com',
          name: 'New User',
          password: 'securePass123',
        }),
      })

      const res = await register(req)
      const data = await res.json()

      expect(res.status).toBe(201)
      expect(data.email).toBe('newuser@test.com')
      expect(data.name).toBe('New User')
      expect(data.role).toBe('STUDENT')
      expect(data.passwordHash).toBeUndefined()

      expect(bcrypt.hash).toHaveBeenCalledWith('securePass123', 10)
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'newuser@test.com' },
      })
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'newuser@test.com',
          name: 'New User',
          passwordHash: hashedPassword,
          role: 'STUDENT',
        },
      })
    })
  })

  describe('Login after registration', () => {
    it('should register and then login with same credentials', async () => {
      const hashedPassword = 'hashed_password_123'
      const mockUser = {
        id: 'user-1',
        email: 'test@test.com',
        name: 'Test User',
        role: 'STUDENT',
        passwordHash: hashedPassword,
      }

      ;(bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword)
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)
      ;(prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(null) // Registration: check no existing user
        .mockResolvedValueOnce(mockUser) // Login: find user
      ;(prisma.user.create as jest.Mock).mockResolvedValue(mockUser)

      // Step 1: Register
      const registerReq = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@test.com',
          name: 'Test User',
          password: 'password123',
        }),
      })
      const registerRes = await register(registerReq)
      expect(registerRes.status).toBe(201)

      // Step 2: Login with same credentials
      const loginReq = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@test.com',
          password: 'password123',
        }),
      })
      const loginRes = await login(loginReq)
      const loginData = await loginRes.json()

      expect(loginRes.status).toBe(200)
      expect(loginData.email).toBe('test@test.com')
      expect(loginData.name).toBe('Test User')
      expect(loginData.role).toBe('STUDENT')
      expect(loginData.passwordHash).toBeUndefined()
    })
  })

  describe('Duplicate registration prevention', () => {
    it('should reject registration with an already registered email', async () => {
      const existingUser = {
        id: 'user-1',
        email: 'existing@test.com',
        name: 'Existing User',
        role: 'STUDENT',
        passwordHash: 'hashed_pw',
      }

      // First registration succeeds
      ;(prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(null) // First call: no existing user
        .mockResolvedValueOnce(existingUser) // Second call: user exists
      ;(bcrypt.hash as jest.Mock).mockResolvedValue('hashed_pw')
      ;(prisma.user.create as jest.Mock).mockResolvedValue(existingUser)

      // Step 1: Register first time
      const firstReq = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'existing@test.com',
          name: 'Existing User',
          password: 'password123',
        }),
      })
      const firstRes = await register(firstReq)
      expect(firstRes.status).toBe(201)

      // Step 2: Register again with same email
      const secondReq = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'existing@test.com',
          name: 'Another User',
          password: 'password456',
        }),
      })
      const secondRes = await register(secondReq)
      const secondData = await secondRes.json()

      expect(secondRes.status).toBe(409)
      expect(secondData.error).toBe('User already exists')
    })
  })

  describe('Role-based access', () => {
    it('should register a user as TUTOR and verify role', async () => {
      const hashedPassword = 'hashed_pw'
      const mockTutor = {
        id: 'tutor-1',
        email: 'tutor@test.com',
        name: 'Tutor User',
        role: 'TUTOR',
        passwordHash: hashedPassword,
      }

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
      ;(bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword)
      ;(prisma.user.create as jest.Mock).mockResolvedValue(mockTutor)

      const req = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'tutor@test.com',
          name: 'Tutor User',
          password: 'password123',
          role: 'TUTOR',
        }),
      })
      const res = await register(req)
      const data = await res.json()

      expect(res.status).toBe(201)
      expect(data.role).toBe('TUTOR')

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ role: 'TUTOR' }),
      })
    })

    it('should register a user as STUDENT and verify role', async () => {
      const hashedPassword = 'hashed_pw'
      const mockStudent = {
        id: 'student-1',
        email: 'student@test.com',
        name: 'Student User',
        role: 'STUDENT',
        passwordHash: hashedPassword,
      }

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
      ;(bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword)
      ;(prisma.user.create as jest.Mock).mockResolvedValue(mockStudent)

      const req = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'student@test.com',
          name: 'Student User',
          password: 'password123',
          role: 'STUDENT',
        }),
      })
      const res = await register(req)
      const data = await res.json()

      expect(res.status).toBe(201)
      expect(data.role).toBe('STUDENT')

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ role: 'STUDENT' }),
      })
    })

    it('should default to STUDENT role when no role specified', async () => {
      const hashedPassword = 'hashed_pw'
      const mockUser = {
        id: 'user-1',
        email: 'default@test.com',
        name: 'Default User',
        role: 'STUDENT',
        passwordHash: hashedPassword,
      }

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
      ;(bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword)
      ;(prisma.user.create as jest.Mock).mockResolvedValue(mockUser)

      const req = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'default@test.com',
          name: 'Default User',
          password: 'password123',
        }),
      })
      const res = await register(req)
      const data = await res.json()

      expect(res.status).toBe(201)
      expect(data.role).toBe('STUDENT')

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ role: 'STUDENT' }),
      })
    })
  })
})
