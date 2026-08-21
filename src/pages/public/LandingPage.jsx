import { FeatureSection } from '../../components/landing/FeatureSection'
import { HeroSection } from '../../components/landing/HeroSection'
import { HomeSidebar } from '../../components/landing/HomeSidebar'
import { SiteHeader } from '../../components/landing/SiteHeader'

export function LandingPage({ onNavigate }) {
  return (
    <main className="landing-page">
      <HomeSidebar onNavigate={onNavigate} />
      <div className="home-content">
        <SiteHeader onNavigate={onNavigate} />
        <HeroSection onNavigate={onNavigate} />
        <FeatureSection />
      </div>
    </main>
  )
}
