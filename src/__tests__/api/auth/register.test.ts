/**
 * @jest-environment node
 */
import { POST } from '@/app/api/auth/register/route'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

jest.mock('bcryptjs')

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should register a new STUDENT successfully', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
    ;(bcrypt.hash as jest.Mock).mockResolvedValue('hashedpwd')
    ;(prisma.user.create as jest.Mock).mockResolvedValue({
      id: '1',
      email: 'student@test.com',
      name: 'Student',
      role: 'STUDENT',
      passwordHash: 'hashedpwd',
    })

    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'student@test.com',
        name: 'Student',
        password: 'pass123',
        role: 'STUDENT',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.email).toBe('student@test.com')
    expect(data.role).toBe('STUDENT')
  })

  it('should register a new TUTOR successfully', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
    ;(bcrypt.hash as jest.Mock).mockResolvedValue('hashedpwd')
    ;(prisma.user.create as jest.Mock).mockResolvedValue({
      id: '2',
      email: 'tutor@test.com',
      name: 'Tutor',
      role: 'TUTOR',
      passwordHash: 'hashedpwd',
    })

    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'tutor@test.com',
        name: 'Tutor',
        password: 'pass123',
        role: 'TUTOR',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.role).toBe('TUTOR')
  })

  it('should return 409 for duplicate email', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: '1',
      email: 'existing@test.com',
    })

    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'existing@test.com',
        name: 'Test',
        password: 'pass123',
        role: 'STUDENT',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.error).toBeDefined()
  })

  it('should return 400 when email is missing', async () => {
    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', password: 'pass123' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('should return 400 when name is missing', async () => {
    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@test.com', password: 'pass123' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('should return 400 when password is missing', async () => {
    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@test.com', name: 'Test' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('should hash password using bcrypt', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
    ;(bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password')
    ;(prisma.user.create as jest.Mock).mockResolvedValue({
      id: '1',
      email: 'test@test.com',
      name: 'Test',
      role: 'STUDENT',
    })

    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@test.com',
        name: 'Test',
        password: 'mypassword',
        role: 'STUDENT',
      }),
    })

    await POST(request)

    expect(bcrypt.hash).toHaveBeenCalledWith('mypassword', 10)
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ passwordHash: 'hashed_password' }),
    })
  })

  it('should return user data without password hash', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
    ;(bcrypt.hash as jest.Mock).mockResolvedValue('hashedpwd')
    ;(prisma.user.create as jest.Mock).mockResolvedValue({
      id: '1',
      email: 'test@test.com',
      name: 'Test',
      role: 'STUDENT',
      passwordHash: 'hashedpwd',
    })

    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@test.com',
        name: 'Test',
        password: 'pass123',
        role: 'STUDENT',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(data.passwordHash).toBeUndefined()
    expect(data.id).toBeDefined()
    expect(data.email).toBeDefined()
    expect(data.name).toBeDefined()
  })

  it('should handle database errors gracefully (500)', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockRejectedValue(
      new Error('DB connection failed')
    )

    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@test.com',
        name: 'Test',
        password: 'pass123',
        role: 'STUDENT',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBeDefined()
  })
})
