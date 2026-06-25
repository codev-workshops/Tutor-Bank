/**
 * @jest-environment node
 */
import { GET, POST } from '@/app/api/subjects/route'
import { prisma } from '@/lib/prisma'

describe('GET /api/subjects', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should retrieve all subjects', async () => {
    const mockSubjects = [
      { id: 'sub-1', name: 'Biology' },
      { id: 'sub-2', name: 'Math' },
    ]
    ;(prisma.subject.findMany as jest.Mock).mockResolvedValue(mockSubjects)

    const request = new Request('http://localhost/api/subjects', {
      method: 'GET',
    })

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(2)
  })

  it('should order subjects by name asc', async () => {
    ;(prisma.subject.findMany as jest.Mock).mockResolvedValue([])

    await GET()

    expect(prisma.subject.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { name: 'asc' },
      })
    )
  })

  it('should return only id and name', async () => {
    ;(prisma.subject.findMany as jest.Mock).mockResolvedValue([])

    await GET()

    expect(prisma.subject.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true, name: true },
      })
    )
  })

  it('should handle database errors gracefully (500)', async () => {
    ;(prisma.subject.findMany as jest.Mock).mockRejectedValue(
      new Error('DB error')
    )

    const response = await GET()
    expect(response.status).toBe(500)
  })
})

describe('POST /api/subjects', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should create a new subject (returns 201)', async () => {
    ;(prisma.subject.upsert as jest.Mock).mockResolvedValue({
      id: 'sub-1',
      name: 'Chemistry',
    })

    const request = new Request('http://localhost/api/subjects', {
      method: 'POST',
      body: JSON.stringify({ name: 'Chemistry' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.name).toBe('Chemistry')
  })

  it('should upsert existing subject (no duplicate)', async () => {
    ;(prisma.subject.upsert as jest.Mock).mockResolvedValue({
      id: 'sub-1',
      name: 'Math',
    })

    const request = new Request('http://localhost/api/subjects', {
      method: 'POST',
      body: JSON.stringify({ name: 'Math' }),
    })

    await POST(request)

    expect(prisma.subject.upsert).toHaveBeenCalledWith({
      where: { name: 'Math' },
      update: {},
      create: { name: 'Math' },
    })
  })

  it('should return 400 when name is missing', async () => {
    const request = new Request('http://localhost/api/subjects', {
      method: 'POST',
      body: JSON.stringify({}),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('should handle database errors gracefully (500)', async () => {
    ;(prisma.subject.upsert as jest.Mock).mockRejectedValue(
      new Error('DB error')
    )

    const request = new Request('http://localhost/api/subjects', {
      method: 'POST',
      body: JSON.stringify({ name: 'Chemistry' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(500)
  })
})
