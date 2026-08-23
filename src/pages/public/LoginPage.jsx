import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { signInWithEmail, signUpWithEmail } from '../../services/authService'

function EyeIcon({ open }) {
  if (open) {
    return (
      <svg fill="none" height="18" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    )
  }

  return (
    <svg fill="none" height="18" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M3 3l18 18M10.6 10.7a3 3 0 0 0 4.24 4.24M6.4 6.6C4 8.2 2 12 2 12s3.6 7 10 7c1.83 0 3.42-.42 4.78-1.02M9.9 4.24A10.7 10.7 0 0 1 12 4c6.4 0 10 7 10 7-.53 1.03-1.28 2.16-2.24 3.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

const SIGNUP_INTENT_STORAGE_KEY = 'teamhub-signup-intent'

const SIGNUP_INTENTS = [
  {
    id: 'create',
    icon: '🏢',
    title: 'Create a Workspace',
    description: 'For founders, business owners, managers, or people starting a new organization.',
  },
  {
    id: 'join',
    icon: '👤',
    title: 'Join a Workspace',
    description: 'For employees and team members who have been invited.',
  },
]

export function LoginPage({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [signupIntent, setSignupIntent] = useState(null)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isSignUp = mode === 'signup'

  function switchMode(nextMode) {
    setMode(nextMode)
    setSignupIntent(null)
    setErrorMessage('')
    setInfoMessage('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')
    setInfoMessage('')
    setIsSubmitting(true)

    try {
      if (isSignUp) {
        // Read on first authenticated load (App.jsx) to decide whether the auto-provisioned
        // workspace should surface the owner-setup wizard or stay out of the way for someone who
        // said they're joining an existing team. Survives the email-confirmation redirect, since
        // there's no session — and therefore no other place to carry this — until then.
        try {
          localStorage.setItem(SIGNUP_INTENT_STORAGE_KEY, signupIntent || 'create')
        } catch {
          // Storage unavailable — the app falls back to always showing the owner wizard.
        }
      }

      const session = isSignUp
        ? await signUpWithEmail({ email, password, fullName })
        : await signInWithEmail({ email, password })

      if (session.requiresEmailConfirmation) {
        setInfoMessage('Account created. Check your email to confirm before logging in.')
        setMode('login')
        return
      }

      onLogin({
        role: session.user.role || 'admin',
        user: session.user,
        source: session.source,
      })
    } catch (error) {
      setErrorMessage(error.message || 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-shell">
      <span className="auth-orb auth-orb-a" aria-hidden="true" />
      <span className="auth-orb auth-orb-b" aria-hidden="true" />
      <span className="auth-grid" aria-hidden="true" />

      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand">
          <span className="auth-logo">
            <img alt="TeamHub" height="34" src="/teamhub-logo.svg" width="34" />
          </span>
          <span id="auth-title" className="auth-wordmark">TeamHub</span>
        </div>

        <div className="auth-tabs" role="tablist">
          <button
            aria-selected={!isSignUp}
            className={!isSignUp ? 'active' : ''}
            onClick={() => switchMode('login')}
            role="tab"
            type="button"
          >
            Log in
          </button>
          <button
            aria-selected={isSignUp}
            className={isSignUp ? 'active' : ''}
            onClick={() => switchMode('signup')}
            role="tab"
            type="button"
          >
            Sign up
          </button>
        </div>

        {isSignUp && !signupIntent ? (
          <div>
            <div className="signup-intent-heading">
              <h2>How will you use TeamHub?</h2>
              <p>This just tailors what you see next — you can always invite more people later.</p>
            </div>
            <div className="signup-intent-grid" role="radiogroup" aria-label="How will you use TeamHub?">
              {SIGNUP_INTENTS.map((intent) => (
                <button
                  aria-label={`${intent.title}. ${intent.description}`}
                  className="signup-intent-card"
                  key={intent.id}
                  onClick={() => setSignupIntent(intent.id)}
                  role="radio"
                  aria-checked="false"
                  type="button"
                >
                  <span aria-hidden="true" className="signup-intent-icon">
                    {intent.icon}
                  </span>
                  <span>
                    <strong>{intent.title}</strong>
                    <span>{intent.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <form className="auth-form-minimal" onSubmit={handleSubmit}>
            {isSignUp && (
              <div className="signup-intent-selected">
                <span>
                  {SIGNUP_INTENTS.find((intent) => intent.id === signupIntent)?.icon}{' '}
                  {SIGNUP_INTENTS.find((intent) => intent.id === signupIntent)?.title}
                </span>
                <button onClick={() => setSignupIntent(null)} type="button">
                  Change
                </button>
              </div>
            )}

            {isSignUp && (
              <input
                aria-label="Full name"
                autoComplete="name"
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Name"
                required
                type="text"
                value={fullName}
              />
            )}

            <input
              aria-label="Email address"
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              required
              type="email"
              value={email}
            />

            <div className="auth-password-field">
              <input
                aria-label="Password"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                minLength={6}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                required
                type={isPasswordVisible ? 'text' : 'password'}
                value={password}
              />
              <button
                aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
                className="auth-password-toggle"
                onClick={() => setIsPasswordVisible((visible) => !visible)}
                type="button"
              >
                <EyeIcon open={isPasswordVisible} />
              </button>
            </div>

            {errorMessage && (
              <p className="form-error" role="alert">
                {errorMessage}
              </p>
            )}
            {infoMessage && <p className="auth-note">{infoMessage}</p>}

            <Button className="full-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? '...' : isSignUp ? 'Create account' : 'Log in'}
            </Button>
          </form>
        )}
      </section>
    </main>
  )
}
