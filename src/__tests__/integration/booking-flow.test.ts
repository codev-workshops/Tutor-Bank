/**
 * @jest-environment node
 */
import { POST as createBooking, GET as getBookings } from '@/app/api/bookings/route'
import { PATCH as updateBookingStatus } from '@/app/api/bookings/[id]/route'
import { POST as createSlot } from '@/app/api/tutors/[id]/slots/route'
import { prisma } from '@/lib/prisma'

describe('Booking Flow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Complete booking flow', () => {
    it('should create slot → student books → slot marked booked → tutor notified', async () => {
      const mockSlot = {
        id: 'slot-1',
        tutorId: 'tutor-1',
        date: new Date('2025-01-15'),
        startTime: new Date('2025-01-15T10:00:00'),
        endTime: new Date('2025-01-15T11:00:00'),
        isBooked: false,
      }

      const mockBooking = {
        id: 'booking-1',
        studentId: 'student-1',
        tutorId: 'tutor-1',
        slotId: 'slot-1',
        status: 'PENDING',
        createdAt: new Date(),
      }

      const mockNotification = {
        id: 'notif-1',
        userId: 'tutor-1',
        message: `New booking request for slot on ${mockSlot.date.toLocaleDateString()}`,
        read: false,
        createdAt: new Date(),
      }

      // Step 1: Create a time slot
      ;(prisma.timeSlot.create as jest.Mock).mockResolvedValue(mockSlot)

      const slotReq = new Request('http://localhost/api/tutors/tutor-1/slots', {
        method: 'POST',
        body: JSON.stringify({
          date: '2025-01-15',
          startTime: '2025-01-15T10:00:00',
          endTime: '2025-01-15T11:00:00',
        }),
      })
      const slotCtx = { params: Promise.resolve({ id: 'tutor-1' }) }
      const slotRes = await createSlot(slotReq, slotCtx as any)
      expect(slotRes.status).toBe(201)

      // Step 2: Student books the slot
      ;(prisma.timeSlot.findUnique as jest.Mock).mockResolvedValue(mockSlot)
      ;(prisma.booking.create as jest.Mock).mockResolvedValue(mockBooking)
      ;(prisma.timeSlot.update as jest.Mock).mockResolvedValue({ ...mockSlot, isBooked: true })
      ;(prisma.notification.create as jest.Mock).mockResolvedValue(mockNotification)

      const bookingReq = new Request('http://localhost/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          studentId: 'student-1',
          tutorId: 'tutor-1',
          slotId: 'slot-1',
        }),
      })
      const bookingRes = await createBooking(bookingReq)
      const bookingData = await bookingRes.json()

      expect(bookingRes.status).toBe(201)
      expect(bookingData.slotId).toBe('slot-1')
      expect(bookingData.studentId).toBe('student-1')

      // Verify slot was marked as booked
      expect(prisma.timeSlot.update).toHaveBeenCalledWith({
        where: { id: 'slot-1' },
        data: { isBooked: true },
      })

      // Verify tutor was notified
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'tutor-1',
          message: expect.stringContaining('New booking request'),
        },
      })
    })
  })

  describe('Booking confirmation flow', () => {
    it('should create booking → tutor confirms → student notified → slot stays booked', async () => {
      const mockSlot = {
        id: 'slot-1',
        tutorId: 'tutor-1',
        date: new Date('2025-01-15'),
        startTime: new Date('2025-01-15T10:00:00'),
        endTime: new Date('2025-01-15T11:00:00'),
        isBooked: false,
      }

      const mockBooking = {
        id: 'booking-1',
        studentId: 'student-1',
        tutorId: 'tutor-1',
        slotId: 'slot-1',
        status: 'PENDING',
        createdAt: new Date(),
      }

      const confirmedBooking = {
        ...mockBooking,
        status: 'CONFIRMED',
      }

      // Step 1: Create booking
      ;(prisma.timeSlot.findUnique as jest.Mock).mockResolvedValue(mockSlot)
      ;(prisma.booking.create as jest.Mock).mockResolvedValue(mockBooking)
      ;(prisma.timeSlot.update as jest.Mock).mockResolvedValue({ ...mockSlot, isBooked: true })
      ;(prisma.notification.create as jest.Mock).mockResolvedValue({
        id: 'notif-1',
        userId: 'tutor-1',
        message: 'New booking request',
        read: false,
        createdAt: new Date(),
      })

      const bookingReq = new Request('http://localhost/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          studentId: 'student-1',
          tutorId: 'tutor-1',
          slotId: 'slot-1',
        }),
      })
      const bookingRes = await createBooking(bookingReq)
      expect(bookingRes.status).toBe(201)

      // Step 2: Tutor confirms the booking
      ;(prisma.booking.update as jest.Mock).mockResolvedValue(confirmedBooking)
      ;(prisma.notification.create as jest.Mock).mockResolvedValue({
        id: 'notif-2',
        userId: 'student-1',
        message: 'Your booking has been confirmed',
        read: false,
        createdAt: new Date(),
      })

      const patchReq = new Request('http://localhost/api/bookings/booking-1', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'CONFIRMED' }),
      })
      const patchCtx = { params: Promise.resolve({ id: 'booking-1' }) }
      const patchRes = await updateBookingStatus(patchReq as any, patchCtx as any)
      const patchData = await patchRes.json()

      expect(patchRes.status).toBe(200)
      expect(patchData.status).toBe('CONFIRMED')

      // Verify student was notified
      expect(prisma.notification.create).toHaveBeenLastCalledWith({
        data: {
          userId: 'student-1',
          message: 'Your booking has been confirmed',
        },
      })

      // Verify slot was NOT freed (stays booked on confirmation)
      // timeSlot.update should only have been called once (during booking creation)
      expect(prisma.timeSlot.update).toHaveBeenCalledTimes(1)
    })
  })

  describe('Booking rejection flow', () => {
    it('should create booking → tutor rejects → slot freed → student notified', async () => {
      const mockSlot = {
        id: 'slot-1',
        tutorId: 'tutor-1',
        date: new Date('2025-01-15'),
        startTime: new Date('2025-01-15T10:00:00'),
        endTime: new Date('2025-01-15T11:00:00'),
        isBooked: false,
      }

      const mockBooking = {
        id: 'booking-1',
        studentId: 'student-1',
        tutorId: 'tutor-1',
        slotId: 'slot-1',
        status: 'PENDING',
        createdAt: new Date(),
      }

      const rejectedBooking = {
        ...mockBooking,
        status: 'REJECTED',
      }

      // Step 1: Create booking
      ;(prisma.timeSlot.findUnique as jest.Mock).mockResolvedValue(mockSlot)
      ;(prisma.booking.create as jest.Mock).mockResolvedValue(mockBooking)
      ;(prisma.timeSlot.update as jest.Mock).mockResolvedValue({ ...mockSlot, isBooked: true })
      ;(prisma.notification.create as jest.Mock).mockResolvedValue({
        id: 'notif-1',
        userId: 'tutor-1',
        message: 'New booking request',
        read: false,
        createdAt: new Date(),
      })

      const bookingReq = new Request('http://localhost/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          studentId: 'student-1',
          tutorId: 'tutor-1',
          slotId: 'slot-1',
        }),
      })
      const bookingRes = await createBooking(bookingReq)
      expect(bookingRes.status).toBe(201)

      // Step 2: Tutor rejects the booking
      ;(prisma.booking.update as jest.Mock).mockResolvedValue(rejectedBooking)
      ;(prisma.timeSlot.update as jest.Mock).mockResolvedValue({ ...mockSlot, isBooked: false })
      ;(prisma.notification.create as jest.Mock).mockResolvedValue({
        id: 'notif-2',
        userId: 'student-1',
        message: 'Your booking has been rejected',
        read: false,
        createdAt: new Date(),
      })

      const patchReq = new Request('http://localhost/api/bookings/booking-1', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'REJECTED' }),
      })
      const patchCtx = { params: Promise.resolve({ id: 'booking-1' }) }
      const patchRes = await updateBookingStatus(patchReq as any, patchCtx as any)
      const patchData = await patchRes.json()

      expect(patchRes.status).toBe(200)
      expect(patchData.status).toBe('REJECTED')

      // Verify slot was freed
      expect(prisma.timeSlot.update).toHaveBeenLastCalledWith({
        where: { id: 'slot-1' },
        data: { isBooked: false },
      })

      // Verify student was notified
      expect(prisma.notification.create).toHaveBeenLastCalledWith({
        data: {
          userId: 'student-1',
          message: 'Your booking has been rejected',
        },
      })
    })
  })

  describe('Booking cancellation flow', () => {
    it('should create booking → student cancels → slot freed → tutor notified', async () => {
      const mockSlot = {
        id: 'slot-1',
        tutorId: 'tutor-1',
        date: new Date('2025-01-15'),
        startTime: new Date('2025-01-15T10:00:00'),
        endTime: new Date('2025-01-15T11:00:00'),
        isBooked: false,
      }

      const mockBooking = {
        id: 'booking-1',
        studentId: 'student-1',
        tutorId: 'tutor-1',
        slotId: 'slot-1',
        status: 'PENDING',
        createdAt: new Date(),
      }

      const cancelledBooking = {
        ...mockBooking,
        status: 'CANCELLED',
      }

      // Step 1: Create booking
      ;(prisma.timeSlot.findUnique as jest.Mock).mockResolvedValue(mockSlot)
      ;(prisma.booking.create as jest.Mock).mockResolvedValue(mockBooking)
      ;(prisma.timeSlot.update as jest.Mock).mockResolvedValue({ ...mockSlot, isBooked: true })
      ;(prisma.notification.create as jest.Mock).mockResolvedValue({
        id: 'notif-1',
        userId: 'tutor-1',
        message: 'New booking request',
        read: false,
        createdAt: new Date(),
      })

      const bookingReq = new Request('http://localhost/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          studentId: 'student-1',
          tutorId: 'tutor-1',
          slotId: 'slot-1',
        }),
      })
      const bookingRes = await createBooking(bookingReq)
      expect(bookingRes.status).toBe(201)

      // Step 2: Student cancels the booking
      ;(prisma.booking.update as jest.Mock).mockResolvedValue(cancelledBooking)
      ;(prisma.timeSlot.update as jest.Mock).mockResolvedValue({ ...mockSlot, isBooked: false })
      ;(prisma.notification.create as jest.Mock).mockResolvedValue({
        id: 'notif-2',
        userId: 'student-1',
        message: 'Your booking has been cancelled',
        read: false,
        createdAt: new Date(),
      })

      const patchReq = new Request('http://localhost/api/bookings/booking-1', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'CANCELLED' }),
      })
      const patchCtx = { params: Promise.resolve({ id: 'booking-1' }) }
      const patchRes = await updateBookingStatus(patchReq as any, patchCtx as any)
      const patchData = await patchRes.json()

      expect(patchRes.status).toBe(200)
      expect(patchData.status).toBe('CANCELLED')

      // Verify slot was freed
      expect(prisma.timeSlot.update).toHaveBeenLastCalledWith({
        where: { id: 'slot-1' },
        data: { isBooked: false },
      })

      // Verify student was notified of cancellation
      expect(prisma.notification.create).toHaveBeenLastCalledWith({
        data: {
          userId: 'student-1',
          message: 'Your booking has been cancelled',
        },
      })
    })
  })

  describe('Double booking prevention', () => {
    it('should reject booking an already booked slot', async () => {
      const bookedSlot = {
        id: 'slot-1',
        tutorId: 'tutor-1',
        date: new Date('2025-01-15'),
        startTime: new Date('2025-01-15T10:00:00'),
        endTime: new Date('2025-01-15T11:00:00'),
        isBooked: true,
      }

      const unbookedSlot = { ...bookedSlot, isBooked: false }

      const mockBooking = {
        id: 'booking-1',
        studentId: 'student-1',
        tutorId: 'tutor-1',
        slotId: 'slot-1',
        status: 'PENDING',
        createdAt: new Date(),
      }

      // First booking succeeds
      ;(prisma.timeSlot.findUnique as jest.Mock)
        .mockResolvedValueOnce(unbookedSlot) // First check: slot available
        .mockResolvedValueOnce(bookedSlot) // Second check: slot now booked
      ;(prisma.booking.create as jest.Mock).mockResolvedValue(mockBooking)
      ;(prisma.timeSlot.update as jest.Mock).mockResolvedValue(bookedSlot)
      ;(prisma.notification.create as jest.Mock).mockResolvedValue({
        id: 'notif-1',
        userId: 'tutor-1',
        message: 'New booking request',
        read: false,
        createdAt: new Date(),
      })

      // Step 1: First student books successfully
      const firstReq = new Request('http://localhost/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          studentId: 'student-1',
          tutorId: 'tutor-1',
          slotId: 'slot-1',
        }),
      })
      const firstRes = await createBooking(firstReq)
      expect(firstRes.status).toBe(201)

      // Step 2: Second student tries to book same slot
      const secondReq = new Request('http://localhost/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          studentId: 'student-2',
          tutorId: 'tutor-1',
          slotId: 'slot-1',
        }),
      })
      const secondRes = await createBooking(secondReq)
      const secondData = await secondRes.json()

      expect(secondRes.status).toBe(400)
      expect(secondData.error).toBe('Slot is not available')
    })
  })

  describe('Error handling', () => {
    it('should not leave data inconsistent if booking creation fails', async () => {
      const mockSlot = {
        id: 'slot-1',
        tutorId: 'tutor-1',
        date: new Date('2025-01-15'),
        startTime: new Date('2025-01-15T10:00:00'),
        endTime: new Date('2025-01-15T11:00:00'),
        isBooked: false,
      }

      // Slot lookup succeeds but booking creation throws
      ;(prisma.timeSlot.findUnique as jest.Mock).mockResolvedValue(mockSlot)
      ;(prisma.booking.create as jest.Mock).mockRejectedValue(new Error('Database error'))

      const req = new Request('http://localhost/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          studentId: 'student-1',
          tutorId: 'tutor-1',
          slotId: 'slot-1',
        }),
      })
      const res = await createBooking(req)
      const data = await res.json()

      expect(res.status).toBe(500)
      expect(data.error).toBe('Internal server error')

      // Verify slot was NOT marked as booked (consistency preserved)
      expect(prisma.timeSlot.update).not.toHaveBeenCalled()
      // Verify no notification was created
      expect(prisma.notification.create).not.toHaveBeenCalled()
    })

    it('should return 400 when slot does not exist', async () => {
      ;(prisma.timeSlot.findUnique as jest.Mock).mockResolvedValue(null)

      const req = new Request('http://localhost/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          studentId: 'student-1',
          tutorId: 'tutor-1',
          slotId: 'nonexistent-slot',
        }),
      })
      const res = await createBooking(req)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toBe('Slot is not available')
      expect(prisma.booking.create).not.toHaveBeenCalled()
    })
  })
})
