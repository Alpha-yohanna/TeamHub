import { Button } from '../ui/Button'
import { ProductPreview } from './ProductPreview'

export function HeroSection({ onNavigate }) {
  return (
    <section className="hero-section">
      <div className="hero-copy">
        <p className="eyebrow">Modern team workspace</p>
        <h1>Everything your team needs, in one place.</h1>
        <p className="hero-text">
          TeamHub brings communication, collaboration, file sharing, team
          management, and insights into one simple workspace.
        </p>

        <div className="hero-actions">
          <Button onClick={() => onNavigate?.('login')}>Get Started</Button>
          <Button variant="secondary">See How It Works</Button>
        </div>
      </div>

      <ProductPreview />
    </section>
  )
}
