/**
 * @jest-environment node
 */
import { GET, PUT } from '@/app/api/tutors/[id]/route'
import { prisma } from '@/lib/prisma'

describe('GET /api/tutors/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const mockCtx = { params: Promise.resolve({ id: 'tutor-1' }) }

  it('should retrieve a specific tutor by ID', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'tutor-1',
      name: 'John',
      email: 'john@test.com',
      bio: 'Math expert',
      hourlyRate: 50,
      subjects: [{ subject: { id: 'sub-1', name: 'Math' } }],
      timeSlots: [],
    })

    const request = new Request('http://localhost/api/tutors/tutor-1', {
      method: 'GET',
    })

    const response = await GET(request as any, mockCtx as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.id).toBe('tutor-1')
    expect(data.name).toBe('John')
  })

  it('should return tutor with subjects', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'tutor-1',
      name: 'John',
      email: 'john@test.com',
      bio: 'Math expert',
      hourlyRate: 50,
      subjects: [{ subject: { id: 'sub-1', name: 'Math' } }],
      timeSlots: [],
    })

    const request = new Request('http://localhost/api/tutors/tutor-1', {
      method: 'GET',
    })

    await GET(request as any, mockCtx as any)

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          subjects: expect.any(Object),
        }),
      })
    )
  })

  it('should return only future, unbooked time slots', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'tutor-1',
      name: 'John',
      email: 'john@test.com',
      bio: 'Math expert',
      hourlyRate: 50,
      subjects: [],
      timeSlots: [
        {
          id: 'slot-1',
          date: '2025-12-01',
          startTime: '09:00',
          endTime: '10:00',
        },
      ],
    })

    const request = new Request('http://localhost/api/tutors/tutor-1', {
      method: 'GET',
    })

    await GET(request as any, mockCtx as any)

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          timeSlots: expect.objectContaining({
            where: expect.objectContaining({
              isBooked: false,
              date: expect.objectContaining({ gte: expect.any(Date) }),
            }),
          }),
        }),
      })
    )
  })

  it('should order time slots by date asc', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'tutor-1',
      name: 'John',
      email: 'john@test.com',
      subjects: [],
      timeSlots: [],
    })

    const request = new Request('http://localhost/api/tutors/tutor-1', {
      method: 'GET',
    })

    await GET(request as any, mockCtx as any)

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          timeSlots: expect.objectContaining({
            orderBy: { date: 'asc' },
          }),
        }),
      })
    )
  })

  it('should return 404 for non-existent tutor', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)

    const request = new Request('http://localhost/api/tutors/nonexistent', {
      method: 'GET',
    })

    const response = await GET(request as any, mockCtx as any)
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBeDefined()
  })

  it('should handle database errors gracefully (500)', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockRejectedValue(
      new Error('DB error')
    )

    const request = new Request('http://localhost/api/tutors/tutor-1', {
      method: 'GET',
    })

    const response = await GET(request as any, mockCtx as any)
    expect(response.status).toBe(500)
  })
})

describe('PUT /api/tutors/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const mockCtx = { params: Promise.resolve({ id: 'tutor-1' }) }

  it('should update tutor name', async () => {
    ;(prisma.user.update as jest.Mock).mockResolvedValue({
      id: 'tutor-1',
      name: 'Updated Name',
      email: 'john@test.com',
    })

    const request = new Request('http://localhost/api/tutors/tutor-1', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated Name' }),
    })

    const response = await PUT(request as any, mockCtx as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.name).toBe('Updated Name')
  })

  it('should update tutor bio', async () => {
    ;(prisma.user.update as jest.Mock).mockResolvedValue({
      id: 'tutor-1',
      name: 'John',
      bio: 'New bio',
    })

    const request = new Request('http://localhost/api/tutors/tutor-1', {
      method: 'PUT',
      body: JSON.stringify({ bio: 'New bio' }),
    })

    const response = await PUT(request as any, mockCtx as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.bio).toBe('New bio')
  })

  it('should update tutor hourly rate', async () => {
    ;(prisma.user.update as jest.Mock).mockResolvedValue({
      id: 'tutor-1',
      name: 'John',
      hourlyRate: 75,
    })

    const request = new Request('http://localhost/api/tutors/tutor-1', {
      method: 'PUT',
      body: JSON.stringify({ hourlyRate: 75 }),
    })

    const response = await PUT(request as any, mockCtx as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.hourlyRate).toBe(75)
  })

  it('should update tutor subjects (replaces existing)', async () => {
    ;(prisma.user.update as jest.Mock).mockResolvedValue({
      id: 'tutor-1',
      name: 'John',
    })
    ;(prisma.tutorSubject.deleteMany as jest.Mock).mockResolvedValue({})
    ;(prisma.subject.upsert as jest.Mock).mockResolvedValue({
      id: 'sub-1',
      name: 'Physics',
    })
    ;(prisma.tutorSubject.create as jest.Mock).mockResolvedValue({})

    const request = new Request('http://localhost/api/tutors/tutor-1', {
      method: 'PUT',
      body: JSON.stringify({ subjects: ['Physics'] }),
    })

    await PUT(request as any, mockCtx as any)

    expect(prisma.tutorSubject.deleteMany).toHaveBeenCalledWith({
      where: { tutorId: 'tutor-1' },
    })
    expect(prisma.subject.upsert).toHaveBeenCalledWith({
      where: { name: 'Physics' },
      update: {},
      create: { name: 'Physics' },
    })
    expect(prisma.tutorSubject.create).toHaveBeenCalledWith({
      data: { tutorId: 'tutor-1', subjectId: 'sub-1' },
    })
  })

  it('should clear subjects with empty array', async () => {
    ;(prisma.user.update as jest.Mock).mockResolvedValue({
      id: 'tutor-1',
      name: 'John',
    })
    ;(prisma.tutorSubject.deleteMany as jest.Mock).mockResolvedValue({})

    const request = new Request('http://localhost/api/tutors/tutor-1', {
      method: 'PUT',
      body: JSON.stringify({ subjects: [] }),
    })

    await PUT(request as any, mockCtx as any)

    expect(prisma.tutorSubject.deleteMany).toHaveBeenCalledWith({
      where: { tutorId: 'tutor-1' },
    })
    expect(prisma.subject.upsert).not.toHaveBeenCalled()
  })

  it('should create new subject if it does not exist (upsert)', async () => {
    ;(prisma.user.update as jest.Mock).mockResolvedValue({
      id: 'tutor-1',
      name: 'John',
    })
    ;(prisma.tutorSubject.deleteMany as jest.Mock).mockResolvedValue({})
    ;(prisma.subject.upsert as jest.Mock).mockResolvedValue({
      id: 'sub-new',
      name: 'NewSubject',
    })
    ;(prisma.tutorSubject.create as jest.Mock).mockResolvedValue({})

    const request = new Request('http://localhost/api/tutors/tutor-1', {
      method: 'PUT',
      body: JSON.stringify({ subjects: ['NewSubject'] }),
    })

    await PUT(request as any, mockCtx as any)

    expect(prisma.subject.upsert).toHaveBeenCalledWith({
      where: { name: 'NewSubject' },
      update: {},
      create: { name: 'NewSubject' },
    })
  })

  it('should handle database errors gracefully (500)', async () => {
    ;(prisma.user.update as jest.Mock).mockRejectedValue(
      new Error('DB error')
    )

    const request = new Request('http://localhost/api/tutors/tutor-1', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated' }),
    })

    const response = await PUT(request as any, mockCtx as any)
    expect(response.status).toBe(500)
  })
})
