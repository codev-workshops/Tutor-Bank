import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from '@/app/login/page'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), refresh: jest.fn() }),
}))

jest.mock('next/link', () => {
  return function MockLink({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: unknown }) {
    return <a href={href} {...rest}>{children}</a>
  }
})

const mockFetch = jest.fn() as jest.Mock
global.fetch = mockFetch

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockReset()
    ;(localStorage.setItem as jest.Mock).mockClear()
  })

  it('should render the login form with email and password inputs', () => {
    render(<LoginPage />)

    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument()
  })

  it('should have required attribute on email input with email type', () => {
    render(<LoginPage />)
    const emailInput = screen.getByPlaceholderText('Email')
    expect(emailInput).toBeRequired()
    expect(emailInput).toHaveAttribute('type', 'email')
  })

  it('should have required attribute on password input', () => {
    render(<LoginPage />)
    const passwordInput = screen.getByPlaceholderText('Password')
    expect(passwordInput).toBeRequired()
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('should submit form and call API on submit', async () => {
    const user = userEvent.setup()
    const mockUser = { id: '1', name: 'Test User', email: 'test@test.com', role: 'STUDENT' }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockUser,
    })

    render(<LoginPage />)

    await user.type(screen.getByPlaceholderText('Email'), 'test@test.com')
    await user.type(screen.getByPlaceholderText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: /login/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@test.com', password: 'password123' }),
      })
    })
  })

  it('should store user data in localStorage on success', async () => {
    const user = userEvent.setup()
    const mockUser = { id: '1', name: 'Test User', email: 'test@test.com', role: 'STUDENT' }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockUser,
    })

    render(<LoginPage />)

    await user.type(screen.getByPlaceholderText('Email'), 'test@test.com')
    await user.type(screen.getByPlaceholderText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: /login/i }))

    await waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(mockUser))
    })
  })

  it('should redirect to dashboard on success', async () => {
    const user = userEvent.setup()
    const mockUser = { id: '1', name: 'Test User', email: 'test@test.com', role: 'STUDENT' }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockUser,
    })

    render(<LoginPage />)

    await user.type(screen.getByPlaceholderText('Email'), 'test@test.com')
    await user.type(screen.getByPlaceholderText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: /login/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('should display error message on API error', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid credentials' }),
    })

    render(<LoginPage />)

    await user.type(screen.getByPlaceholderText('Email'), 'test@test.com')
    await user.type(screen.getByPlaceholderText('Password'), 'wrongpassword')
    await user.click(screen.getByRole('button', { name: /login/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
    expect(mockPush).not.toHaveBeenCalled()
    expect(localStorage.setItem).not.toHaveBeenCalled()
  })

  it('should display fallback error message when API returns no error field', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    })

    render(<LoginPage />)

    await user.type(screen.getByPlaceholderText('Email'), 'test@test.com')
    await user.type(screen.getByPlaceholderText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: /login/i }))

    await waitFor(() => {
      expect(screen.getByText('Login failed')).toBeInTheDocument()
    })
  })

  it('should display generic error on network failure', async () => {
    const user = userEvent.setup()
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    render(<LoginPage />)

    await user.type(screen.getByPlaceholderText('Email'), 'test@test.com')
    await user.type(screen.getByPlaceholderText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: /login/i }))

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })
  })

  it('should have a link to register page', () => {
    render(<LoginPage />)

    const registerLink = screen.getByRole('link', { name: /register/i })
    expect(registerLink).toBeInTheDocument()
    expect(registerLink).toHaveAttribute('href', '/register')
  })
})
