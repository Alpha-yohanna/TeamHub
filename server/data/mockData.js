export const currentUser = {
  id: 'user-alpha',
  name: 'Alpha Okafor',
  email: 'admin@teamhub.app',
  role: 'admin',
  status: 'online',
  workspaceId: 'workspace-alpha',
}

export const workspaces = [
  {
    id: 'workspace-alpha',
    name: 'Alpha Workspace',
    plan: 'Growth',
    members: 42,
  },
]

export const users = [
  { id: 'user-1', name: 'Maya Chen', email: 'maya@teamhub.app', role: 'Owner', status: 'Active' },
  { id: 'user-2', name: 'Daniel Reed', email: 'daniel@teamhub.app', role: 'Admin', status: 'Active' },
  { id: 'user-3', name: 'Aisha Bello', email: 'aisha@teamhub.app', role: 'Manager', status: 'Away' },
  { id: 'user-4', name: 'Victor Hale', email: 'victor@teamhub.app', role: 'Member', status: 'Active' },
]

export const teams = [
  {
    id: 'team-dev',
    name: 'Development Team',
    description: 'Builds and ships TeamHub product features.',
    members: 12,
    projects: 8,
  },
  {
    id: 'team-design',
    name: 'Design Team',
    description: 'Owns product design, research, and interface quality.',
    members: 7,
    projects: 4,
  },
  {
    id: 'team-marketing',
    name: 'Marketing Team',
    description: 'Plans launches, campaigns, content, and brand messaging.',
    members: 9,
    projects: 5,
  },
]

export const messages = [
  {
    id: 'msg-1',
    channel: 'development',
    author: 'Maya Chen',
    body: 'The workspace shell is ready for review.',
    createdAt: '2026-08-19T08:30:00.000Z',
  },
  {
    id: 'msg-2',
    channel: 'development',
    author: 'Alpha Okafor',
    body: 'Great. Let us keep the backend clean and connect it step by step.',
    createdAt: '2026-08-19T08:34:00.000Z',
  },
]

export const files = [
  {
    id: 'file-1',
    name: 'Product Requirements.pdf',
    type: 'Document',
    size: '2.4 MB',
    owner: 'Maya Chen',
    updatedAt: 'Today',
  },
  {
    id: 'file-2',
    name: 'Sprint Planning.xlsx',
    type: 'Spreadsheet',
    size: '846 KB',
    owner: 'Daniel Reed',
    updatedAt: 'Yesterday',
  },
]

export const notifications = [
  {
    id: 'notification-1',
    message: 'Sarah mentioned you in #development',
    category: 'mention',
    read: false,
    createdAt: '12 minutes ago',
  },
  {
    id: 'notification-2',
    message: 'John uploaded Product Requirements.pdf',
    category: 'file',
    read: true,
    createdAt: '1 hour ago',
  },
]

export const activity = [
  { id: 'activity-1', text: 'Alpha created Development Team', type: 'team', createdAt: 'Today' },
  { id: 'activity-2', text: 'Maya uploaded Product Requirements.pdf', type: 'file', createdAt: 'Today' },
  { id: 'activity-3', text: 'Daniel updated workspace settings', type: 'settings', createdAt: 'Yesterday' },
]

export const dashboard = {
  stats: [
    { label: 'Team members', value: 42, change: '+8% this month' },
    { label: 'Active projects', value: 12, change: '+3 this week' },
    { label: 'Messages', value: 1284, change: '+14% this week' },
    { label: 'Shared files', value: 328, change: '+21 this month' },
  ],
  activity,
  teams,
}
