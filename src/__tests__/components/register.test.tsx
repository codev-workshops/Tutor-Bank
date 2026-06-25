import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RegisterPage from '@/app/register/page'

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

describe('RegisterPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockReset()
  })

  it('should render the registration form with name, email, password inputs and role selector', () => {
    render(<RegisterPage />)

    expect(screen.getByPlaceholderText('Full Name')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument()
  })

  it('should have required attribute on name input', () => {
    render(<RegisterPage />)
    expect(screen.getByPlaceholderText('Full Name')).toBeRequired()
  })

  it('should have required attribute on email input', () => {
    render(<RegisterPage />)
    const emailInput = screen.getByPlaceholderText('Email')
    expect(emailInput).toBeRequired()
    expect(emailInput).toHaveAttribute('type', 'email')
  })

  it('should have required attribute on password input', () => {
    render(<RegisterPage />)
    const passwordInput = screen.getByPlaceholderText('Password')
    expect(passwordInput).toBeRequired()
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('should allow role selection between STUDENT and TUTOR', async () => {
    const user = userEvent.setup()
    render(<RegisterPage />)

    const select = screen.getByRole('combobox')
    expect(select).toHaveValue('STUDENT')

    await user.selectOptions(select, 'TUTOR')
    expect(select).toHaveValue('TUTOR')

    await user.selectOptions(select, 'STUDENT')
    expect(select).toHaveValue('STUDENT')
  })

  it('should submit form and redirect to login on success', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: '1', email: 'test@test.com' }),
    })

    render(<RegisterPage />)

    await user.type(screen.getByPlaceholderText('Full Name'), 'Test User')
    await user.type(screen.getByPlaceholderText('Email'), 'test@test.com')
    await user.type(screen.getByPlaceholderText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: /register/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test User',
          email: 'test@test.com',
          password: 'password123',
          role: 'STUDENT',
        }),
      })
    })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login')
    })
  })

  it('should display error message on API error', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Email already exists' }),
    })

    render(<RegisterPage />)

    await user.type(screen.getByPlaceholderText('Full Name'), 'Test User')
    await user.type(screen.getByPlaceholderText('Email'), 'test@test.com')
    await user.type(screen.getByPlaceholderText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: /register/i }))

    await waitFor(() => {
      expect(screen.getByText('Email already exists')).toBeInTheDocument()
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('should display fallback error on API error without message', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    })

    render(<RegisterPage />)

    await user.type(screen.getByPlaceholderText('Full Name'), 'Test User')
    await user.type(screen.getByPlaceholderText('Email'), 'test@test.com')
    await user.type(screen.getByPlaceholderText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: /register/i }))

    await waitFor(() => {
      expect(screen.getByText('Registration failed')).toBeInTheDocument()
    })
  })

  it('should display generic error on network failure', async () => {
    const user = userEvent.setup()
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    render(<RegisterPage />)

    await user.type(screen.getByPlaceholderText('Full Name'), 'Test User')
    await user.type(screen.getByPlaceholderText('Email'), 'test@test.com')
    await user.type(screen.getByPlaceholderText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: /register/i }))

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })
  })

  it('should have a link to login page', () => {
    render(<RegisterPage />)

    const loginLink = screen.getByRole('link', { name: /login/i })
    expect(loginLink).toBeInTheDocument()
    expect(loginLink).toHaveAttribute('href', '/login')
  })
})
