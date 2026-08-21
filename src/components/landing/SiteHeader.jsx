import { Button } from '../ui/Button'
import { landingNavItems } from '../../data/landingContent'

export function SiteHeader({ onNavigate }) {
  return (
    <nav className="site-nav" aria-label="Main navigation">
      <a
        className="brand"
        href="/"
        onClick={(event) => {
          event.preventDefault()
          onNavigate?.('home')
        }}
        aria-label="TeamHub home"
      >
        <span className="brand-mark">T</span>
        <span>TeamHub</span>
      </a>

      <div className="nav-links">
        {landingNavItems.map((item) => (
          <a href={`#${item.toLowerCase()}`} key={item}>
            {item}
          </a>
        ))}
      </div>

      <div className="nav-actions">
        <Button onClick={() => onNavigate?.('login')} variant="ghost">
          Log in
        </Button>
        <Button onClick={() => onNavigate?.('login')}>Get Started</Button>
      </div>
    </nav>
  )
}
