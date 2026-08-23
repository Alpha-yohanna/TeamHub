warning: in the working copy of 'src/App.css', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/App.jsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/index.css', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/lib/theme.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/pages/app/SettingsPage.jsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/pages/public/LoginPage.jsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/services/authService.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/services/workspaceService.js', LF will be replaced by CRLF the next time Git touches it
[1mdiff --git a/src/App.css b/src/App.css[m
[1mindex ea6d325..008227b 100644[m
[1m--- a/src/App.css[m
[1m+++ b/src/App.css[m
[36m@@ -602,6 +602,97 @@[m
   letter-spacing: -0.01em;[m
 }[m
 [m
[32m+[m[32m.auth-status-block {[m
[32m+[m[32m  display: grid;[m
[32m+[m[32m  gap: 0.65rem;[m
[32m+[m[32m  justify-items: center;[m
[32m+[m[32m  text-align: center;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.auth-status-block h2 {[m
[32m+[m[32m  color: #0f172a;[m
[32m+[m[32m  font-size: 1.15rem;[m
[32m+[m[32m  font-weight: 800;[m
[32m+[m[32m  margin: 0.35rem 0 0;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.auth-status-block p {[m
[32m+[m[32m  color: #64748b;[m
[32m+[m[32m  font-size: 0.92rem;[m
[32m+[m[32m  line-height: 1.6;[m
[32m+[m[32m  margin: 0;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.auth-status-block p strong {[m
[32m+[m[32m  color: #0f172a;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.auth-status-actions {[m
[32m+[m[32m  display: grid;[m
[32m+[m[32m  gap: 0.6rem;[m
[32m+[m[32m  margin-top: 0.5rem;[m
[32m+[m[32m  width: 100%;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m/* Auth surfaces (login, check-email, verification) always render on a fixed white card[m
[32m+[m[32m   regardless of the app's dark/light preference, so secondary actions here use fixed light[m
[32m+[m[32m   colors rather than the --surface/--border/--strong theme variables the Button component's[m
[32m+[m[32m   secondary/ghost variants normally pull from — those would render as a near-black chip on this[m
[32m+[m[32m   white card whenever the signed-out visitor's OS or last saved preference is dark. */[m
[32m+[m[32m.auth-secondary-button.button-ghost,[m
[32m+[m[32m.auth-secondary-button.button-secondary {[m
[32m+[m[32m  background: #f8fafc;[m
[32m+[m[32m  border-color: #e2e8f0;[m
[32m+[m[32m  color: #0f172a;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.auth-secondary-button.button-ghost:hover,[m
[32m+[m[32m.auth-secondary-button.button-secondary:hover {[m
[32m+[m[32m  background: #eef2f8;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.auth-status-icon {[m
[32m+[m[32m  align-items: center;[m
[32m+[m[32m  border-radius: 999px;[m
[32m+[m[32m  display: grid;[m
[32m+[m[32m  font-size: 1.5rem;[m
[32m+[m[32m  font-weight: 800;[m
[32m+[m[32m  height: 3.25rem;[m
[32m+[m[32m  place-items: center;[m
[32m+[m[32m  width: 3.25rem;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.auth-status-icon-success {[m
[32m+[m[32m  background: #ecfdf5;[m
[32m+[m[32m  color: #047857;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.auth-status-icon-error {[m
[32m+[m[32m  background: #fef2f2;[m
[32m+[m[32m  color: #b91c1c;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.auth-status-icon-info {[m
[32m+[m[32m  background: #eff6ff;[m
[32m+[m[32m  color: #2563eb;[m
[32m+[m[32m  font-size: 1.35rem;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.auth-spinner {[m
[32m+[m[32m  animation: auth-spin 0.8s linear infinite;[m
[32m+[m[32m  border: 3px solid #e2e8f0;[m
[32m+[m[32m  border-radius: 999px;[m
[32m+[m[32m  border-top-color: #2563eb;[m
[32m+[m[32m  height: 2.5rem;[m
[32m+[m[32m  width: 2.5rem;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m@keyframes auth-spin {[m
[32m+[m[32m  to {[m
[32m+[m[32m    transform: rotate(360deg);[m
[32m+[m[32m  }[m
[32m+[m[32m}[m
[32m+[m
 .auth-tabs {[m
   background: #f2f5fa;[m
   border: 1px solid #e7ebf2;[m
[1mdiff --git a/src/App.jsx b/src/App.jsx[m
[1mindex 235bb0d..8b28067 100644[m
[1m--- a/src/App.jsx[m
[1m+++ b/src/App.jsx[m
[36m@@ -10,6 +10,7 @@[m [mimport { NotificationsPage } from './pages/app/NotificationsPage'[m
 import { ProjectsPage } from './pages/app/ProjectsPage'[m
 import { SettingsPage } from './pages/app/SettingsPage'[m
 import { TeamsPage } from './pages/app/TeamsPage'[m
[32m+[m[32mimport { AuthCallbackPage } from './pages/public/AuthCallbackPage'[m
 import { LoginPage } from './pages/public/LoginPage'[m
 import { applyTheme } from './lib/theme'[m
 import { getActiveSession, signOut } from './services/authService'[m
[36m@@ -163,6 +164,17 @@[m [mexport default function App() {[m
     return unsubscribe[m
   }, [authSource, currentUser?.id, activeWorkspaceId])[m
 [m
[32m+[m[32m  async function handleAuthCallbackVerified(session) {[m
[32m+[m[32m    // Drop the /auth/callback path once we're done with it so the app renders the normal[m
[32m+[m[32m    // dashboard shell instead of re-matching the callback route on the next render.[m
[32m+[m[32m    window.history.replaceState(null, '', '/')[m
[32m+[m[32m    await handleLogin({[m
[32m+[m[32m      role: session.user.role || 'admin',[m
[32m+[m[32m      user: session.user,[m
[32m+[m[32m      source: session.source,[m
[32m+[m[32m    })[m
[32m+[m[32m  }[m
[32m+[m
   async function handleLogin(session) {[m
     setRole(session.role)[m
     setCurrentUser(session.user)[m
[36m@@ -221,6 +233,10 @@[m [mexport default function App() {[m
     setPage(nextPage)[m
   }[m
 [m
[32m+[m[32m  if (window.location.pathname.startsWith('/auth/callback')) {[m
[32m+[m[32m    return <AuthCallbackPage onVerified={handleAuthCallbackVerified} />[m
[32m+[m[32m  }[m
[32m+[m
   if (isRestoringSession) {[m
     return null[m
   }[m
[1mdiff --git a/src/index.css b/src/index.css[m
[1mindex 703d389..8d3d441 100644[m
[1m--- a/src/index.css[m
[1m+++ b/src/index.css[m
[36m@@ -1,8 +1,8 @@[m
 :root {[m
[31m-  --page: #f7f9fc;[m
[32m+[m[32m  --page: #ffffff;[m
   --surface: #ffffff;[m
[31m-  --surface-muted: #eef3f9;[m
[31m-  --border: #d9e2ef;[m
[32m+[m[32m  --surface-muted: #f4f6f9;[m
[32m+[m[32m  --border: #e2e8f0;[m
   --text: #334155;[m
   --muted: #64748b;[m
   --strong: #0f172a;[m
[36m@@ -26,12 +26,12 @@[m
 [m
 @media (prefers-color-scheme: dark) {[m
   :root:not([data-theme="light"]) {[m
[31m-    --page: #09111f;[m
[31m-    --surface: #101a2b;[m
[31m-    --surface-muted: #162338;[m
[31m-    --border: #24344f;[m
[31m-    --text: #cbd5e1;[m
[31m-    --muted: #94a3b8;[m
[32m+[m[32m    --page: #000000;[m
[32m+[m[32m    --surface: #0a0a0a;[m
[32m+[m[32m    --surface-muted: #111111;[m
[32m+[m[32m    --border: #262626;[m
[32m+[m[32m    --text: #d4d4d8;[m
[32m+[m[32m    --muted: #a1a1aa;[m
     --strong: #f8fafc;[m
     --primary: #60a5fa;[m
     --primary-strong: #3b82f6;[m
[36m@@ -40,7 +40,7 @@[m
     --success-soft: rgba(16, 185, 129, 0.12);[m
     --success-border: rgba(110, 231, 183, 0.22);[m
     --focus: rgba(96, 165, 250, 0.34);[m
[31m-    --shadow: 0 24px 70px rgba(0, 0, 0, 0.34);[m
[32m+[m[32m    --shadow: 0 24px 70px rgba(0, 0, 0, 0.6);[m
   }[m
 }[m
 [m
[36m@@ -49,12 +49,12 @@[m
    guaranteed — [data-theme] adds an attribute selector, so it always outranks the bare :root[m
    inside the media query. */[m
 :root[data-theme="dark"] {[m
[31m-  --page: #09111f;[m
[31m-  --surface: #101a2b;[m
[31m-  --surface-muted: #162338;[m
[31m-  --border: #24344f;[m
[31m-  --text: #cbd5e1;[m
[31m-  --muted: #94a3b8;[m
[32m+[m[32m  --page: #000000;[m
[32m+[m[32m  --surface: #0a0a0a;[m
[32m+[m[32m  --surface-muted: #111111;[m
[32m+[m[32m  --border: #262626;[m
[32m+[m[32m  --text: #d4d4d8;[m
[32m+[m[32m  --muted: #a1a1aa;[m
   --strong: #f8fafc;[m
   --primary: #60a5fa;[m
   --primary-strong: #3b82f6;[m
[36m@@ -63,14 +63,14 @@[m
   --success-soft: rgba(16, 185, 129, 0.12);[m
   --success-border: rgba(110, 231, 183, 0.22);[m
   --focus: rgba(96, 165, 250, 0.34);[m
[31m-  --shadow: 0 24px 70px rgba(0, 0, 0, 0.34);[m
[32m+[m[32m  --shadow: 0 24px 70px rgba(0, 0, 0, 0.6);[m
 }[m
 [m
 :root[data-theme="light"] {[m
[31m-  --page: #f7f9fc;[m
[32m+[m[32m  --page: #ffffff;[m
   --surface: #ffffff;[m
[31m-  --surface-muted: #eef3f9;[m
[31m-  --border: #d9e2ef;[m
[32m+[m[32m  --surface-muted: #f4f6f9;[m
[32m+[m[32m  --border: #e2e8f0;[m
   --text: #334155;[m
   --muted: #64748b;[m
   --strong: #0f172a;[m
[1mdiff --git a/src/lib/theme.js b/src/lib/theme.js[m
[1mindex 3a36e55..67cd923 100644[m
[1m--- a/src/lib/theme.js[m
[1m+++ b/src/lib/theme.js[m
[36m@@ -1,12 +1,15 @@[m
 const STORAGE_KEY = 'teamhub-theme'[m
 const VALID_THEMES = ['light', 'dark', 'system'][m
[32m+[m[32m// New users (nothing in localStorage yet) always start on light — the app must never default[m
[32m+[m[32m// a first-time visitor into dark mode based on OS preference.[m
[32m+[m[32mconst DEFAULT_THEME = 'light'[m
 [m
 export function getStoredTheme() {[m
   try {[m
     const value = localStorage.getItem(STORAGE_KEY)[m
[31m-    return VALID_THEMES.includes(value) ? value : 'system'[m
[32m+[m[32m    return VALID_THEMES.includes(value) ? value : DEFAULT_THEME[m
   } catch {[m
[31m-    return 'system'[m
[32m+[m[32m    return DEFAULT_THEME[m
   }[m
 }[m
 [m
[1mdiff --git a/src/pages/app/SettingsPage.jsx b/src/pages/app/SettingsPage.jsx[m
[1mindex efff8a5..e7479a2 100644[m
[1m--- a/src/pages/app/SettingsPage.jsx[m
[1m+++ b/src/pages/app/SettingsPage.jsx[m
[36m@@ -324,7 +324,7 @@[m [mfunction NotificationsTab({ currentUser, isLive }) {[m
 }[m
 [m
 function AppearanceTab({ currentUser, isLive }) {[m
[31m-  const [theme, setTheme] = useState('system')[m
[32m+[m[32m  const [theme, setTheme] = useState('light')[m
   const [isLoading, setIsLoading] = useState(true)[m
   const [error, setError] = useState('')[m
 [m
[36m@@ -336,7 +336,7 @@[m [mfunction AppearanceTab({ currentUser, isLive }) {[m
     let isMounted = true[m
     getUserPreferences(currentUser.id)[m
       .then((data) => {[m
[31m-        if (isMounted) setTheme(data.theme || 'system')[m
[32m+[m[32m        if (isMounted) setTheme(data.theme || 'light')[m
       })[m
       .catch((err) => {[m
         if (isMounted) setError(err.message)[m
[1mdiff --git a/src/pages/public/LoginPage.jsx b/src/pages/public/LoginPage.jsx[m
[1mindex cbd28b4..e6115a8 100644[m
[1m--- a/src/pages/public/LoginPage.jsx[m
[1m+++ b/src/pages/public/LoginPage.jsx[m
[36m@@ -1,6 +1,7 @@[m
 import { useState } from 'react'[m
 import { Button } from '../../components/ui/Button'[m
 import { signInWithEmail, signUpWithEmail } from '../../services/authService'[m
[32m+[m[32mimport { CheckEmailScreen } from './CheckEmailScreen'[m
 [m
 function EyeIcon({ open }) {[m
   if (open) {[m
[36m@@ -56,21 +57,19 @@[m [mexport function LoginPage({ onLogin }) {[m
   const [password, setPassword] = useState('')[m
   const [isPasswordVisible, setIsPasswordVisible] = useState(false)[m
   const [errorMessage, setErrorMessage] = useState('')[m
[31m-  const [infoMessage, setInfoMessage] = useState('')[m
   const [isSubmitting, setIsSubmitting] = useState(false)[m
[32m+[m[32m  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState(null)[m
   const isSignUp = mode === 'signup'[m
 [m
   function switchMode(nextMode) {[m
     setMode(nextMode)[m
     setSignupIntent(null)[m
     setErrorMessage('')[m
[31m-    setInfoMessage('')[m
   }[m
 [m
   async function handleSubmit(event) {[m
     event.preventDefault()[m
     setErrorMessage('')[m
[31m-    setInfoMessage('')[m
     setIsSubmitting(true)[m
 [m
     try {[m
[36m@@ -91,8 +90,7 @@[m [mexport function LoginPage({ onLogin }) {[m
         : await signInWithEmail({ email, password })[m
 [m
       if (session.requiresEmailConfirmation) {[m
[31m-        setInfoMessage('Account created. Check your email to confirm before logging in.')[m
[31m-        setMode('login')[m
[32m+[m[32m        setPendingConfirmationEmail(session.user.email)[m
         return[m
       }[m
 [m
[36m@@ -108,6 +106,18 @@[m [mexport function LoginPage({ onLogin }) {[m
     }[m
   }[m
 [m
[32m+[m[32m  if (pendingConfirmationEmail) {[m
[32m+[m[32m    return ([m
[32m+[m[32m      <CheckEmailScreen[m
[32m+[m[32m        email={pendingConfirmationEmail}[m
[32m+[m[32m        onBackToSignIn={() => {[m
[32m+[m[32m          setPendingConfirmationEmail(null)[m
[32m+[m[32m          switchMode('login')[m
[32m+[m[32m        }}[m
[32m+[m[32m      />[m
[32m+[m[32m    )[m
[32m+[m[32m  }[m
[32m+[m
   return ([m
     <main className="auth-shell">[m
       <span className="auth-orb auth-orb-a" aria-hidden="true" />[m
[36m@@ -233,7 +243,6 @@[m [mexport function LoginPage({ onLogin }) {[m
                 {errorMessage}[m
               </p>[m
             )}[m
[31m-            {infoMessage && <p className="auth-note">{infoMessage}</p>}[m
 [m
             <Button className="full-button" disabled={isSubmitting} type="submit">[m
               {isSubmitting ? '...' : isSignUp ? 'Create account' : 'Log in'}[m
[1mdiff --git a/src/services/authService.js b/src/services/authService.js[m
[1mindex defbed0..409fef3 100644[m
[1m--- a/src/services/authService.js[m
[1m+++ b/src/services/authService.js[m
[36m@@ -1,3 +1,4 @@[m
[32m+[m[32mimport { getAuthCallbackUrl } from '../lib/authRedirect'[m
 import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'[m
 import { getProfile } from './workspaceService'[m
 [m
[36m@@ -31,6 +32,7 @@[m [mexport async function signUpWithEmail({ email, password, fullName }) {[m
     password,[m
     options: {[m
       data: { full_name: fullName },[m
[32m+[m[32m      emailRedirectTo: getAuthCallbackUrl(),[m
     },[m
   })[m
 [m
[36m@@ -49,6 +51,26 @@[m [mexport async function signUpWithEmail({ email, password, fullName }) {[m
   return buildSupabaseSession(data.user)[m
 }[m
 [m
[32m+[m[32m// Lets someone re-request the signup confirmation email (link expired, email lost) without[m
[32m+[m[32m// creating a duplicate account.[m
[32m+[m[32mexport async function resendSignUpEmail(email) {[m
[32m+[m[32m  if (!isSupabaseConfigured) {[m
[32m+[m[32m    throw new Error(NOT_CONFIGURED_MESSAGE)[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  const { error } = await supabase.auth.resend({[m
[32m+[m[32m    type: 'signup',[m
[32m+[m[32m    email,[m
[32m+[m[32m    options: {[m
[32m+[m[32m      emailRedirectTo: getAuthCallbackUrl(),[m
[32m+[m[32m    },[m
[32m+[m[32m  })[m
[32m+[m
[32m+[m[32m  if (error) {[m
[32m+[m[32m    throw new Error(error.message)[m
[32m+[m[32m  }[m
[32m+[m[32m}[m
[32m+[m
 export async function signInWithEmail({ email, password }) {[m
   if (!isSupabaseConfigured) {[m
     throw new Error(NOT_CONFIGURED_MESSAGE)[m
[1mdiff --git a/src/services/workspaceService.js b/src/services/workspaceService.js[m
[1mindex 04c697e..3cb7d29 100644[m
[1m--- a/src/services/workspaceService.js[m
[1m+++ b/src/services/workspaceService.js[m
[36m@@ -66,7 +66,7 @@[m [mexport async function getUserPreferences(userId) {[m
   return ([m
     data ?? {[m
       user_id: userId,[m
[31m-      theme: 'system',[m
[32m+[m[32m      theme: 'light',[m
       notify_mentions: true,[m
       notify_direct_messages: true,[m
       notify_task_assignments: true,[m
