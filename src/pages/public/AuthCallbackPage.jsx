import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { getActiveSession } from '../../services/authService'

const CALLBACK_TIMEOUT_MS = 10000

function readHashError() {
  // Supabase appends #error=...&error_code=...&error_description=... to the redirect when a
  // confirmation/magic link is invalid, already used, or expired — it never reaches our code as a
  // thrown exception, so we have to read it straight off the URL.
  const hash = window.location.hash?.startsWith('#') ? window.location.hash.slice(1) : ''
  const params = new URLSearchParams(hash || window.location.search)
  const errorCode = params.get('error_code') || params.get('error')
  if (!errorCode) return null

  if (errorCode.includes('expired') || errorCode === 'otp_expired') {
    return 'Verification link expired. Please request a new verification email.'
  }
  return "We couldn't complete your email verification. Please try again."
}

export function AuthCallbackPage({ onVerified }) {
  const [status, setStatus] = useState('verifying')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    const hashError = readHashError()
    if (hashError) {
      setErrorMessage(hashError)
      setStatus('error')
      window.history.replaceState(null, '', window.location.pathname)
      return () => {
        isMounted = false
      }
    }

    const timeoutId = setTimeout(() => {
      if (isMounted) {
        setErrorMessage("We couldn't complete your email verification. Please try again.")
        setStatus('error')
      }
    }, CALLBACK_TIMEOUT_MS)

    getActiveSession()
      .then((session) => {
        if (!isMounted) return
        clearTimeout(timeoutId)
        if (session) {
          setStatus('success')
        } else {
          setErrorMessage("We couldn't complete your email verification. Please try again.")
          setStatus('error')
        }
      })
      .catch(() => {
        if (!isMounted) return
        clearTimeout(timeoutId)
        setErrorMessage("We couldn't complete your email verification. Please try again.")
        setStatus('error')
      })
      .finally(() => {
        window.history.replaceState(null, '', window.location.pathname)
      })

    return () => {
      isMounted = false
      clearTimeout(timeoutId)
    }
  }, [])

  async function handleContinue() {
    const session = await getActiveSession()
    if (session) {
      onVerified(session)
    } else {
      setErrorMessage("We couldn't complete your email verification. Please try again.")
      setStatus('error')
    }
  }

  function handleBackToSignIn() {
    window.location.href = '/'
  }

  function handleTryAgain() {
    window.location.reload()
  }

  return (
    <main className="auth-shell">
      <span className="auth-orb auth-orb-a" aria-hidden="true" />
      <span className="auth-orb auth-orb-b" aria-hidden="true" />
      <span className="auth-grid" aria-hidden="true" />

      <section className="auth-card" aria-labelledby="callback-title">
        <div className="auth-brand">
          <span className="auth-logo">
            <img alt="TeamHub" height="34" src="/teamhub-logo.svg" width="34" />
          </span>
          <span className="auth-wordmark">TeamHub</span>
        </div>

        {status === 'verifying' && (
          <div className="auth-status-block">
            <span className="auth-spinner" aria-hidden="true" />
            <h2 id="callback-title">Verifying your email…</h2>
            <p>Hang tight while we confirm your TeamHub account.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="auth-status-block">
            <span className="auth-status-icon auth-status-icon-success" aria-hidden="true">
              ✓
            </span>
            <h2 id="callback-title">Email verified</h2>
            <p>Your TeamHub account is active. You're all set to start collaborating.</p>
            <Button className="full-button" onClick={handleContinue} type="button">
              Continue to dashboard
            </Button>
          </div>
        )}

        {status === 'error' && (
          <div className="auth-status-block">
            <span className="auth-status-icon auth-status-icon-error" aria-hidden="true">
              !
            </span>
            <h2 id="callback-title">Verification failed</h2>
            <p>{errorMessage}</p>
            <div className="auth-status-actions">
              <Button className="full-button" onClick={handleTryAgain} type="button">
                Try again
              </Button>
              <Button className="full-button auth-secondary-button" onClick={handleBackToSignIn} type="button" variant="ghost">
                Back to sign in
              </Button>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
