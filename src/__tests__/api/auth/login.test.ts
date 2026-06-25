/**
 * @jest-environment node
 */
import { POST } from '@/app/api/auth/login/route'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

jest.mock('bcryptjs')

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should login successfully with correct credentials', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: '1',
      email: 'user@test.com',
      name: 'User',
      role: 'STUDENT',
      passwordHash: 'hashedpwd',
    })
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)

    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'user@test.com', password: 'pass123' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.email).toBe('user@test.com')
    expect(data.name).toBe('User')
    expect(data.role).toBe('STUDENT')
  })

  it('should return 401 for invalid email', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)

    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'nonexistent@test.com',
        password: 'pass123',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBeDefined()
  })

  it('should return 401 for invalid password', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: '1',
      email: 'user@test.com',
      name: 'User',
      role: 'STUDENT',
      passwordHash: 'hashedpwd',
    })
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)

    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'user@test.com', password: 'wrongpass' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBeDefined()
  })

  it('should return 400 when email is missing', async () => {
    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password: 'pass123' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('should return 400 when password is missing', async () => {
    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'user@test.com' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('should verify password using bcrypt.compare', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: '1',
      email: 'user@test.com',
      name: 'User',
      role: 'STUDENT',
      passwordHash: 'stored_hash',
    })
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)

    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'user@test.com', password: 'mypassword' }),
    })

    await POST(request)

    expect(bcrypt.compare).toHaveBeenCalledWith('mypassword', 'stored_hash')
  })

  it('should return user data without password hash', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: '1',
      email: 'user@test.com',
      name: 'User',
      role: 'STUDENT',
      passwordHash: 'hashedpwd',
    })
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)

    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'user@test.com', password: 'pass123' }),
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

    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'user@test.com', password: 'pass123' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBeDefined()
  })
})
