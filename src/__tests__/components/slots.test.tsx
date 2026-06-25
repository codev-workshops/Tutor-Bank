import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), refresh: jest.fn() }),
}))

const mockFetch = jest.fn() as jest.Mock
global.fetch = mockFetch

import ManageSlotsPage from '@/app/dashboard/slots/page'

const mockSlots = [
  {
    id: 'slot1',
    date: '2024-02-01T00:00:00Z',
    startTime: '2024-02-01T09:00:00Z',
    endTime: '2024-02-01T10:00:00Z',
    isBooked: false,
  },
  {
    id: 'slot2',
    date: '2024-02-02T00:00:00Z',
    startTime: '2024-02-02T14:00:00Z',
    endTime: '2024-02-02T15:00:00Z',
    isBooked: true,
  },
]

describe('ManageSlotsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockReset()
    ;(localStorage.getItem as jest.Mock).mockReset()
  })

  it('should render the page heading', () => {
    ;(localStorage.getItem as jest.Mock).mockReturnValue(null)
    render(<ManageSlotsPage />)
    expect(screen.getByText('Manage Time Slots')).toBeInTheDocument()
  })

  it('should render the add slot form', () => {
    ;(localStorage.getItem as jest.Mock).mockReturnValue(null)
    render(<ManageSlotsPage />)
    expect(screen.getByText('Add New Slot')).toBeInTheDocument()
    expect(screen.getByText('Date')).toBeInTheDocument()
    expect(screen.getByText('Start Time')).toBeInTheDocument()
    expect(screen.getByText('End Time')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add slot/i })).toBeInTheDocument()
  })

  it('should show empty state when no slots exist', () => {
    ;(localStorage.getItem as jest.Mock).mockReturnValue(null)
    render(<ManageSlotsPage />)
    expect(screen.getByText('No slots added yet.')).toBeInTheDocument()
  })

  it('should fetch and display slots when user exists', async () => {
    ;(localStorage.getItem as jest.Mock).mockReturnValue(
      JSON.stringify({ id: 'tutor1', name: 'Tutor', email: 'tutor@test.com', role: 'TUTOR' })
    )
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSlots,
    })

    render(<ManageSlotsPage />)

    await waitFor(() => {
      expect(screen.getByText('Available')).toBeInTheDocument()
      expect(screen.getByText('Booked')).toBeInTheDocument()
    })
  })

  it('should call fetch with correct URL for slots', async () => {
    ;(localStorage.getItem as jest.Mock).mockReturnValue(
      JSON.stringify({ id: 'tutor1', name: 'Tutor', email: 'tutor@test.com', role: 'TUTOR' })
    )
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

    render(<ManageSlotsPage />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/tutors/tutor1/slots')
    })
  })

  it('should submit new slot form', async () => {
    const user = userEvent.setup()
    ;(localStorage.getItem as jest.Mock).mockReturnValue(
      JSON.stringify({ id: 'tutor1', name: 'Tutor', email: 'tutor@test.com', role: 'TUTOR' })
    )
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

    render(<ManageSlotsPage />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/tutors/tutor1/slots')
    })

    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement
    const startInput = document.querySelectorAll('input[type="time"]')[0] as HTMLInputElement
    const endInput = document.querySelectorAll('input[type="time"]')[1] as HTMLInputElement

    await user.type(dateInput, '2024-03-01')
    await user.type(startInput, '09:00')
    await user.type(endInput, '10:00')

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'new-slot' }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSlots,
    })

    await user.click(screen.getByRole('button', { name: /add slot/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/tutors/tutor1/slots',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })
  })

  it('should not submit form if no user is logged in', async () => {
    const user = userEvent.setup()
    ;(localStorage.getItem as jest.Mock).mockReturnValue(null)

    render(<ManageSlotsPage />)

    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement
    const startInput = document.querySelectorAll('input[type="time"]')[0] as HTMLInputElement
    const endInput = document.querySelectorAll('input[type="time"]')[1] as HTMLInputElement

    await user.type(dateInput, '2024-03-01')
    await user.type(startInput, '09:00')
    await user.type(endInput, '10:00')

    await user.click(screen.getByRole('button', { name: /add slot/i }))

    // fetch should not have been called with POST (only the initial GET may or may not happen)
    const postCalls = mockFetch.mock.calls.filter(
      (call: unknown[]) => call[1] && (call[1] as { method?: string }).method === 'POST'
    )
    expect(postCalls.length).toBe(0)
  })

  it('should handle failed fetch for slots', async () => {
    ;(localStorage.getItem as jest.Mock).mockReturnValue(
      JSON.stringify({ id: 'tutor1', name: 'Tutor', email: 'tutor@test.com', role: 'TUTOR' })
    )
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Server error' }),
    })

    render(<ManageSlotsPage />)

    await waitFor(() => {
      expect(screen.getByText('No slots added yet.')).toBeInTheDocument()
    })
  })
})
