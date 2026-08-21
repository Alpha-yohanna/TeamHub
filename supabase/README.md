# TeamHub Supabase Setup

TeamHub will use Supabase for authentication, database, file storage, and realtime collaboration.

## Step 1: Foundation Tables

The first migration creates:

- `profiles`: public user profile data connected to `auth.users`
- `workspaces`: organizations or team spaces inside TeamHub
- `workspace_members`: connects users to workspaces and stores their role

These tables must come first because every later feature depends on users belonging to a workspace.

## Recommended Build Order

1. Foundation tables: `profiles`, `workspaces`, `workspace_members`
2. Team tables: `teams`, `team_members`
3. Communication tables: `channels`, `messages`, `message_reactions`
4. Resource tables: `files`, `folders`
5. Productivity tables: `projects`, `tasks`, `calendar_events`
6. System tables: `notifications`, `activity_logs`, `invitations`

## How To Run The First SQL

Open your Supabase project dashboard, go to SQL Editor, and run the contents of:

`supabase/migrations/001_foundation_tables.sql`

We will connect the frontend after the auth and workspace foundation is ready.

## Step 2: Connect The Frontend

The React app now has:

- `src/lib/supabaseClient.js`
- `src/services/authService.js`
- `.env.example`

Create a local environment file named `.env.local` in the project root:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

Get these values from your Supabase dashboard:

1. Open your Supabase project.
2. Go to Project Settings.
3. Open API.
4. Copy the Project URL into `VITE_SUPABASE_URL`.
5. Copy the publishable anon key into `VITE_SUPABASE_PUBLISHABLE_KEY`.

Do not use the service role key in the frontend.
