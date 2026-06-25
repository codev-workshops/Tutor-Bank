import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), refresh: jest.fn() }),
}))

const mockFetch = jest.fn() as jest.Mock
global.fetch = mockFetch

const mockTutor = {
  id: 'tutor1',
  name: 'John Doe',
  email: 'john@test.com',
  bio: 'Experienced math tutor',
  hourlyRate: 50,
  subjects: [
    { subject: { id: 's1', name: 'Mathematics' } },
    { subject: { id: 's2', name: 'Physics' } },
  ],
  timeSlots: [
    {
      id: 'slot1',
      date: '2024-02-01T00:00:00Z',
      startTime: '2024-02-01T09:00:00Z',
      endTime: '2024-02-01T10:00:00Z',
    },
  ],
}

// Mock React.use() for params
jest.mock('react', () => {
  const actual = jest.requireActual('react')
  return {
    ...actual,
    use: (promise: unknown) => {
      if (promise && typeof promise === 'object' && 'then' in (promise as object)) {
        // For params promise
        return { id: 'tutor1' }
      }
      return promise
    },
  }
})

import TutorDetailPage from '@/app/tutors/[id]/page'

describe('TutorDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockReset()
    ;(localStorage.getItem as jest.Mock).mockReset()
  })

  it('should show loading state initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {})) // never resolves
    render(<TutorDetailPage params={Promise.resolve({ id: 'tutor1' })} />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('should fetch and display tutor details', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTutor,
    })

    render(<TutorDetailPage params={Promise.resolve({ id: 'tutor1' })} />)

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Experienced math tutor')).toBeInTheDocument()
      expect(screen.getByText('$50/hr')).toBeInTheDocument()
    })
  })

  it('should display tutor subjects', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTutor,
    })

    render(<TutorDetailPage params={Promise.resolve({ id: 'tutor1' })} />)

    await waitFor(() => {
      expect(screen.getByText('Mathematics')).toBeInTheDocument()
      expect(screen.getByText('Physics')).toBeInTheDocument()
    })
  })

  it('should display available time slots', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTutor,
    })

    render(<TutorDetailPage params={Promise.resolve({ id: 'tutor1' })} />)

    await waitFor(() => {
      expect(screen.getByText('Available Slots')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /book/i })).toBeInTheDocument()
    })
  })

  it('should show empty slots message when no slots available', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...mockTutor, timeSlots: [] }),
    })

    render(<TutorDetailPage params={Promise.resolve({ id: 'tutor1' })} />)

    await waitFor(() => {
      expect(screen.getByText('No available slots at the moment.')).toBeInTheDocument()
    })
  })

  it('should show login message if user tries to book without login', async () => {
    const user = userEvent.setup()
    ;(localStorage.getItem as jest.Mock).mockReturnValue(null)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTutor,
    })

    render(<TutorDetailPage params={Promise.resolve({ id: 'tutor1' })} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /book/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /book/i }))

    await waitFor(() => {
      expect(screen.getByText('Please login to book a slot')).toBeInTheDocument()
    })
  })

  it('should book a slot successfully', async () => {
    const user = userEvent.setup()
    ;(localStorage.getItem as jest.Mock).mockReturnValue(
      JSON.stringify({ id: 'student1', name: 'Student', email: 'student@test.com', role: 'STUDENT' })
    )
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTutor,
    })

    render(<TutorDetailPage params={Promise.resolve({ id: 'tutor1' })} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /book/i })).toBeInTheDocument()
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'booking1' }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...mockTutor, timeSlots: [] }),
    })

    await user.click(screen.getByRole('button', { name: /book/i }))

    await waitFor(() => {
      expect(screen.getByText('Booking request sent! Waiting for tutor confirmation.')).toBeInTheDocument()
    })
  })

  it('should show error message when booking fails', async () => {
    const user = userEvent.setup()
    ;(localStorage.getItem as jest.Mock).mockReturnValue(
      JSON.stringify({ id: 'student1', name: 'Student', email: 'student@test.com', role: 'STUDENT' })
    )
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTutor,
    })

    render(<TutorDetailPage params={Promise.resolve({ id: 'tutor1' })} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /book/i })).toBeInTheDocument()
    })

    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Slot already booked' }),
    })

    await user.click(screen.getByRole('button', { name: /book/i }))

    await waitFor(() => {
      expect(screen.getByText('Slot already booked')).toBeInTheDocument()
    })
  })

  it('should handle tutor without bio or hourlyRate', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...mockTutor, bio: null, hourlyRate: null }),
    })

    render(<TutorDetailPage params={Promise.resolve({ id: 'tutor1' })} />)

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
    })
  })

  it('should handle failed tutor fetch', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Not found' }),
    })

    render(<TutorDetailPage params={Promise.resolve({ id: 'tutor1' })} />)

    // Should remain in loading state
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })
})
