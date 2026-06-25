import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BookingsPage from '@/app/dashboard/bookings/page'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), refresh: jest.fn() }),
}))

const mockFetch = jest.fn() as jest.Mock
global.fetch = mockFetch

const mockTutorUser = { id: 'tutor-1', name: 'Tutor One', role: 'TUTOR' }
const mockStudentUser = { id: 'student-1', name: 'Student One', role: 'STUDENT' }

const mockBookings = [
  {
    id: 'b1',
    status: 'PENDING',
    student: { id: 'student-1', name: 'Student One', email: 'student@test.com' },
    tutor: { id: 'tutor-1', name: 'Tutor One', email: 'tutor@test.com' },
    slot: {
      id: 'slot-1',
      date: '2025-06-15T00:00:00.000Z',
      startTime: '2025-06-15T10:00:00.000Z',
      endTime: '2025-06-15T11:00:00.000Z',
    },
  },
  {
    id: 'b2',
    status: 'CONFIRMED',
    student: { id: 'student-2', name: 'Student Two', email: 'student2@test.com' },
    tutor: { id: 'tutor-1', name: 'Tutor One', email: 'tutor@test.com' },
    slot: {
      id: 'slot-2',
      date: '2025-06-16T00:00:00.000Z',
      startTime: '2025-06-16T14:00:00.000Z',
      endTime: '2025-06-16T15:00:00.000Z',
    },
  },
]

describe('BookingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockReset()
    ;(localStorage.getItem as jest.Mock).mockReset()
  })

  it('should render the bookings page with heading', () => {
    ;(localStorage.getItem as jest.Mock).mockReturnValue(null)

    render(<BookingsPage />)

    expect(screen.getByText('Bookings')).toBeInTheDocument()
  })

  it('should display bookings list with details for tutor', async () => {
    ;(localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(mockTutorUser))
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockBookings,
    })

    render(<BookingsPage />)

    await waitFor(() => {
      expect(screen.getByText('Student: Student One')).toBeInTheDocument()
      expect(screen.getByText('Student: Student Two')).toBeInTheDocument()
    })
  })

  it('should display bookings list with details for student', async () => {
    ;(localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(mockStudentUser))
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockBookings,
    })

    render(<BookingsPage />)

    await waitFor(() => {
      const tutorLabels = screen.getAllByText('Tutor: Tutor One')
      expect(tutorLabels.length).toBe(2)
    })
  })

  it('should show booking status', async () => {
    ;(localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(mockTutorUser))
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockBookings,
    })

    render(<BookingsPage />)

    await waitFor(() => {
      expect(screen.getByText('PENDING')).toBeInTheDocument()
      expect(screen.getByText('CONFIRMED')).toBeInTheDocument()
    })
  })

  it('should show Confirm and Reject buttons for tutor on pending bookings', async () => {
    ;(localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(mockTutorUser))
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [mockBookings[0]],
    })

    render(<BookingsPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument()
    })
  })

  it('should call API to confirm booking when Confirm is clicked', async () => {
    const user = userEvent.setup()
    ;(localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(mockTutorUser))
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [mockBookings[0]],
      })

    render(<BookingsPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
    })

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })

    await user.click(screen.getByRole('button', { name: /confirm/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/bookings/b1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CONFIRMED' }),
      })
    })
  })

  it('should call API to reject booking when Reject is clicked', async () => {
    const user = userEvent.setup()
    ;(localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(mockTutorUser))
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [mockBookings[0]],
      })

    render(<BookingsPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument()
    })

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })

    await user.click(screen.getByRole('button', { name: /reject/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/bookings/b1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REJECTED' }),
      })
    })
  })

  it('should show Cancel button for student on pending bookings', async () => {
    ;(localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(mockStudentUser))
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [mockBookings[0]],
    })

    render(<BookingsPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })
  })

  it('should call API to cancel booking when Cancel is clicked', async () => {
    const user = userEvent.setup()
    ;(localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(mockStudentUser))
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [mockBookings[0]],
      })

    render(<BookingsPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/bookings/b1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      })
    })
  })

  it('should show empty state when no bookings', async () => {
    ;(localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(mockStudentUser))
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

    render(<BookingsPage />)

    await waitFor(() => {
      expect(screen.getByText('No bookings yet.')).toBeInTheDocument()
    })
  })

  it('should show empty state when no user in localStorage', () => {
    ;(localStorage.getItem as jest.Mock).mockReturnValue(null)

    render(<BookingsPage />)

    expect(screen.getByText('No bookings yet.')).toBeInTheDocument()
  })

  it('should fetch bookings with correct params', async () => {
    ;(localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(mockTutorUser))
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockBookings,
    })

    render(<BookingsPage />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/bookings?userId=tutor-1&role=TUTOR'
      )
    })
  })

  it('should handle API error gracefully', async () => {
    ;(localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(mockStudentUser))
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Server error' }),
    })

    render(<BookingsPage />)

    await waitFor(() => {
      expect(screen.getByText('No bookings yet.')).toBeInTheDocument()
    })
  })
})
