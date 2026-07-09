import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useSession } from 'next-auth/react'
import CalendarPage from '@/app/dashboard/calendar/page'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), refresh: jest.fn() }),
}))

const mockFetch = jest.fn() as jest.Mock
global.fetch = mockFetch

const mockUseSession = useSession as jest.Mock

const mockTutorUser = { id: 'tutor-1', name: 'Tutor One', role: 'TUTOR' }
const mockStudentUser = { id: 'student-1', name: 'Student One', role: 'STUDENT' }

// Use a fixed date so month navigation is deterministic.
const FIXED_NOW = new Date('2025-06-15T12:00:00.000Z')

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

describe('CalendarPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    jest.setSystemTime(FIXED_NOW)
    mockFetch.mockReset()
    mockUseSession.mockReset()
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('shows loading state', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' })
    render(<CalendarPage />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('redirects to /login when unauthenticated', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' })
    render(<CalendarPage />)
    expect(mockPush).toHaveBeenCalledWith('/login')
  })

  it('renders the current month heading and export controls', async () => {
    mockUseSession.mockReturnValue({
      data: { user: mockStudentUser },
      status: 'authenticated',
    })
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockBookings })

    render(<CalendarPage />)

    expect(screen.getByRole('heading', { name: 'Calendar' })).toBeInTheDocument()
    expect(screen.getByText('June 2025')).toBeInTheDocument()
    const exportLink = screen.getByRole('link', {
      name: /export to calendar/i,
    })
    expect(exportLink).toHaveAttribute(
      'href',
      '/api/calendar?userId=student-1&role=STUDENT'
    )
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/bookings?userId=student-1&role=STUDENT'
      )
    })
  })

  it('places a booking badge on its day and shows details on click', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    mockUseSession.mockReturnValue({
      data: { user: mockStudentUser },
      status: 'authenticated',
    })
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockBookings })

    render(<CalendarPage />)

    // Badge uses the other party's name (tutor for a student).
    await waitFor(() => {
      expect(screen.getAllByText('Tutor One').length).toBeGreaterThan(0)
    })

    // Click the day cell containing "15".
    const dayButton = screen
      .getAllByRole('button')
      .find((el) => within(el).queryByText('15'))
    expect(dayButton).toBeDefined()
    await user.click(dayButton!)

    expect(screen.getByText('Tutor: Tutor One')).toBeInTheDocument()
    expect(screen.getByText('PENDING')).toBeInTheDocument()
  })

  it('navigates to the previous and next month', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    mockUseSession.mockReturnValue({
      data: { user: mockStudentUser },
      status: 'authenticated',
    })
    mockFetch.mockResolvedValue({ ok: true, json: async () => mockBookings })

    render(<CalendarPage />)

    await user.click(screen.getByLabelText('Previous month'))
    expect(screen.getByText('May 2025')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Next month'))
    await user.click(screen.getByLabelText('Next month'))
    expect(screen.getByText('July 2025')).toBeInTheDocument()
  })

  it('uses the student name badge for a tutor', async () => {
    mockUseSession.mockReturnValue({
      data: { user: mockTutorUser },
      status: 'authenticated',
    })
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockBookings })

    render(<CalendarPage />)

    await waitFor(() => {
      expect(screen.getByText('Student One')).toBeInTheDocument()
      expect(screen.getByText('Student Two')).toBeInTheDocument()
    })
  })

  it('copies the subscription URL to the clipboard', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    mockUseSession.mockReturnValue({
      data: { user: mockStudentUser },
      status: 'authenticated',
    })
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockBookings })

    render(<CalendarPage />)

    await user.click(
      screen.getByRole('button', { name: /copy subscription url/i })
    )
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining('/api/calendar?userId=student-1&role=STUDENT')
      )
    })
    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument()
    })
  })
})
