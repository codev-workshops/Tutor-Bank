import { render, screen } from '@testing-library/react'

jest.mock('next/font/google', () => ({
  Geist: () => ({ variable: '--font-geist-sans' }),
  Geist_Mono: () => ({ variable: '--font-geist-mono' }),
}))

jest.mock('next/link', () => {
  return function MockLink({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: unknown }) {
    return <a href={href} {...rest}>{children}</a>
  }
})

import RootLayout from '@/app/layout'

describe('RootLayout', () => {
  it('should render children', () => {
    render(<RootLayout><div>Test Content</div></RootLayout>)
    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  it('should render navigation with Tutor Bank link', () => {
    render(<RootLayout><div>Content</div></RootLayout>)
    const homeLink = screen.getByText('Tutor Bank')
    expect(homeLink).toBeInTheDocument()
    expect(homeLink.closest('a')).toHaveAttribute('href', '/')
  })

  it('should render Browse Tutors nav link', () => {
    render(<RootLayout><div>Content</div></RootLayout>)
    const tutorsLink = screen.getByText('Browse Tutors')
    expect(tutorsLink).toBeInTheDocument()
    expect(tutorsLink.closest('a')).toHaveAttribute('href', '/tutors')
  })

  it('should render Dashboard nav link', () => {
    render(<RootLayout><div>Content</div></RootLayout>)
    const dashLink = screen.getByText('Dashboard')
    expect(dashLink).toBeInTheDocument()
    expect(dashLink.closest('a')).toHaveAttribute('href', '/dashboard')
  })
})
