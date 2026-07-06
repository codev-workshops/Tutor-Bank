import { render, screen } from '@testing-library/react'
import { useSession } from 'next-auth/react'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), refresh: jest.fn() }),
}))

jest.mock('next/link', () => {
  return function MockLink({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode
    href: string
    [key: string]: unknown
  }) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    )
  }
})

const mockUseSession = useSession as jest.Mock

import DashboardPage from '@/app/dashboard/page'

describe('DashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseSession.mockReset()
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' })
  })

  it('should render the dashboard with user info', () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: '1', name: 'John Doe', email: 'john@test.com', role: 'STUDENT' },
      },
      status: 'authenticated',
    })

    render(<DashboardPage />)

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText(/Welcome, John Doe \(STUDENT\)/)).toBeInTheDocument()
  })

  it('should show navigation links for Bookings, Find Tutors, and Notifications', () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: '1', name: 'John Doe', email: 'john@test.com', role: 'STUDENT' },
      },
      status: 'authenticated',
    })

    render(<DashboardPage />)

    expect(screen.getByText('Bookings')).toBeInTheDocument()
    expect(screen.getByText('Find Tutors')).toBeInTheDocument()
    expect(screen.getByText('Notifications')).toBeInTheDocument()
  })

  it('should show Manage Slots link for tutor role', () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: '1', name: 'John Doe', email: 'john@test.com', role: 'TUTOR' },
      },
      status: 'authenticated',
    })

    render(<DashboardPage />)

    expect(screen.getByText('Manage Slots')).toBeInTheDocument()
  })

  it('should not show Manage Slots link for student role', () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: '1', name: 'John Doe', email: 'john@test.com', role: 'STUDENT' },
      },
      status: 'authenticated',
    })

    render(<DashboardPage />)

    expect(screen.queryByText('Manage Slots')).not.toBeInTheDocument()
  })

  it('should redirect to login when no session exists', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' })

    render(<DashboardPage />)

    expect(mockPush).toHaveBeenCalledWith('/login')
    expect(screen.getByText('Redirecting...')).toBeInTheDocument()
  })

  it('should render loading state when session is loading', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' })

    render(<DashboardPage />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('should have correct navigation link hrefs', () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: '1', name: 'John Doe', email: 'john@test.com', role: 'TUTOR' },
      },
      status: 'authenticated',
    })

    render(<DashboardPage />)

    const links = screen.getAllByRole('link')
    const hrefs = links.map((link) => link.getAttribute('href'))
    expect(hrefs).toContain('/dashboard/slots')
    expect(hrefs).toContain('/dashboard/bookings')
    expect(hrefs).toContain('/dashboard/notifications')
    expect(hrefs).toContain('/tutors')
  })
})
