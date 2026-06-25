/**
 * @jest-environment node
 */
import { POST as createBooking } from '@/app/api/bookings/route'
import { PATCH as updateBookingStatus } from '@/app/api/bookings/[id]/route'
import { GET as getNotifications, PATCH as markNotificationRead } from '@/app/api/notifications/route'
import { prisma } from '@/lib/prisma'

describe('Notification Flow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Notification on booking creation', () => {
    it('should create booking → verify notification created for tutor', async () => {
      const mockSlot = {
        id: 'slot-1',
        tutorId: 'tutor-1',
        date: new Date('2025-01-20'),
        startTime: new Date('2025-01-20T14:00:00'),
        endTime: new Date('2025-01-20T15:00:00'),
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

      ;(prisma.timeSlot.findUnique as jest.Mock).mockResolvedValue(mockSlot)
      ;(prisma.booking.create as jest.Mock).mockResolvedValue(mockBooking)
      ;(prisma.timeSlot.update as jest.Mock).mockResolvedValue({ ...mockSlot, isBooked: true })
      ;(prisma.notification.create as jest.Mock).mockResolvedValue(mockNotification)

      // Step 1: Create booking
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

      // Verify notification was created for the tutor
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'tutor-1',
          message: expect.stringContaining('New booking request'),
        },
      })

      // Step 2: Verify notification appears in tutor's notifications
      ;(prisma.notification.findMany as jest.Mock).mockResolvedValue([mockNotification])

      const notifReq = new Request('http://localhost/api/notifications?userId=tutor-1')
      const notifRes = await getNotifications(notifReq)
      const notifData = await notifRes.json()

      expect(notifRes.status).toBe(200)
      expect(notifData).toHaveLength(1)
      expect(notifData[0].userId).toBe('tutor-1')
      expect(notifData[0].message).toContain('New booking request')
      expect(notifData[0].read).toBe(false)
    })
  })

  describe('Notification on status change', () => {
    it('should update booking status → verify notification for student', async () => {
      const mockBooking = {
        id: 'booking-1',
        studentId: 'student-1',
        tutorId: 'tutor-1',
        slotId: 'slot-1',
        status: 'CONFIRMED',
      }

      const mockNotification = {
        id: 'notif-2',
        userId: 'student-1',
        message: 'Your booking has been confirmed',
        read: false,
        createdAt: new Date(),
      }

      ;(prisma.booking.update as jest.Mock).mockResolvedValue(mockBooking)
      ;(prisma.notification.create as jest.Mock).mockResolvedValue(mockNotification)

      // Step 1: Update booking status to CONFIRMED
      const patchReq = new Request('http://localhost/api/bookings/booking-1', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'CONFIRMED' }),
      })
      const patchCtx = { params: Promise.resolve({ id: 'booking-1' }) }
      const patchRes = await updateBookingStatus(patchReq as any, patchCtx as any)
      expect(patchRes.status).toBe(200)

      // Verify notification was created for the student
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'student-1',
          message: 'Your booking has been confirmed',
        },
      })

      // Step 2: Verify student can see the notification
      ;(prisma.notification.findMany as jest.Mock).mockResolvedValue([mockNotification])

      const notifReq = new Request('http://localhost/api/notifications?userId=student-1')
      const notifRes = await getNotifications(notifReq)
      const notifData = await notifRes.json()

      expect(notifRes.status).toBe(200)
      expect(notifData).toHaveLength(1)
      expect(notifData[0].message).toBe('Your booking has been confirmed')
    })
  })

  describe('Mark notification as read', () => {
    it('should create notification → mark as read → verify read=true', async () => {
      const mockSlot = {
        id: 'slot-1',
        tutorId: 'tutor-1',
        date: new Date('2025-01-20'),
        startTime: new Date('2025-01-20T14:00:00'),
        endTime: new Date('2025-01-20T15:00:00'),
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

      const unreadNotification = {
        id: 'notif-1',
        userId: 'tutor-1',
        message: 'New booking request for slot on 1/20/2025',
        read: false,
        createdAt: new Date(),
      }

      const readNotification = {
        ...unreadNotification,
        read: true,
      }

      // Step 1: Create a booking (which creates a notification)
      ;(prisma.timeSlot.findUnique as jest.Mock).mockResolvedValue(mockSlot)
      ;(prisma.booking.create as jest.Mock).mockResolvedValue(mockBooking)
      ;(prisma.timeSlot.update as jest.Mock).mockResolvedValue({ ...mockSlot, isBooked: true })
      ;(prisma.notification.create as jest.Mock).mockResolvedValue(unreadNotification)

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

      // Step 2: Mark notification as read
      ;(prisma.notification.update as jest.Mock).mockResolvedValue(readNotification)

      const markReadReq = new Request('http://localhost/api/notifications', {
        method: 'PATCH',
        body: JSON.stringify({ notificationId: 'notif-1' }),
      })
      const markReadRes = await markNotificationRead(markReadReq)
      const markReadData = await markReadRes.json()

      expect(markReadRes.status).toBe(200)
      expect(markReadData.read).toBe(true)

      // Verify prisma was called correctly
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { read: true },
      })
    })
  })

  describe('Notification ordering', () => {
    it('should create multiple notifications → verify returned in createdAt desc order', async () => {
      const now = new Date()
      const earlier = new Date(now.getTime() - 60000)
      const earliest = new Date(now.getTime() - 120000)

      const notifications = [
        {
          id: 'notif-3',
          userId: 'tutor-1',
          message: 'Third notification (newest)',
          read: false,
          createdAt: now,
        },
        {
          id: 'notif-2',
          userId: 'tutor-1',
          message: 'Second notification',
          read: false,
          createdAt: earlier,
        },
        {
          id: 'notif-1',
          userId: 'tutor-1',
          message: 'First notification (oldest)',
          read: false,
          createdAt: earliest,
        },
      ]

      // Mock findMany to return in desc order (as the implementation does)
      ;(prisma.notification.findMany as jest.Mock).mockResolvedValue(notifications)

      const req = new Request('http://localhost/api/notifications?userId=tutor-1')
      const res = await getNotifications(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data).toHaveLength(3)

      // Verify ordering: most recent first
      expect(data[0].id).toBe('notif-3')
      expect(data[1].id).toBe('notif-2')
      expect(data[2].id).toBe('notif-1')

      // Verify findMany was called with orderBy createdAt desc
      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'tutor-1' },
        orderBy: { createdAt: 'desc' },
      })
    })
  })
})
