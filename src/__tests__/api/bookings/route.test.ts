/**
 * @jest-environment node
 */
import { POST, GET } from '@/app/api/bookings/route'
import { prisma } from '@/lib/prisma'

describe('POST /api/bookings', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should create a booking with valid data (returns 201)', async () => {
    ;(prisma.timeSlot.findUnique as jest.Mock).mockResolvedValue({
      id: 'slot-1',
      isBooked: false,
      date: new Date('2025-01-15'),
    })
    ;(prisma.booking.create as jest.Mock).mockResolvedValue({
      id: 'booking-1',
      studentId: 'student-1',
      tutorId: 'tutor-1',
      slotId: 'slot-1',
      status: 'PENDING',
    })
    ;(prisma.timeSlot.update as jest.Mock).mockResolvedValue({})
    ;(prisma.notification.create as jest.Mock).mockResolvedValue({})

    const request = new Request('http://localhost/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        studentId: 'student-1',
        tutorId: 'tutor-1',
        slotId: 'slot-1',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.id).toBe('booking-1')
    expect(data.status).toBe('PENDING')
  })

  it('should mark slot as booked when creating a booking', async () => {
    ;(prisma.timeSlot.findUnique as jest.Mock).mockResolvedValue({
      id: 'slot-1',
      isBooked: false,
      date: new Date('2025-01-15'),
    })
    ;(prisma.booking.create as jest.Mock).mockResolvedValue({
      id: 'booking-1',
      studentId: 'student-1',
      tutorId: 'tutor-1',
      slotId: 'slot-1',
    })
    ;(prisma.timeSlot.update as jest.Mock).mockResolvedValue({})
    ;(prisma.notification.create as jest.Mock).mockResolvedValue({})

    const request = new Request('http://localhost/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        studentId: 'student-1',
        tutorId: 'tutor-1',
        slotId: 'slot-1',
      }),
    })

    await POST(request)

    expect(prisma.timeSlot.update).toHaveBeenCalledWith({
      where: { id: 'slot-1' },
      data: { isBooked: true },
    })
  })

  it('should create notification for tutor when booking is created', async () => {
    ;(prisma.timeSlot.findUnique as jest.Mock).mockResolvedValue({
      id: 'slot-1',
      isBooked: false,
      date: new Date('2025-01-15'),
    })
    ;(prisma.booking.create as jest.Mock).mockResolvedValue({
      id: 'booking-1',
      studentId: 'student-1',
      tutorId: 'tutor-1',
      slotId: 'slot-1',
    })
    ;(prisma.timeSlot.update as jest.Mock).mockResolvedValue({})
    ;(prisma.notification.create as jest.Mock).mockResolvedValue({})

    const request = new Request('http://localhost/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        studentId: 'student-1',
        tutorId: 'tutor-1',
        slotId: 'slot-1',
      }),
    })

    await POST(request)

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'tutor-1' }),
    })
  })

  it('should return 400 when studentId is missing', async () => {
    const request = new Request('http://localhost/api/bookings', {
      method: 'POST',
      body: JSON.stringify({ tutorId: 'tutor-1', slotId: 'slot-1' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('should return 400 when tutorId is missing', async () => {
    const request = new Request('http://localhost/api/bookings', {
      method: 'POST',
      body: JSON.stringify({ studentId: 'student-1', slotId: 'slot-1' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('should return 400 when slotId is missing', async () => {
    const request = new Request('http://localhost/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        studentId: 'student-1',
        tutorId: 'tutor-1',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('should return 400 when slot is already booked', async () => {
    ;(prisma.timeSlot.findUnique as jest.Mock).mockResolvedValue({
      id: 'slot-1',
      isBooked: true,
      date: new Date('2025-01-15'),
    })

    const request = new Request('http://localhost/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        studentId: 'student-1',
        tutorId: 'tutor-1',
        slotId: 'slot-1',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('should return 400 when slot does not exist', async () => {
    ;(prisma.timeSlot.findUnique as jest.Mock).mockResolvedValue(null)

    const request = new Request('http://localhost/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        studentId: 'student-1',
        tutorId: 'tutor-1',
        slotId: 'nonexistent',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('should handle database errors gracefully (500)', async () => {
    ;(prisma.timeSlot.findUnique as jest.Mock).mockRejectedValue(
      new Error('DB error')
    )

    const request = new Request('http://localhost/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        studentId: 'student-1',
        tutorId: 'tutor-1',
        slotId: 'slot-1',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(500)
  })
})

describe('GET /api/bookings', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should retrieve bookings for a student', async () => {
    const mockBookings = [
      {
        id: 'booking-1',
        studentId: 'student-1',
        tutorId: 'tutor-1',
        slotId: 'slot-1',
        status: 'PENDING',
        student: { id: 'student-1', name: 'Student', email: 's@test.com' },
        tutor: { id: 'tutor-1', name: 'Tutor', email: 't@test.com' },
        slot: {
          id: 'slot-1',
          date: '2025-01-15',
          startTime: '09:00',
          endTime: '10:00',
        },
      },
    ]
    ;(prisma.booking.findMany as jest.Mock).mockResolvedValue(mockBookings)

    const request = new Request(
      'http://localhost/api/bookings?userId=student-1',
      { method: 'GET' }
    )

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(1)
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId: 'student-1' },
      })
    )
  })

  it('should retrieve bookings for a tutor (role=TUTOR)', async () => {
    ;(prisma.booking.findMany as jest.Mock).mockResolvedValue([])

    const request = new Request(
      'http://localhost/api/bookings?userId=tutor-1&role=TUTOR',
      { method: 'GET' }
    )

    await GET(request)

    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tutorId: 'tutor-1' },
      })
    )
  })

  it('should return 400 when userId is missing', async () => {
    const request = new Request('http://localhost/api/bookings', {
      method: 'GET',
    })

    const response = await GET(request)
    expect(response.status).toBe(400)
  })

  it('should return bookings with related data (student, tutor, slot)', async () => {
    ;(prisma.booking.findMany as jest.Mock).mockResolvedValue([])

    const request = new Request(
      'http://localhost/api/bookings?userId=student-1',
      { method: 'GET' }
    )

    await GET(request)

    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          student: expect.any(Object),
          tutor: expect.any(Object),
          slot: expect.any(Object),
        }),
      })
    )
  })

  it('should order bookings by createdAt desc', async () => {
    ;(prisma.booking.findMany as jest.Mock).mockResolvedValue([])

    const request = new Request(
      'http://localhost/api/bookings?userId=student-1',
      { method: 'GET' }
    )

    await GET(request)

    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
      })
    )
  })

  it('should handle database errors gracefully (500)', async () => {
    ;(prisma.booking.findMany as jest.Mock).mockRejectedValue(
      new Error('DB error')
    )

    const request = new Request(
      'http://localhost/api/bookings?userId=student-1',
      { method: 'GET' }
    )

    const response = await GET(request)
    expect(response.status).toBe(500)
  })
})
