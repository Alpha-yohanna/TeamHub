import { TrendUpIcon } from '../ui/NavIcons'

export function MetricCard({ Icon, label, value, tone = 'primary', trend, onClick }) {
  const isInteractive = typeof onClick === 'function'
  const Tag = isInteractive ? 'button' : 'article'

  return (
    <Tag
      className={`metric-card metric-card-${tone}`}
      onClick={onClick}
      type={isInteractive ? 'button' : undefined}
    >
      <span className="metric-card-icon" aria-hidden="true">
        <Icon />
      </span>
      <span className="metric-card-label">{label}</span>
      <strong className="metric-card-value">{value}</strong>
      {trend && (
        <span className={`metric-card-trend metric-card-trend-${trend.direction}`}>
          {trend.direction === 'up' ? (
            <TrendUpIcon aria-hidden="true" />
          ) : (
            <TrendUpIcon aria-hidden="true" style={{ transform: 'scaleY(-1)' }} />
          )}
          {trend.label}
        </span>
      )}
    </Tag>
  )
}
