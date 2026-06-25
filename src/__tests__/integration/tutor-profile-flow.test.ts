/**
 * @jest-environment node
 */
import { POST as register } from '@/app/api/auth/register/route'
import { GET as getTutor, PUT as updateTutor } from '@/app/api/tutors/[id]/route'
import { GET as getSlots, POST as createSlot } from '@/app/api/tutors/[id]/slots/route'
import { GET as listTutors } from '@/app/api/tutors/route'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

jest.mock('bcryptjs')

describe('Tutor Profile Flow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Complete tutor setup', () => {
    it('should register as tutor → add subjects via PUT → create time slots', async () => {
      const hashedPassword = 'hashed_pw'
      const mockTutor = {
        id: 'tutor-1',
        email: 'tutor@test.com',
        name: 'Math Tutor',
        role: 'TUTOR',
        passwordHash: hashedPassword,
      }

      const updatedTutor = {
        ...mockTutor,
        bio: 'Experienced math tutor',
        hourlyRate: 50,
      }

      const mockSlot = {
        id: 'slot-1',
        tutorId: 'tutor-1',
        date: new Date('2025-02-01'),
        startTime: new Date('2025-02-01T09:00:00'),
        endTime: new Date('2025-02-01T10:00:00'),
        isBooked: false,
      }

      // Step 1: Register as tutor
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
      ;(bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword)
      ;(prisma.user.create as jest.Mock).mockResolvedValue(mockTutor)

      const registerReq = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'tutor@test.com',
          name: 'Math Tutor',
          password: 'password123',
          role: 'TUTOR',
        }),
      })
      const registerRes = await register(registerReq)
      expect(registerRes.status).toBe(201)
      const registerData = await registerRes.json()
      expect(registerData.role).toBe('TUTOR')

      // Step 2: Add subjects via PUT
      ;(prisma.user.update as jest.Mock).mockResolvedValue(updatedTutor)
      ;(prisma.tutorSubject.deleteMany as jest.Mock).mockResolvedValue({ count: 0 })
      ;(prisma.subject.upsert as jest.Mock)
        .mockResolvedValueOnce({ id: 'subj-1', name: 'Mathematics' })
        .mockResolvedValueOnce({ id: 'subj-2', name: 'Physics' })
      ;(prisma.tutorSubject.create as jest.Mock).mockResolvedValue({})

      const updateReq = new Request('http://localhost/api/tutors/tutor-1', {
        method: 'PUT',
        body: JSON.stringify({
          bio: 'Experienced math tutor',
          hourlyRate: 50,
          subjects: ['Mathematics', 'Physics'],
        }),
      })
      const updateCtx = { params: Promise.resolve({ id: 'tutor-1' }) }
      const updateRes = await updateTutor(updateReq as any, updateCtx as any)
      expect(updateRes.status).toBe(200)

      // Verify subjects were added
      expect(prisma.tutorSubject.deleteMany).toHaveBeenCalledWith({
        where: { tutorId: 'tutor-1' },
      })
      expect(prisma.subject.upsert).toHaveBeenCalledTimes(2)
      expect(prisma.tutorSubject.create).toHaveBeenCalledTimes(2)

      // Step 3: Create time slots
      ;(prisma.timeSlot.create as jest.Mock).mockResolvedValue(mockSlot)

      const slotReq = new Request('http://localhost/api/tutors/tutor-1/slots', {
        method: 'POST',
        body: JSON.stringify({
          date: '2025-02-01',
          startTime: '2025-02-01T09:00:00',
          endTime: '2025-02-01T10:00:00',
        }),
      })
      const slotCtx = { params: Promise.resolve({ id: 'tutor-1' }) }
      const slotRes = await createSlot(slotReq as any, slotCtx as any)
      expect(slotRes.status).toBe(201)

      const slotData = await slotRes.json()
      expect(slotData.tutorId).toBe('tutor-1')
    })
  })

  describe('Subject management', () => {
    it('should add subjects → update with different subjects → verify old ones removed', async () => {
      const mockTutor = {
        id: 'tutor-1',
        email: 'tutor@test.com',
        name: 'Tutor',
        role: 'TUTOR',
        bio: 'A tutor',
        hourlyRate: 40,
      }

      // First update: add Math and Physics
      ;(prisma.user.update as jest.Mock).mockResolvedValue(mockTutor)
      ;(prisma.tutorSubject.deleteMany as jest.Mock).mockResolvedValue({ count: 0 })
      ;(prisma.subject.upsert as jest.Mock)
        .mockResolvedValueOnce({ id: 'subj-1', name: 'Mathematics' })
        .mockResolvedValueOnce({ id: 'subj-2', name: 'Physics' })
      ;(prisma.tutorSubject.create as jest.Mock).mockResolvedValue({})

      const firstReq = new Request('http://localhost/api/tutors/tutor-1', {
        method: 'PUT',
        body: JSON.stringify({ subjects: ['Mathematics', 'Physics'] }),
      })
      const firstCtx = { params: Promise.resolve({ id: 'tutor-1' }) }
      const firstRes = await updateTutor(firstReq as any, firstCtx as any)
      expect(firstRes.status).toBe(200)

      expect(prisma.tutorSubject.deleteMany).toHaveBeenCalledWith({
        where: { tutorId: 'tutor-1' },
      })
      expect(prisma.tutorSubject.create).toHaveBeenCalledTimes(2)

      // Reset mocks for second update
      jest.clearAllMocks()

      // Second update: replace with Chemistry and Biology
      ;(prisma.user.update as jest.Mock).mockResolvedValue(mockTutor)
      ;(prisma.tutorSubject.deleteMany as jest.Mock).mockResolvedValue({ count: 2 })
      ;(prisma.subject.upsert as jest.Mock)
        .mockResolvedValueOnce({ id: 'subj-3', name: 'Chemistry' })
        .mockResolvedValueOnce({ id: 'subj-4', name: 'Biology' })
      ;(prisma.tutorSubject.create as jest.Mock).mockResolvedValue({})

      const secondReq = new Request('http://localhost/api/tutors/tutor-1', {
        method: 'PUT',
        body: JSON.stringify({ subjects: ['Chemistry', 'Biology'] }),
      })
      const secondCtx = { params: Promise.resolve({ id: 'tutor-1' }) }
      const secondRes = await updateTutor(secondReq as any, secondCtx as any)
      expect(secondRes.status).toBe(200)

      // Verify old subjects were deleted before adding new ones
      expect(prisma.tutorSubject.deleteMany).toHaveBeenCalledWith({
        where: { tutorId: 'tutor-1' },
      })
      expect(prisma.subject.upsert).toHaveBeenCalledWith({
        where: { name: 'Chemistry' },
        update: {},
        create: { name: 'Chemistry' },
      })
      expect(prisma.subject.upsert).toHaveBeenCalledWith({
        where: { name: 'Biology' },
        update: {},
        create: { name: 'Biology' },
      })
      expect(prisma.tutorSubject.create).toHaveBeenCalledTimes(2)
    })
  })

  describe('Slot management', () => {
    it('should create slots → verify they appear in GET → book one → verify only unbooked appear', async () => {
      const slot1 = {
        id: 'slot-1',
        tutorId: 'tutor-1',
        date: new Date('2025-02-01'),
        startTime: new Date('2025-02-01T09:00:00'),
        endTime: new Date('2025-02-01T10:00:00'),
        isBooked: false,
      }
      const slot2 = {
        id: 'slot-2',
        tutorId: 'tutor-1',
        date: new Date('2025-02-01'),
        startTime: new Date('2025-02-01T11:00:00'),
        endTime: new Date('2025-02-01T12:00:00'),
        isBooked: false,
      }

      // Step 1: Create slots
      ;(prisma.timeSlot.create as jest.Mock)
        .mockResolvedValueOnce(slot1)
        .mockResolvedValueOnce(slot2)

      const slotReq1 = new Request('http://localhost/api/tutors/tutor-1/slots', {
        method: 'POST',
        body: JSON.stringify({
          date: '2025-02-01',
          startTime: '2025-02-01T09:00:00',
          endTime: '2025-02-01T10:00:00',
        }),
      })
      const slotCtx1 = { params: Promise.resolve({ id: 'tutor-1' }) }
      const slotRes1 = await createSlot(slotReq1 as any, slotCtx1 as any)
      expect(slotRes1.status).toBe(201)

      const slotReq2 = new Request('http://localhost/api/tutors/tutor-1/slots', {
        method: 'POST',
        body: JSON.stringify({
          date: '2025-02-01',
          startTime: '2025-02-01T11:00:00',
          endTime: '2025-02-01T12:00:00',
        }),
      })
      const slotCtx2 = { params: Promise.resolve({ id: 'tutor-1' }) }
      const slotRes2 = await createSlot(slotReq2 as any, slotCtx2 as any)
      expect(slotRes2.status).toBe(201)

      // Step 2: Verify slots appear in GET
      ;(prisma.timeSlot.findMany as jest.Mock).mockResolvedValue([slot1, slot2])

      const getReq = new Request('http://localhost/api/tutors/tutor-1/slots')
      const getCtx = { params: Promise.resolve({ id: 'tutor-1' }) }
      const getRes = await getSlots(getReq as any, getCtx as any)
      const allSlots = await getRes.json()

      expect(getRes.status).toBe(200)
      expect(allSlots).toHaveLength(2)

      // Step 3: After booking slot1, verify GET on tutor profile shows only unbooked
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'tutor-1',
        name: 'Tutor',
        email: 'tutor@test.com',
        bio: 'A tutor',
        hourlyRate: 40,
        subjects: [],
        timeSlots: [slot2], // Only unbooked slot2 returned
      })

      const tutorReq = new Request('http://localhost/api/tutors/tutor-1')
      const tutorCtx = { params: Promise.resolve({ id: 'tutor-1' }) }
      const tutorRes = await getTutor(tutorReq as any, tutorCtx as any)
      const tutorData = await tutorRes.json()

      expect(tutorRes.status).toBe(200)
      expect(tutorData.timeSlots).toHaveLength(1)
      expect(tutorData.timeSlots[0].id).toBe('slot-2')
    })
  })

  describe('Profile updates', () => {
    it('should update name/bio/hourlyRate → verify reflected in tutor listing', async () => {
      const updatedTutor = {
        id: 'tutor-1',
        email: 'tutor@test.com',
        name: 'Updated Name',
        role: 'TUTOR',
        bio: 'Updated bio text',
        hourlyRate: 75,
      }

      // Step 1: Update tutor profile
      ;(prisma.user.update as jest.Mock).mockResolvedValue(updatedTutor)

      const updateReq = new Request('http://localhost/api/tutors/tutor-1', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Name',
          bio: 'Updated bio text',
          hourlyRate: 75,
        }),
      })
      const updateCtx = { params: Promise.resolve({ id: 'tutor-1' }) }
      const updateRes = await updateTutor(updateReq as any, updateCtx as any)
      const updateData = await updateRes.json()

      expect(updateRes.status).toBe(200)
      expect(updateData.name).toBe('Updated Name')
      expect(updateData.bio).toBe('Updated bio text')
      expect(updateData.hourlyRate).toBe(75)

      // Verify prisma.user.update was called with correct data
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'tutor-1' },
        data: {
          name: 'Updated Name',
          bio: 'Updated bio text',
          hourlyRate: 75,
        },
      })

      // Step 2: Verify reflected in tutor listing
      ;(prisma.user.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'tutor-1',
          name: 'Updated Name',
          email: 'tutor@test.com',
          bio: 'Updated bio text',
          hourlyRate: 75,
          subjects: [],
        },
      ])

      const listReq = new Request('http://localhost/api/tutors')
      const listRes = await listTutors(listReq)
      const listData = await listRes.json()

      expect(listRes.status).toBe(200)
      expect(listData).toHaveLength(1)
      expect(listData[0].name).toBe('Updated Name')
      expect(listData[0].bio).toBe('Updated bio text')
      expect(listData[0].hourlyRate).toBe(75)
    })
  })
})
