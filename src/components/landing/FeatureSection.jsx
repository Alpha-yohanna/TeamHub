import { landingFeatures } from '../../data/landingContent'

export function FeatureSection() {
  return (
    <section className="feature-band" id="features" aria-labelledby="features-title">
      <div>
        <p className="eyebrow">Built for busy teams</p>
        <h2 id="features-title">A focused workspace that stays organized.</h2>
      </div>

      <div className="feature-grid">
        {landingFeatures.map((feature) => (
          <article className="feature-card" key={feature.title}>
            <span className="feature-dot" aria-hidden="true" />
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
