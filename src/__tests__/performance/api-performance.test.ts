/**
 * @jest-environment node
 */
import { POST as registerPost } from '@/app/api/auth/register/route'
import { POST as loginPost } from '@/app/api/auth/login/route'
import { GET as getTutors } from '@/app/api/tutors/route'
import { GET as getTutor } from '@/app/api/tutors/[id]/route'
import { POST as createBooking, GET as getBookings } from '@/app/api/bookings/route'
import { PATCH as updateBooking } from '@/app/api/bookings/[id]/route'
import { GET as getSubjects } from '@/app/api/subjects/route'
import { GET as getNotifications } from '@/app/api/notifications/route'
import { POST as createSlot, GET as getSlots } from '@/app/api/tutors/[id]/slots/route'
import { prisma } from '@/lib/prisma'

describe('API Performance', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Response Time Benchmarks', () => {
    it('should handle registration within acceptable time', async () => {
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
      ;(prisma.user.create as jest.Mock).mockResolvedValue({
        id: '1',
        email: 'test@test.com',
        name: 'Test',
        role: 'STUDENT',
      })

      const start = performance.now()
      const request = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@test.com',
          name: 'Test',
          password: 'password123',
        }),
      })
      const response = await registerPost(request)
      const duration = performance.now() - start

      expect(response.status).toBe(201)
      expect(duration).toBeLessThan(1000)
    })

    it('should handle login within acceptable time', async () => {
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: '1',
        email: 'test@test.com',
        name: 'Test',
        role: 'STUDENT',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01',
      })

      const bcrypt = require('bcryptjs')
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true)

      const start = performance.now()
      const request = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@test.com',
          password: 'password123',
        }),
      })
      const response = await loginPost(request)
      const duration = performance.now() - start

      expect(response.status).toBe(200)
      expect(duration).toBeLessThan(1000)
    })

    it('should handle tutor listing within acceptable time', async () => {
      ;(prisma.user.findMany as jest.Mock).mockResolvedValue([
        { id: '1', name: 'Tutor', email: 'tutor@test.com', bio: 'Bio', hourlyRate: 50, subjects: [] },
      ])

      const start = performance.now()
      const request = new Request('http://localhost/api/tutors')
      const response = await getTutors(request)
      const duration = performance.now() - start

      expect(response.status).toBe(200)
      expect(duration).toBeLessThan(500)
    })

    it('should handle tutor detail within acceptable time', async () => {
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: '1',
        name: 'Tutor',
        email: 'tutor@test.com',
        bio: 'Bio',
        hourlyRate: 50,
        subjects: [],
        timeSlots: [],
      })

      const start = performance.now()
      const request = new Request('http://localhost/api/tutors/1')
      const ctx = { params: Promise.resolve({ id: '1' }) }
      const response = await getTutor(request as any, ctx as any)
      const duration = performance.now() - start

      expect(response.status).toBe(200)
      expect(duration).toBeLessThan(500)
    })

    it('should handle booking creation within acceptable time', async () => {
      ;(prisma.timeSlot.findUnique as jest.Mock).mockResolvedValue({
        id: 'slot-1',
        isBooked: false,
        date: new Date(),
      })
      ;(prisma.booking.create as jest.Mock).mockResolvedValue({
        id: 'booking-1',
        studentId: 'student-1',
        tutorId: 'tutor-1',
        slotId: 'slot-1',
      })
      ;(prisma.timeSlot.update as jest.Mock).mockResolvedValue({})
      ;(prisma.notification.create as jest.Mock).mockResolvedValue({})

      const start = performance.now()
      const request = new Request('http://localhost/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          studentId: 'student-1',
          tutorId: 'tutor-1',
          slotId: 'slot-1',
        }),
      })
      const response = await createBooking(request)
      const duration = performance.now() - start

      expect(response.status).toBe(201)
      expect(duration).toBeLessThan(500)
    })

    it('should handle booking status update within acceptable time', async () => {
      ;(prisma.booking.update as jest.Mock).mockResolvedValue({
        id: 'booking-1',
        studentId: 'student-1',
        tutorId: 'tutor-1',
        slotId: 'slot-1',
        status: 'CONFIRMED',
      })
      ;(prisma.notification.create as jest.Mock).mockResolvedValue({})

      const start = performance.now()
      const request = new Request('http://localhost/api/bookings/1', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'CONFIRMED' }),
      })
      const ctx = { params: Promise.resolve({ id: '1' }) }
      const response = await updateBooking(request as any, ctx as any)
      const duration = performance.now() - start

      expect(response.status).toBe(200)
      expect(duration).toBeLessThan(500)
    })

    it('should handle slot creation within acceptable time', async () => {
      ;(prisma.timeSlot.create as jest.Mock).mockResolvedValue({
        id: 'slot-1',
        tutorId: 'tutor-1',
        date: new Date(),
        startTime: new Date(),
        endTime: new Date(),
      })

      const start = performance.now()
      const request = new Request('http://localhost/api/tutors/1/slots', {
        method: 'POST',
        body: JSON.stringify({
          date: '2025-01-15',
          startTime: '2025-01-15T09:00:00Z',
          endTime: '2025-01-15T10:00:00Z',
        }),
      })
      const ctx = { params: Promise.resolve({ id: '1' }) }
      const response = await createSlot(request as any, ctx as any)
      const duration = performance.now() - start

      expect(response.status).toBe(201)
      expect(duration).toBeLessThan(500)
    })

    it('should handle notification retrieval within acceptable time', async () => {
      ;(prisma.notification.findMany as jest.Mock).mockResolvedValue([
        { id: '1', userId: 'user-1', message: 'Test', read: false, createdAt: new Date() },
      ])

      const start = performance.now()
      const request = new Request('http://localhost/api/notifications?userId=user-1')
      const response = await getNotifications(request)
      const duration = performance.now() - start

      expect(response.status).toBe(200)
      expect(duration).toBeLessThan(500)
    })
  })

  describe('Concurrent Request Handling', () => {
    it('should handle multiple concurrent registrations without interference', async () => {
      let callCount = 0
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
      ;(prisma.user.create as jest.Mock).mockImplementation(async (args) => {
        callCount++
        return {
          id: String(callCount),
          email: args.data.email,
          name: args.data.name,
          role: args.data.role,
        }
      })

      const requests = Array.from({ length: 10 }, (_, i) =>
        registerPost(
          new Request('http://localhost/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({
              email: `user${i}@test.com`,
              name: `User ${i}`,
              password: 'password123',
            }),
          })
        )
      )

      const responses = await Promise.all(requests)

      for (const response of responses) {
        expect(response.status).toBe(201)
      }
      expect(callCount).toBe(10)
    })

    it('should handle multiple concurrent tutor searches without interference', async () => {
      ;(prisma.user.findMany as jest.Mock).mockResolvedValue([
        { id: '1', name: 'Math Tutor', email: 'math@test.com', bio: 'Bio', hourlyRate: 50, subjects: [] },
      ])

      const requests = Array.from({ length: 10 }, (_, i) =>
        getTutors(new Request(`http://localhost/api/tutors?name=tutor${i}`))
      )

      const responses = await Promise.all(requests)

      for (const response of responses) {
        expect(response.status).toBe(200)
        const data = await response.json()
        expect(Array.isArray(data)).toBe(true)
      }
    })

    it('should handle concurrent booking retrievals without interference', async () => {
      ;(prisma.booking.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'b1',
          student: { id: 's1', name: 'Student', email: 's@test.com' },
          tutor: { id: 't1', name: 'Tutor', email: 't@test.com' },
          slot: { id: 'slot1', date: new Date(), startTime: '09:00', endTime: '10:00' },
        },
      ])

      const requests = Array.from({ length: 10 }, (_, i) =>
        getBookings(
          new Request(`http://localhost/api/bookings?userId=user${i}&role=STUDENT`)
        )
      )

      const responses = await Promise.all(requests)

      for (const response of responses) {
        expect(response.status).toBe(200)
      }
    })

    it('should handle concurrent notifications retrieval', async () => {
      ;(prisma.notification.findMany as jest.Mock).mockResolvedValue([
        { id: 'n1', userId: 'u1', message: 'Test', read: false, createdAt: new Date() },
      ])

      const requests = Array.from({ length: 10 }, (_, i) =>
        getNotifications(
          new Request(`http://localhost/api/notifications?userId=user${i}`)
        )
      )

      const responses = await Promise.all(requests)

      for (const response of responses) {
        expect(response.status).toBe(200)
      }
    })
  })

  describe('Large Dataset Handling', () => {
    it('should handle large dataset in tutor listing (100+ items)', async () => {
      const largeTutorList = Array.from({ length: 100 }, (_, i) => ({
        id: `tutor-${i}`,
        name: `Tutor ${i}`,
        email: `tutor${i}@test.com`,
        bio: `Bio for tutor ${i} - experienced educator with years of teaching.`,
        hourlyRate: 30 + i,
        subjects: [{ subject: { id: `subj-${i}`, name: `Subject ${i}` } }],
      }))
      ;(prisma.user.findMany as jest.Mock).mockResolvedValue(largeTutorList)

      const request = new Request('http://localhost/api/tutors')
      const response = await getTutors(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveLength(100)
    })

    it('should handle large booking list (100+ items)', async () => {
      const largeBookingList = Array.from({ length: 150 }, (_, i) => ({
        id: `booking-${i}`,
        studentId: `student-${i % 10}`,
        tutorId: `tutor-${i % 5}`,
        slotId: `slot-${i}`,
        status: 'PENDING',
        student: { id: `student-${i % 10}`, name: `Student ${i % 10}`, email: `s${i % 10}@test.com` },
        tutor: { id: `tutor-${i % 5}`, name: `Tutor ${i % 5}`, email: `t${i % 5}@test.com` },
        slot: { id: `slot-${i}`, date: new Date(), startTime: '09:00', endTime: '10:00' },
      }))
      ;(prisma.booking.findMany as jest.Mock).mockResolvedValue(largeBookingList)

      const request = new Request(
        'http://localhost/api/bookings?userId=student-1&role=STUDENT'
      )
      const response = await getBookings(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveLength(150)
    })

    it('should handle large notification list (200+ items)', async () => {
      const largeNotificationList = Array.from({ length: 200 }, (_, i) => ({
        id: `notif-${i}`,
        userId: 'user-1',
        message: `Notification message ${i}`,
        read: i % 2 === 0,
        createdAt: new Date(),
      }))
      ;(prisma.notification.findMany as jest.Mock).mockResolvedValue(largeNotificationList)

      const request = new Request('http://localhost/api/notifications?userId=user-1')
      const response = await getNotifications(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveLength(200)
    })

    it('should handle large time slot list', async () => {
      const largeSlotList = Array.from({ length: 100 }, (_, i) => ({
        id: `slot-${i}`,
        date: new Date(2025, 0, 15 + i),
        startTime: '09:00',
        endTime: '10:00',
        isBooked: i % 3 === 0,
      }))
      ;(prisma.timeSlot.findMany as jest.Mock).mockResolvedValue(largeSlotList)

      const request = new Request('http://localhost/api/tutors/1/slots')
      const ctx = { params: Promise.resolve({ id: '1' }) }
      const response = await getSlots(request as any, ctx as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveLength(100)
    })

    it('should handle large subject list', async () => {
      const largeSubjectList = Array.from({ length: 100 }, (_, i) => ({
        id: `subject-${i}`,
        name: `Subject ${i}`,
      }))
      ;(prisma.subject.findMany as jest.Mock).mockResolvedValue(largeSubjectList)

      const request = new Request('http://localhost/api/subjects')
      const response = await getSubjects(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveLength(100)
    })
  })

  describe('Memory-Efficient Query Patterns', () => {
    it('should use select clause for tutor listing (not fetching all fields)', async () => {
      ;(prisma.user.findMany as jest.Mock).mockResolvedValue([])

      const request = new Request('http://localhost/api/tutors')
      await getTutors(request)

      const call = (prisma.user.findMany as jest.Mock).mock.calls[0][0]
      // Verify select is used to limit fields returned
      expect(call.select).toBeDefined()
      expect(call.select.id).toBe(true)
      expect(call.select.name).toBe(true)
      // Should NOT select passwordHash
      expect(call.select.passwordHash).toBeUndefined()
    })

    it('should use select clause for tutor detail', async () => {
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)

      const request = new Request('http://localhost/api/tutors/1')
      const ctx = { params: Promise.resolve({ id: '1' }) }
      await getTutor(request as any, ctx as any)

      const call = (prisma.user.findUnique as jest.Mock).mock.calls[0][0]
      expect(call.select).toBeDefined()
      expect(call.select.passwordHash).toBeUndefined()
    })

    it('should use select clause for time slots (not fetching unnecessary data)', async () => {
      ;(prisma.timeSlot.findMany as jest.Mock).mockResolvedValue([])

      const request = new Request('http://localhost/api/tutors/1/slots')
      const ctx = { params: Promise.resolve({ id: '1' }) }
      await getSlots(request as any, ctx as any)

      const call = (prisma.timeSlot.findMany as jest.Mock).mock.calls[0][0]
      expect(call.select).toBeDefined()
      expect(call.select.id).toBe(true)
      expect(call.select.date).toBe(true)
    })

    it('should use include with select for booking retrieval (avoiding N+1)', async () => {
      ;(prisma.booking.findMany as jest.Mock).mockResolvedValue([])

      const request = new Request(
        'http://localhost/api/bookings?userId=user-1&role=STUDENT'
      )
      await getBookings(request)

      const call = (prisma.booking.findMany as jest.Mock).mock.calls[0][0]
      // Verify include is used to eager-load related data (avoiding N+1)
      expect(call.include).toBeDefined()
      expect(call.include.student).toBeDefined()
      expect(call.include.tutor).toBeDefined()
      expect(call.include.slot).toBeDefined()
    })

    it('should use select within include for bookings (not fetching all fields of related models)', async () => {
      ;(prisma.booking.findMany as jest.Mock).mockResolvedValue([])

      const request = new Request(
        'http://localhost/api/bookings?userId=user-1&role=STUDENT'
      )
      await getBookings(request)

      const call = (prisma.booking.findMany as jest.Mock).mock.calls[0][0]
      // Verify nested selects exist to limit related data
      expect(call.include.student.select).toBeDefined()
      expect(call.include.tutor.select).toBeDefined()
      expect(call.include.slot.select).toBeDefined()
      // Should not include passwordHash in related user queries
      expect(call.include.student.select.passwordHash).toBeUndefined()
      expect(call.include.tutor.select.passwordHash).toBeUndefined()
    })

    it('should use orderBy for sorted results (database-level sorting)', async () => {
      ;(prisma.booking.findMany as jest.Mock).mockResolvedValue([])

      const request = new Request(
        'http://localhost/api/bookings?userId=user-1&role=STUDENT'
      )
      await getBookings(request)

      const call = (prisma.booking.findMany as jest.Mock).mock.calls[0][0]
      expect(call.orderBy).toBeDefined()
    })
  })
})
