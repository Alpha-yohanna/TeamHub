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

export function UsersIcon(props) {
  return (
    <svg height="18" width="18" {...commonProps} {...props}>
      <circle cx="8.5" cy="7.5" r="3" />
      <path d="M3 19c.5-3 2.5-4.5 5.5-4.5S13.5 16 14 19" />
      <path d="M15.5 4.7a2.8 2.8 0 0 1 0 5.4" />
      <path d="M16.2 14.7c2 .4 3.3 1.8 3.7 4.3" />
    </svg>
  )
}

export function CheckCircleIcon(props) {
  return (
    <svg height="18" width="18" {...commonProps} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.3 12.3l2.4 2.4 5-5.2" />
    </svg>
  )
}

export function ChecklistIcon(props) {
  return (
    <svg height="18" width="18" {...commonProps} {...props}>
      <path d="M4.5 6.5l1.6 1.6L8.8 5" />
      <path d="M11.5 6h8" />
      <path d="M4.5 12.5l1.6 1.6 2.7-3.1" />
      <path d="M11.5 12h8" />
      <path d="M4.5 18.5l1.6 1.6 2.7-3.1" />
      <path d="M11.5 18h8" />
    </svg>
  )
}

export function TrendUpIcon(props) {
  return (
    <svg height="12" width="12" {...commonProps} {...props}>
      <path d="M4 16l6-6 4 4 6-8" />
      <path d="M15 6h5v5" />
    </svg>
  )
}

export function ProfileIcon(props) {
  return (
    <svg height="18" width="18" {...commonProps} {...props}>
      <circle cx="12" cy="8.2" r="3.5" />
      <path d="M4.8 19.5c.9-3.6 3.3-5.5 7.2-5.5s6.3 1.9 7.2 5.5" />
    </svg>
  )
}

export function SignOutIcon(props) {
  return (
    <svg height="18" width="18" {...commonProps} {...props}>
      <path d="M13 4H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20H13" />
      <path d="M10.5 12H21" />
      <path d="M17.5 8.5L21 12l-3.5 3.5" />
    </svg>
  )
}

export function ChevronDownIcon(props) {
  return (
    <svg height="16" width="16" {...commonProps} {...props}>
      <path d="M5.5 8.5l6.5 6.5 6.5-6.5" />
    </svg>
  )
}

export function CheckIcon(props) {
  return (
    <svg height="16" width="16" {...commonProps} {...props}>
      <path d="M4.5 12.5l5 5 10-10" />
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
