const commonProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  strokeWidth: 1.6,
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg',
}

export function DashboardIcon(props) {
  return (
    <svg height="18" width="18" {...commonProps} {...props}>
      <rect height="8" rx="1.6" width="8" x="3" y="3" />
      <rect height="5" rx="1.6" width="8" x="13" y="3" />
      <rect height="10" rx="1.6" width="8" x="13" y="11" />
      <rect height="5" rx="1.6" width="8" x="3" y="16" />
    </svg>
  )
}

export function MessagesIcon(props) {
  return (
    <svg height="18" width="18" {...commonProps} {...props}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-8Z" />
    </svg>
  )
}

export function TeamsIcon(props) {
  return (
    <svg height="18" width="18" {...commonProps} {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c.6-3 2.7-4.6 5.5-4.6s4.9 1.6 5.5 4.6" />
      <path d="M15.7 4.9a3.2 3.2 0 0 1 0 6.2" />
      <path d="M15 14.6c2.4.3 4 1.8 4.5 4.4" />
    </svg>
  )
}

export function ProjectsIcon(props) {
  return (
    <svg height="18" width="18" {...commonProps} {...props}>
      <path d="M4 6.5a2 2 0 0 1 2-2h3.2l1.5 1.8H18a2 2 0 0 1 2 2v8.2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6.5Z" />
      <path d="M8 13.2l2.2 2.2 5-5" />
    </svg>
  )
}

export function FilesIcon(props) {
  return (
    <svg height="18" width="18" {...commonProps} {...props}>
      <path d="M3.5 6.8a1.8 1.8 0 0 1 1.8-1.8h3.7l1.7 2h7a1.8 1.8 0 0 1 1.8 1.8v7.4A1.8 1.8 0 0 1 17.7 18H5.3a1.8 1.8 0 0 1-1.8-1.8V6.8Z" />
    </svg>
  )
}

export function NotificationsIcon(props) {
  return (
    <svg height="18" width="18" {...commonProps} {...props}>
      <path d="M6 9.5a6 6 0 0 1 12 0c0 3.4 1 5 1.6 5.8H4.4C5 14.5 6 12.9 6 9.5Z" />
      <path d="M10.2 18.5a1.9 1.9 0 0 0 3.6 0" />
    </svg>
  )
}

export function ActivityIcon(props) {
  return (
    <svg height="18" width="18" {...commonProps} {...props}>
      <path d="M3 12h3.5l2-6 4 12 2-9 1.5 3H21" />
    </svg>
  )
}

export function SearchIcon(props) {
  return (
    <svg height="18" width="18" {...commonProps} {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M20 20l-4.3-4.3" />
    </svg>
  )
}

export function LockIcon(props) {
  return (
    <svg height="18" width="18" {...commonProps} {...props}>
      <rect height="10" rx="1.8" width="14" x="5" y="10" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

export function SettingsIcon(props) {
  return (
    <svg height="18" width="18" {...commonProps} {...props}>
      <circle cx="12" cy="12" r="2.8" />
      <path d="M19.4 13.5a1.7 1.7 0 0 0 .35 1.9l.06.06a2.1 2.1 0 1 1-2.97 2.97l-.06-.06a1.7 1.7 0 0 0-1.9-.35 1.7 1.7 0 0 0-1.04 1.56v.17a2.1 2.1 0 1 1-4.2 0v-.09a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.9.35l-.06.06a2.1 2.1 0 1 1-2.97-2.97l.06-.06a1.7 1.7 0 0 0 .35-1.9 1.7 1.7 0 0 0-1.56-1.04h-.17a2.1 2.1 0 1 1 0-4.2h.09a1.7 1.7 0 0 0 1.55-1.1 1.7 1.7 0 0 0-.35-1.9l-.06-.06a2.1 2.1 0 1 1 2.97-2.97l.06.06a1.7 1.7 0 0 0 1.9.35h.08a1.7 1.7 0 0 0 1.04-1.56v-.17a2.1 2.1 0 1 1 4.2 0v.09a1.7 1.7 0 0 0 1.04 1.55 1.7 1.7 0 0 0 1.9-.35l.06-.06a2.1 2.1 0 1 1 2.97 2.97l-.06.06a1.7 1.7 0 0 0-.35 1.9v.08a1.7 1.7 0 0 0 1.56 1.04h.17a2.1 2.1 0 1 1 0 4.2h-.09a1.7 1.7 0 0 0-1.55 1.04Z" />
    </svg>
  )
}
