/**
 * @jest-environment node
 */
import { GET } from '@/app/api/tutors/route'
import { prisma } from '@/lib/prisma'

describe('GET /api/tutors', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should retrieve all tutors with role TUTOR filter', async () => {
    const mockTutors = [
      {
        id: 'tutor-1',
        name: 'John',
        email: 'john@test.com',
        bio: 'Math tutor',
        hourlyRate: 50,
        subjects: [{ subject: { id: 'sub-1', name: 'Math' } }],
      },
    ]
    ;(prisma.user.findMany as jest.Mock).mockResolvedValue(mockTutors)

    const request = new Request('http://localhost/api/tutors', { method: 'GET' })
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(1)
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ role: 'TUTOR' }),
      })
    )
  })

  it('should search tutors by name (case insensitive)', async () => {
    ;(prisma.user.findMany as jest.Mock).mockResolvedValue([])

    const request = new Request('http://localhost/api/tutors?name=john', {
      method: 'GET',
    })

    await GET(request)

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: { contains: 'john', mode: 'insensitive' },
        }),
      })
    )
  })

  it('should search tutors by subject (case insensitive)', async () => {
    ;(prisma.user.findMany as jest.Mock).mockResolvedValue([])

    const request = new Request('http://localhost/api/tutors?subject=math', {
      method: 'GET',
    })

    await GET(request)

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          subjects: {
            some: {
              subject: { name: { contains: 'math', mode: 'insensitive' } },
            },
          },
        }),
      })
    )
  })

  it('should search by both name and subject', async () => {
    ;(prisma.user.findMany as jest.Mock).mockResolvedValue([])

    const request = new Request(
      'http://localhost/api/tutors?name=john&subject=math',
      { method: 'GET' }
    )

    await GET(request)

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: 'TUTOR',
          name: { contains: 'john', mode: 'insensitive' },
          subjects: {
            some: {
              subject: { name: { contains: 'math', mode: 'insensitive' } },
            },
          },
        }),
      })
    )
  })

  it('should return tutors with subjects', async () => {
    ;(prisma.user.findMany as jest.Mock).mockResolvedValue([])

    const request = new Request('http://localhost/api/tutors', { method: 'GET' })

    await GET(request)

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          subjects: expect.any(Object),
        }),
      })
    )
  })

  it('should return only tutors (not students)', async () => {
    ;(prisma.user.findMany as jest.Mock).mockResolvedValue([])

    const request = new Request('http://localhost/api/tutors', { method: 'GET' })

    await GET(request)

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ role: 'TUTOR' }),
      })
    )
  })

  it('should handle database errors gracefully (500)', async () => {
    ;(prisma.user.findMany as jest.Mock).mockRejectedValue(
      new Error('DB error')
    )

    const request = new Request('http://localhost/api/tutors', { method: 'GET' })
    const response = await GET(request)

    expect(response.status).toBe(500)
  })
})
