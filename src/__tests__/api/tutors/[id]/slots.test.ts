/**
 * @jest-environment node
 */
import { GET, POST } from '@/app/api/tutors/[id]/slots/route'
import { prisma } from '@/lib/prisma'

describe('GET /api/tutors/[id]/slots', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const mockCtx = { params: Promise.resolve({ id: 'tutor-1' }) }

  it('should retrieve future time slots for a tutor', async () => {
    const mockSlots = [
      {
        id: 'slot-1',
        date: '2025-12-01',
        startTime: '09:00',
        endTime: '10:00',
        isBooked: false,
      },
    ]
    ;(prisma.timeSlot.findMany as jest.Mock).mockResolvedValue(mockSlots)

    const request = new Request('http://localhost/api/tutors/tutor-1/slots', {
      method: 'GET',
    })

    const response = await GET(request as any, mockCtx as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(1)
    expect(prisma.timeSlot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tutorId: 'tutor-1',
          date: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      })
    )
  })

  it('should order slots by date asc', async () => {
    ;(prisma.timeSlot.findMany as jest.Mock).mockResolvedValue([])

    const request = new Request('http://localhost/api/tutors/tutor-1/slots', {
      method: 'GET',
    })

    await GET(request as any, mockCtx as any)

    expect(prisma.timeSlot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { date: 'asc' },
      })
    )
  })

  it('should return booked status in the response', async () => {
    ;(prisma.timeSlot.findMany as jest.Mock).mockResolvedValue([])

    const request = new Request('http://localhost/api/tutors/tutor-1/slots', {
      method: 'GET',
    })

    await GET(request as any, mockCtx as any)

    expect(prisma.timeSlot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          isBooked: true,
        }),
      })
    )
  })

  it('should handle database errors gracefully (500)', async () => {
    ;(prisma.timeSlot.findMany as jest.Mock).mockRejectedValue(
      new Error('DB error')
    )

    const request = new Request('http://localhost/api/tutors/tutor-1/slots', {
      method: 'GET',
    })

    const response = await GET(request as any, mockCtx as any)
    expect(response.status).toBe(500)
  })
})

describe('POST /api/tutors/[id]/slots', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const mockCtx = { params: Promise.resolve({ id: 'tutor-1' }) }

  it('should create a time slot with valid data (returns 201)', async () => {
    ;(prisma.timeSlot.create as jest.Mock).mockResolvedValue({
      id: 'slot-1',
      tutorId: 'tutor-1',
      date: '2025-12-01',
      startTime: '09:00',
      endTime: '10:00',
      isBooked: false,
    })

    const request = new Request('http://localhost/api/tutors/tutor-1/slots', {
      method: 'POST',
      body: JSON.stringify({
        date: '2025-12-01',
        startTime: '2025-12-01T09:00:00',
        endTime: '2025-12-01T10:00:00',
      }),
    })

    const response = await POST(request as any, mockCtx as any)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.id).toBe('slot-1')
  })

  it('should return 400 when date is missing', async () => {
    const request = new Request('http://localhost/api/tutors/tutor-1/slots', {
      method: 'POST',
      body: JSON.stringify({
        startTime: '2025-12-01T09:00:00',
        endTime: '2025-12-01T10:00:00',
      }),
    })

    const response = await POST(request as any, mockCtx as any)
    expect(response.status).toBe(400)
  })

  it('should return 400 when startTime is missing', async () => {
    const request = new Request('http://localhost/api/tutors/tutor-1/slots', {
      method: 'POST',
      body: JSON.stringify({
        date: '2025-12-01',
        endTime: '2025-12-01T10:00:00',
      }),
    })

    const response = await POST(request as any, mockCtx as any)
    expect(response.status).toBe(400)
  })

  it('should return 400 when endTime is missing', async () => {
    const request = new Request('http://localhost/api/tutors/tutor-1/slots', {
      method: 'POST',
      body: JSON.stringify({
        date: '2025-12-01',
        startTime: '2025-12-01T09:00:00',
      }),
    })

    const response = await POST(request as any, mockCtx as any)
    expect(response.status).toBe(400)
  })

  it('should handle database errors gracefully (500)', async () => {
    ;(prisma.timeSlot.create as jest.Mock).mockRejectedValue(
      new Error('DB error')
    )

    const request = new Request('http://localhost/api/tutors/tutor-1/slots', {
      method: 'POST',
      body: JSON.stringify({
        date: '2025-12-01',
        startTime: '2025-12-01T09:00:00',
        endTime: '2025-12-01T10:00:00',
      }),
    })

    const response = await POST(request as any, mockCtx as any)
    expect(response.status).toBe(500)
  })
})
