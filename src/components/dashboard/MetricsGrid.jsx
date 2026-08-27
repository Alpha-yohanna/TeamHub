import { MetricCard } from './MetricCard'

// `metrics` is an ordered list of { key, label, value, Icon, tone, onClick } — the caller decides
// which metrics apply (role-based sets live in AdminDashboard), this just lays them out and
// handles the loading-skeleton state so that's not duplicated per page.
export function MetricsGrid({ metrics, isLoading }) {
  return (
    <div className="metrics-grid">
      {isLoading
        ? Array.from({ length: metrics.length || 4 }).map((_, index) => (
            <article className="metric-card skeleton-card" key={index} aria-hidden="true" />
          ))
        : metrics.map((metric) => (
            <MetricCard
              Icon={metric.Icon}
              key={metric.key}
              label={metric.label}
              onClick={metric.onClick}
              tone={metric.tone}
              trend={metric.trend}
              value={metric.value}
            />
          ))}
    </div>
  )
}
