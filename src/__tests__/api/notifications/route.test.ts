/**
 * @jest-environment node
 */
import { GET, PATCH } from '@/app/api/notifications/route'
import { prisma } from '@/lib/prisma'

describe('GET /api/notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should retrieve notifications for a user', async () => {
    const mockNotifications = [
      {
        id: 'notif-1',
        userId: 'user-1',
        message: 'New booking',
        read: false,
        createdAt: '2025-01-15T10:00:00Z',
      },
    ]
    ;(prisma.notification.findMany as jest.Mock).mockResolvedValue(
      mockNotifications
    )

    const request = new Request(
      'http://localhost/api/notifications?userId=user-1',
      { method: 'GET' }
    )

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(1)
    expect(data[0].userId).toBe('user-1')
  })

  it('should order notifications by createdAt desc', async () => {
    ;(prisma.notification.findMany as jest.Mock).mockResolvedValue([])

    const request = new Request(
      'http://localhost/api/notifications?userId=user-1',
      { method: 'GET' }
    )

    await GET(request)

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
      })
    )
  })

  it('should return 400 when userId is missing', async () => {
    const request = new Request('http://localhost/api/notifications', {
      method: 'GET',
    })

    const response = await GET(request)
    expect(response.status).toBe(400)
  })

  it('should handle database errors gracefully (500)', async () => {
    ;(prisma.notification.findMany as jest.Mock).mockRejectedValue(
      new Error('DB error')
    )

    const request = new Request(
      'http://localhost/api/notifications?userId=user-1',
      { method: 'GET' }
    )

    const response = await GET(request)
    expect(response.status).toBe(500)
  })
})

describe('PATCH /api/notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should mark notification as read', async () => {
    ;(prisma.notification.update as jest.Mock).mockResolvedValue({
      id: 'notif-1',
      userId: 'user-1',
      message: 'New booking',
      read: true,
    })

    const request = new Request('http://localhost/api/notifications', {
      method: 'PATCH',
      body: JSON.stringify({ notificationId: 'notif-1' }),
    })

    const response = await PATCH(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.read).toBe(true)
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data: { read: true },
    })
  })

  it('should return 400 when notificationId is missing', async () => {
    const request = new Request('http://localhost/api/notifications', {
      method: 'PATCH',
      body: JSON.stringify({}),
    })

    const response = await PATCH(request)
    expect(response.status).toBe(400)
  })

  it('should handle database errors gracefully (500)', async () => {
    ;(prisma.notification.update as jest.Mock).mockRejectedValue(
      new Error('DB error')
    )

    const request = new Request('http://localhost/api/notifications', {
      method: 'PATCH',
      body: JSON.stringify({ notificationId: 'notif-1' }),
    })

    const response = await PATCH(request)
    expect(response.status).toBe(500)
  })
})
