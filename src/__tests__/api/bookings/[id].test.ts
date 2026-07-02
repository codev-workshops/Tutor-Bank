/**
 * @jest-environment node
 */
import { PATCH } from '@/app/api/bookings/[id]/route'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/session', () => ({
  requireAuth: jest.fn(),
  getCurrentUser: jest.fn(),
}))

import { requireAuth } from '@/lib/session'

const mockRequireAuth = requireAuth as jest.Mock

describe('PATCH /api/bookings/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ id: 'tutor-1', role: 'TUTOR' })
  })

  const createRequest = (body: Record<string, unknown>) =>
    new Request('http://localhost/api/bookings/booking-1', {
      method: 'PATCH',
      body: JSON.stringify(body),
    })

  const mockCtx = { params: Promise.resolve({ id: 'booking-1' }) }

  const mockBooking = {
    id: 'booking-1',
    studentId: 'student-1',
    tutorId: 'tutor-1',
    slotId: 'slot-1',
    status: 'PENDING',
  }

  it('should update booking to CONFIRMED when tutor is authorized', async () => {
    ;(prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking)
    ;(prisma.booking.update as jest.Mock).mockResolvedValue({
      ...mockBooking,
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

  it('should update booking to REJECTED when tutor is authorized', async () => {
    ;(prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking)
    ;(prisma.booking.update as jest.Mock).mockResolvedValue({
      ...mockBooking,
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

  it('should update booking to CANCELLED when student is authorized', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'student-1', role: 'STUDENT' })
    ;(prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking)
    ;(prisma.booking.update as jest.Mock).mockResolvedValue({
      ...mockBooking,
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

  it('should return 403 when non-tutor tries to CONFIRM', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'attacker-1', role: 'STUDENT' })
    ;(prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking)

    const response = await PATCH(
      createRequest({ status: 'CONFIRMED' }) as any,
      mockCtx as any
    )

    expect(response.status).toBe(403)
    expect(prisma.booking.update).not.toHaveBeenCalled()
  })

  it('should return 403 when non-tutor tries to REJECT', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'attacker-1', role: 'STUDENT' })
    ;(prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking)

    const response = await PATCH(
      createRequest({ status: 'REJECTED' }) as any,
      mockCtx as any
    )

    expect(response.status).toBe(403)
    expect(prisma.booking.update).not.toHaveBeenCalled()
  })

  it('should return 403 when non-student tries to CANCEL', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'attacker-1', role: 'TUTOR' })
    ;(prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking)

    const response = await PATCH(
      createRequest({ status: 'CANCELLED' }) as any,
      mockCtx as any
    )

    expect(response.status).toBe(403)
    expect(prisma.booking.update).not.toHaveBeenCalled()
  })

  it('should return 404 when booking does not exist', async () => {
    ;(prisma.booking.findUnique as jest.Mock).mockResolvedValue(null)

    const response = await PATCH(
      createRequest({ status: 'CONFIRMED' }) as any,
      mockCtx as any
    )

    expect(response.status).toBe(404)
    expect(prisma.booking.update).not.toHaveBeenCalled()
  })

  it('should free up slot when booking is REJECTED', async () => {
    ;(prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking)
    ;(prisma.booking.update as jest.Mock).mockResolvedValue({
      ...mockBooking,
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
    mockRequireAuth.mockResolvedValue({ id: 'student-1', role: 'STUDENT' })
    ;(prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking)
    ;(prisma.booking.update as jest.Mock).mockResolvedValue({
      ...mockBooking,
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
    ;(prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking)
    ;(prisma.booking.update as jest.Mock).mockResolvedValue({
      ...mockBooking,
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
    ;(prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking)
    ;(prisma.booking.update as jest.Mock).mockResolvedValue({
      ...mockBooking,
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
    ;(prisma.booking.findUnique as jest.Mock).mockRejectedValue(
      new Error('DB error')
    )

    const response = await PATCH(
      createRequest({ status: 'CONFIRMED' }) as any,
      mockCtx as any
    )

    expect(response.status).toBe(500)
  })
})
