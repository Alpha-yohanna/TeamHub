const CHART_WIDTH = 560
const CHART_HEIGHT = 140
const PADDING_X = 16
const PADDING_TOP = 16
const PADDING_BOTTOM = 8

// Hand-rolled inline SVG so the dashboard doesn't need a charting dependency for one small
// sparkline-style view. `data` is [{ label, value }] for the last 7 days, oldest first.
export function WorkspaceActivityChart({ data, onViewAll }) {
  const hasActivity = data.some((day) => day.value > 0)
  const maxValue = Math.max(1, ...data.map((day) => day.value))
  const usableWidth = CHART_WIDTH - PADDING_X * 2
  const usableHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM
  const stepX = data.length > 1 ? usableWidth / (data.length - 1) : 0

  const points = data.map((day, index) => {
    const x = PADDING_X + stepX * index
    const y = PADDING_TOP + usableHeight - (day.value / maxValue) * usableHeight
    return { x, y, ...day }
  })

  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ')
  const areaPath = `${linePath} L${points[points.length - 1]?.x ?? 0},${CHART_HEIGHT - PADDING_BOTTOM} L${points[0]?.x ?? 0},${CHART_HEIGHT - PADDING_BOTTOM} Z`

  return (
    <article className="panel-card activity-chart-card">
      <div className="panel-header">
        <h2>Workspace activity</h2>
        {onViewAll && (
          <button className="text-button" onClick={onViewAll} type="button">
            View all
          </button>
        )}
      </div>

      {hasActivity ? (
        <svg
          className="activity-chart"
          preserveAspectRatio="none"
          role="img"
          aria-label="Workspace activity over the last 7 days"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        >
          <path className="activity-chart-area" d={areaPath} />
          <path className="activity-chart-line" d={linePath} />
          {points.map((point) => (
            <circle className="activity-chart-dot" cx={point.x} cy={point.y} key={point.label + point.x} r="3.5" />
          ))}
        </svg>
      ) : (
        <p className="empty-state-inline">No activity in the last 7 days yet.</p>
      )}

      <div className="activity-chart-labels">
        {data.map((day, index) => (
          <span key={day.label + index}>{day.label}</span>
        ))}
      </div>
    </article>
  )
}
