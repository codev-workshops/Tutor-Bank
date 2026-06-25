/**
 * @jest-environment node
 */
import { PATCH } from '@/app/api/bookings/[id]/route'
import { prisma } from '@/lib/prisma'

describe('PATCH /api/bookings/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const createRequest = (body: Record<string, unknown>) =>
    new Request('http://localhost/api/bookings/booking-1', {
      method: 'PATCH',
      body: JSON.stringify(body),
    })

  const mockCtx = { params: Promise.resolve({ id: 'booking-1' }) }

  it('should update booking to CONFIRMED', async () => {
    ;(prisma.booking.update as jest.Mock).mockResolvedValue({
      id: 'booking-1',
      studentId: 'student-1',
      tutorId: 'tutor-1',
      slotId: 'slot-1',
      status: 'CONFIRMED',
    })
    ;(prisma.notification.create as jest.Mock).mockResolvedValue({})

    const response = await PATCH(
      createRequest({ status: 'CONFIRMED' }) as any,
      mockCtx as any
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('CONFIRMED')
  })

  it('should update booking to REJECTED', async () => {
    ;(prisma.booking.update as jest.Mock).mockResolvedValue({
      id: 'booking-1',
      studentId: 'student-1',
      tutorId: 'tutor-1',
      slotId: 'slot-1',
      status: 'REJECTED',
    })
    ;(prisma.timeSlot.update as jest.Mock).mockResolvedValue({})
    ;(prisma.notification.create as jest.Mock).mockResolvedValue({})

    const response = await PATCH(
      createRequest({ status: 'REJECTED' }) as any,
      mockCtx as any
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('REJECTED')
  })

  it('should update booking to CANCELLED', async () => {
    ;(prisma.booking.update as jest.Mock).mockResolvedValue({
      id: 'booking-1',
      studentId: 'student-1',
      tutorId: 'tutor-1',
      slotId: 'slot-1',
      status: 'CANCELLED',
    })
    ;(prisma.timeSlot.update as jest.Mock).mockResolvedValue({})
    ;(prisma.notification.create as jest.Mock).mockResolvedValue({})

    const response = await PATCH(
      createRequest({ status: 'CANCELLED' }) as any,
      mockCtx as any
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('CANCELLED')
  })

  it('should free up slot when booking is REJECTED', async () => {
    ;(prisma.booking.update as jest.Mock).mockResolvedValue({
      id: 'booking-1',
      studentId: 'student-1',
      tutorId: 'tutor-1',
      slotId: 'slot-1',
      status: 'REJECTED',
    })
    ;(prisma.timeSlot.update as jest.Mock).mockResolvedValue({})
    ;(prisma.notification.create as jest.Mock).mockResolvedValue({})

    await PATCH(
      createRequest({ status: 'REJECTED' }) as any,
      mockCtx as any
    )

    expect(prisma.timeSlot.update).toHaveBeenCalledWith({
      where: { id: 'slot-1' },
      data: { isBooked: false },
    })
  })

  it('should free up slot when booking is CANCELLED', async () => {
    ;(prisma.booking.update as jest.Mock).mockResolvedValue({
      id: 'booking-1',
      studentId: 'student-1',
      tutorId: 'tutor-1',
      slotId: 'slot-1',
      status: 'CANCELLED',
    })
    ;(prisma.timeSlot.update as jest.Mock).mockResolvedValue({})
    ;(prisma.notification.create as jest.Mock).mockResolvedValue({})

    await PATCH(
      createRequest({ status: 'CANCELLED' }) as any,
      mockCtx as any
    )

    expect(prisma.timeSlot.update).toHaveBeenCalledWith({
      where: { id: 'slot-1' },
      data: { isBooked: false },
    })
  })

  it('should keep slot booked when CONFIRMED', async () => {
    ;(prisma.booking.update as jest.Mock).mockResolvedValue({
      id: 'booking-1',
      studentId: 'student-1',
      tutorId: 'tutor-1',
      slotId: 'slot-1',
      status: 'CONFIRMED',
    })
    ;(prisma.notification.create as jest.Mock).mockResolvedValue({})

    await PATCH(
      createRequest({ status: 'CONFIRMED' }) as any,
      mockCtx as any
    )

    expect(prisma.timeSlot.update).not.toHaveBeenCalled()
  })

  it('should create notification for student on status change', async () => {
    ;(prisma.booking.update as jest.Mock).mockResolvedValue({
      id: 'booking-1',
      studentId: 'student-1',
      tutorId: 'tutor-1',
      slotId: 'slot-1',
      status: 'CONFIRMED',
    })
    ;(prisma.notification.create as jest.Mock).mockResolvedValue({})

    await PATCH(
      createRequest({ status: 'CONFIRMED' }) as any,
      mockCtx as any
    )

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'student-1',
        message: expect.stringContaining('confirmed'),
      }),
    })
  })

  it('should return 400 for invalid status', async () => {
    const response = await PATCH(
      createRequest({ status: 'INVALID_STATUS' }) as any,
      mockCtx as any
    )

    expect(response.status).toBe(400)
  })

  it('should return 400 when status is missing', async () => {
    const response = await PATCH(
      createRequest({}) as any,
      mockCtx as any
    )

    expect(response.status).toBe(400)
  })

  it('should handle database errors gracefully (500)', async () => {
    ;(prisma.booking.update as jest.Mock).mockRejectedValue(
      new Error('DB error')
    )

    const response = await PATCH(
      createRequest({ status: 'CONFIRMED' }) as any,
      mockCtx as any
    )

    expect(response.status).toBe(500)
  })
})
