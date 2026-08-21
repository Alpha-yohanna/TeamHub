import { searchFiles } from './fileService'
import { searchMessages } from './messageService'
import { searchProjects } from './projectService'
import { searchTasks } from './taskService'
import { searchTeams } from './teamService'
import { searchMembers } from './workspaceService'

const RECENT_SEARCHES_KEY = 'teamhub-recent-searches'
const MAX_RECENT_SEARCHES = 6

// Fans a single query out to every domain's own search function (each already scoped to the
// active workspace and subject to that table's RLS policy), so results never exceed what the
// user is independently allowed to see. Every branch fails independently — one table erroring
// (e.g. a transient network blip) doesn't blank the other groups.
export async function searchWorkspace(workspaceId, queryText) {
  const trimmed = queryText.trim()
  if (!trimmed) {
    return { messages: [], people: [], files: [], teams: [], projects: [], tasks: [] }
  }

  const [messages, people, files, teams, projects, tasks] = await Promise.allSettled([
    searchMessages(workspaceId, trimmed, 8),
    searchMembers(workspaceId, trimmed, 6),
    searchFiles(workspaceId, trimmed, 8),
    searchTeams(workspaceId, trimmed, 6),
    searchProjects(workspaceId, trimmed, 6),
    searchTasks(workspaceId, trimmed, 8),
  ])

  function unwrap(result) {
    return result.status === 'fulfilled' ? result.value : []
  }

  const hasError = [messages, people, files, teams, projects, tasks].some((result) => result.status === 'rejected')

  return {
    messages: unwrap(messages),
    people: unwrap(people),
    files: unwrap(files),
    teams: unwrap(teams),
    projects: unwrap(projects),
    tasks: unwrap(tasks),
    hasError,
  }
}

export function getRecentSearches() {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function addRecentSearch(queryText) {
  const trimmed = queryText.trim()
  if (!trimmed) return

  try {
    const existing = getRecentSearches().filter((entry) => entry.toLowerCase() !== trimmed.toLowerCase())
    const next = [trimmed, ...existing].slice(0, MAX_RECENT_SEARCHES)
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next))
  } catch {
    // Storage unavailable — recent searches simply won't persist this session.
  }
}

export function clearRecentSearches() {
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY)
  } catch {
    // ignore
  }
}
