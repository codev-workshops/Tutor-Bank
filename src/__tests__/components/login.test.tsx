import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { signIn } from 'next-auth/react'
import LoginPage from '@/app/login/page'

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

const mockSignIn = signIn as jest.Mock

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSignIn.mockReset()
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

  it('should call NextAuth credentials signIn on submit', async () => {
    const user = userEvent.setup()
    mockSignIn.mockResolvedValueOnce({ ok: true, error: null })

    render(<LoginPage />)

    await user.type(screen.getByPlaceholderText('Email'), 'test@test.com')
    await user.type(screen.getByPlaceholderText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: /login/i }))

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('credentials', {
        email: 'test@test.com',
        password: 'password123',
        redirect: false,
      })
    })
  })

  it('should redirect to dashboard on success', async () => {
    const user = userEvent.setup()
    mockSignIn.mockResolvedValueOnce({ ok: true, error: null })

    render(<LoginPage />)

    await user.type(screen.getByPlaceholderText('Email'), 'test@test.com')
    await user.type(screen.getByPlaceholderText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: /login/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('should display error message when signIn returns an error', async () => {
    const user = userEvent.setup()
    mockSignIn.mockResolvedValueOnce({
      ok: false,
      error: 'Invalid credentials',
    })

    render(<LoginPage />)

    await user.type(screen.getByPlaceholderText('Email'), 'test@test.com')
    await user.type(screen.getByPlaceholderText('Password'), 'wrongpassword')
    await user.click(screen.getByRole('button', { name: /login/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('should display generic error on signIn rejection', async () => {
    const user = userEvent.setup()
    mockSignIn.mockRejectedValueOnce(new Error('Network error'))

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
