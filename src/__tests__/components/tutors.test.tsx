import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TutorsPage from '@/app/tutors/page'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), refresh: jest.fn() }),
}))

jest.mock('next/link', () => {
  return function MockLink({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: unknown }) {
    return <a href={href} {...rest}>{children}</a>
  }
})

const mockFetch = jest.fn() as jest.Mock
global.fetch = mockFetch

const mockTutors = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@test.com',
    bio: 'Experienced math tutor',
    hourlyRate: 50,
    subjects: [
      { subject: { id: 's1', name: 'Mathematics' } },
      { subject: { id: 's2', name: 'Physics' } },
    ],
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@test.com',
    bio: 'English language specialist',
    hourlyRate: 40,
    subjects: [{ subject: { id: 's3', name: 'English' } }],
  },
]

describe('TutorsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockReset()
  })

  it('should render the page with heading and search form', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

    render(<TutorsPage />)

    expect(screen.getByText('Find a Tutor')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search by name...')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search by subject...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument()
  })

  it('should display tutors list after fetch', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTutors,
    })

    render(<TutorsPage />)

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    })
  })

  it('should search by name', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTutors,
    })

    render(<TutorsPage />)

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [mockTutors[0]],
    })

    await user.type(screen.getByPlaceholderText('Search by name...'), 'John')
    await user.click(screen.getByRole('button', { name: /search/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenLastCalledWith('/api/tutors?name=John')
    })
  })

  it('should search by subject', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTutors,
    })

    render(<TutorsPage />)

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [mockTutors[0]],
    })

    await user.type(screen.getByPlaceholderText('Search by subject...'), 'Math')
    await user.click(screen.getByRole('button', { name: /search/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenLastCalledWith('/api/tutors?subject=Math')
    })
  })

  it('should display tutor card with name, bio, and hourly rate', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTutors,
    })

    render(<TutorsPage />)

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Experienced math tutor')).toBeInTheDocument()
      expect(screen.getByText('$50/hr')).toBeInTheDocument()
    })
  })

  it('should display tutor subjects as badges', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTutors,
    })

    render(<TutorsPage />)

    await waitFor(() => {
      expect(screen.getByText('Mathematics')).toBeInTheDocument()
      expect(screen.getByText('Physics')).toBeInTheDocument()
      expect(screen.getByText('English')).toBeInTheDocument()
    })
  })

  it('should show empty state when no tutors found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

    render(<TutorsPage />)

    await waitFor(() => {
      expect(
        screen.getByText('No tutors found. Try adjusting your search.')
      ).toBeInTheDocument()
    })
  })

  it('should call fetch on initial render', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

    render(<TutorsPage />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/tutors?')
    })
  })

  it('should handle API error gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Server error' }),
    })

    render(<TutorsPage />)

    await waitFor(() => {
      expect(
        screen.getByText('No tutors found. Try adjusting your search.')
      ).toBeInTheDocument()
    })
  })
})
