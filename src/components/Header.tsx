import { Link } from '@tanstack/react-router'
import BetterAuthHeader from '../integrations/better-auth/header-user.tsx'
import ThemeToggle from './ThemeToggle'

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 px-4 backdrop-blur-lg">
      <nav className="mx-auto flex max-w-5xl items-center gap-4 py-3">
        <Link
          to="/"
          className="text-base font-bold tracking-tight text-foreground no-underline"
        >
          Vedtatt
        </Link>

        <div className="flex items-center gap-4 text-sm font-medium">
          <Link
            to="/"
            className="text-muted-foreground no-underline transition hover:text-foreground"
            activeProps={{ className: 'text-foreground no-underline' }}
            activeOptions={{ exact: true }}
          >
            Hjem
          </Link>
          <Link
            to="/about"
            className="text-muted-foreground no-underline transition hover:text-foreground"
            activeProps={{ className: 'text-foreground no-underline' }}
          >
            Om oss
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <BetterAuthHeader />
          <ThemeToggle />
        </div>
      </nav>
    </header>
  )
}
