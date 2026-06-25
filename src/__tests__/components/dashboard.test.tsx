import { render, screen } from '@testing-library/react'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), refresh: jest.fn() }),
}))

jest.mock('next/link', () => {
  return function MockLink({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: unknown }) {
    return <a href={href} {...rest}>{children}</a>
  }
})

interface User {
  id: string
  name: string
  email: string
  role: string
}

let mockSnapshotUser: User | null = null

jest.mock('react', () => {
  const actual = jest.requireActual('react')
  return {
    ...actual,
    useSyncExternalStore: (_subscribe: unknown, _getSnapshot: unknown, _getServerSnapshot: unknown) => {
      return mockSnapshotUser
    },
  }
})

import DashboardPage from '@/app/dashboard/page'

describe('DashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSnapshotUser = null
    ;(localStorage.getItem as jest.Mock).mockReset()
  })

  it('should render the dashboard with user info', () => {
    mockSnapshotUser = { id: '1', name: 'John Doe', email: 'john@test.com', role: 'STUDENT' }

    render(<DashboardPage />)

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('should display welcome message with user name', () => {
    mockSnapshotUser = { id: '1', name: 'John Doe', email: 'john@test.com', role: 'STUDENT' }

    render(<DashboardPage />)

    expect(screen.getByText(/Welcome, John Doe/)).toBeInTheDocument()
  })

  it('should show navigation links for Bookings, Find Tutors, and Notifications', () => {
    mockSnapshotUser = { id: '1', name: 'John Doe', email: 'john@test.com', role: 'STUDENT' }

    render(<DashboardPage />)

    expect(screen.getByText('Bookings')).toBeInTheDocument()
    expect(screen.getByText('Find Tutors')).toBeInTheDocument()
    expect(screen.getByText('Notifications')).toBeInTheDocument()
  })

  it('should show Manage Slots link for tutor role', () => {
    mockSnapshotUser = { id: '1', name: 'John Doe', email: 'john@test.com', role: 'TUTOR' }

    render(<DashboardPage />)

    expect(screen.getByText('Manage Slots')).toBeInTheDocument()
  })

  it('should not show Manage Slots link for student role', () => {
    mockSnapshotUser = { id: '1', name: 'John Doe', email: 'john@test.com', role: 'STUDENT' }

    render(<DashboardPage />)

    expect(screen.queryByText('Manage Slots')).not.toBeInTheDocument()
  })

  it('should redirect to login if no user in localStorage', () => {
    mockSnapshotUser = null

    render(<DashboardPage />)

    expect(mockPush).toHaveBeenCalledWith('/login')
    expect(screen.getByText('Redirecting...')).toBeInTheDocument()
  })

  it('should read user data from localStorage and display it', () => {
    mockSnapshotUser = { id: '1', name: 'Jane Smith', email: 'jane@test.com', role: 'STUDENT' }

    render(<DashboardPage />)

    expect(screen.getByText(/Welcome, Jane Smith/)).toBeInTheDocument()
  })

  it('should have correct navigation link hrefs', () => {
    mockSnapshotUser = { id: '1', name: 'John Doe', email: 'john@test.com', role: 'TUTOR' }

    render(<DashboardPage />)

    const links = screen.getAllByRole('link')
    const hrefs = links.map((link) => link.getAttribute('href'))
    expect(hrefs).toContain('/dashboard/slots')
    expect(hrefs).toContain('/dashboard/bookings')
    expect(hrefs).toContain('/dashboard/notifications')
    expect(hrefs).toContain('/tutors')
  })
})
