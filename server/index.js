import { createServer } from 'node:http'
import {
  activity,
  currentUser,
  dashboard,
  files,
  messages,
  notifications,
  teams,
  users,
  workspaces,
} from './data/mockData.js'
import { readBody, sendJson } from './utils/http.js'

const port = Number(process.env.PORT) || 4000

const routes = {
  'GET /api/health': () => ({
    ok: true,
    service: 'TeamHub API',
    status: 'healthy',
  }),
  'GET /api/me': () => currentUser,
  'GET /api/workspaces': () => workspaces,
  'GET /api/dashboard': () => dashboard,
  'GET /api/users': () => users,
  'GET /api/teams': () => teams,
  'GET /api/messages': () => messages,
  'GET /api/files': () => files,
  'GET /api/notifications': () => notifications,
  'GET /api/activity': () => activity,
}

async function handleLogin(request) {
  const body = await readBody(request)
  const role = body.role === 'member' ? 'member' : 'admin'

  return {
    user: {
      ...currentUser,
      role,
    },
    token: 'teamhub-demo-token',
    message: 'Demo login successful',
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`)
  const routeKey = `${request.method} ${url.pathname}`

  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {})
    return
  }

  try {
    if (routeKey === 'POST /api/auth/login') {
      sendJson(response, 200, await handleLogin(request))
      return
    }

    const route = routes[routeKey]

    if (!route) {
      sendJson(response, 404, {
        error: 'Not found',
        message: 'The requested TeamHub API route does not exist.',
      })
      return
    }

    sendJson(response, 200, route())
  } catch {
    sendJson(response, 400, {
      error: 'Bad request',
      message: 'TeamHub could not process this request.',
    })
  }
})

server.listen(port, () => {
  console.log(`TeamHub API running on http://localhost:${port}`)
})
