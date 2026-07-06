import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useSession } from 'next-auth/react'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), refresh: jest.fn() }),
}))

const mockFetch = jest.fn() as jest.Mock
global.fetch = mockFetch

import NotificationsPage from '@/app/dashboard/notifications/page'

const mockUseSession = useSession as jest.Mock

const mockNotifications = [
  {
    id: 'n1',
    message: 'New booking from Alice',
    read: false,
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'n2',
    message: 'Booking confirmed by tutor',
    read: true,
    createdAt: '2024-01-14T09:00:00Z',
  },
]

describe('NotificationsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockReset()
    mockUseSession.mockReset()
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' })
  })

  it('should render the page heading', () => {
    render(<NotificationsPage />)
    expect(screen.getByText('Notifications')).toBeInTheDocument()
  })

  it('should show empty state when no notifications', async () => {
    render(<NotificationsPage />)
    expect(screen.getByText('No notifications yet.')).toBeInTheDocument()
  })

  it('should load notifications when user exists', async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: 'user1', name: 'Test', email: 'test@test.com', role: 'TUTOR' },
      },
      status: 'authenticated',
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockNotifications,
    })

    render(<NotificationsPage />)

    await waitFor(() => {
      expect(screen.getByText('New booking from Alice')).toBeInTheDocument()
      expect(screen.getByText('Booking confirmed by tutor')).toBeInTheDocument()
    })
  })

  it('should show Mark read button for unread notifications', async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: 'user1', name: 'Test', email: 'test@test.com', role: 'TUTOR' },
      },
      status: 'authenticated',
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockNotifications,
    })

    render(<NotificationsPage />)

    await waitFor(() => {
      expect(screen.getByText('Mark read')).toBeInTheDocument()
    })
  })

  it('should mark notification as read when button is clicked', async () => {
    const user = userEvent.setup()
    mockUseSession.mockReturnValue({
      data: {
        user: { id: 'user1', name: 'Test', email: 'test@test.com', role: 'TUTOR' },
      },
      status: 'authenticated',
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockNotifications,
    })

    render(<NotificationsPage />)

    await waitFor(() => {
      expect(screen.getByText('Mark read')).toBeInTheDocument()
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...mockNotifications[0], read: true }),
    })

    await user.click(screen.getByText('Mark read'))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenLastCalledWith('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: 'n1' }),
      })
    })
  })

  it('should handle empty response from API', async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: 'user1', name: 'Test', email: 'test@test.com', role: 'TUTOR' },
      },
      status: 'authenticated',
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

    render(<NotificationsPage />)

    await waitFor(() => {
      expect(screen.getByText('No notifications yet.')).toBeInTheDocument()
    })
  })

  it('should handle failed API response', async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: 'user1', name: 'Test', email: 'test@test.com', role: 'TUTOR' },
      },
      status: 'authenticated',
    })
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Server error' }),
    })

    render(<NotificationsPage />)

    await waitFor(() => {
      expect(screen.getByText('No notifications yet.')).toBeInTheDocument()
    })
  })
})
