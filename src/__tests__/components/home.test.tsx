import { render, screen } from '@testing-library/react'

jest.mock('next/link', () => {
  return function MockLink({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: unknown }) {
    return <a href={href} {...rest}>{children}</a>
  }
})

import Home from '@/app/page'

describe('Home Page', () => {
  it('should render the main heading', () => {
    render(<Home />)
    expect(screen.getByText('Tutor Bank')).toBeInTheDocument()
  })

  it('should render the description text', () => {
    render(<Home />)
    expect(screen.getByText(/Find and book tutors for any subject/)).toBeInTheDocument()
  })

  it('should have a Register link', () => {
    render(<Home />)
    const registerLink = screen.getByText('Register')
    expect(registerLink).toBeInTheDocument()
    expect(registerLink.closest('a')).toHaveAttribute('href', '/register')
  })

  it('should have a Login link', () => {
    render(<Home />)
    const loginLink = screen.getByText('Login')
    expect(loginLink).toBeInTheDocument()
    expect(loginLink.closest('a')).toHaveAttribute('href', '/login')
  })

  it('should have a Browse Tutors link', () => {
    render(<Home />)
    const browseLink = screen.getByText('Browse Tutors →')
    expect(browseLink).toBeInTheDocument()
    expect(browseLink.closest('a')).toHaveAttribute('href', '/tutors')
  })
})
