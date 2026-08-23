import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { resendSignUpEmail } from '../../services/authService'

export function CheckEmailScreen({ email, onBackToSignIn }) {
  const [resendState, setResendState] = useState('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleResend() {
    setResendState('sending')
    setErrorMessage('')
    try {
      await resendSignUpEmail(email)
      setResendState('sent')
    } catch (error) {
      setErrorMessage(error.message || "We couldn't resend the email. Please try again.")
      setResendState('idle')
    }
  }

  return (
    <main className="auth-shell">
      <span className="auth-orb auth-orb-a" aria-hidden="true" />
      <span className="auth-orb auth-orb-b" aria-hidden="true" />
      <span className="auth-grid" aria-hidden="true" />

      <section className="auth-card" aria-labelledby="check-email-title">
        <div className="auth-brand">
          <span className="auth-logo">
            <img alt="TeamHub" height="34" src="/teamhub-logo.svg" width="34" />
          </span>
          <span className="auth-wordmark">TeamHub</span>
        </div>

        <div className="auth-status-block">
          <span className="auth-status-icon auth-status-icon-info" aria-hidden="true">
            ✉
          </span>
          <h2 id="check-email-title">Check your inbox</h2>
          <p>
            We've sent a verification link{email ? (
              <>
                {' '}
                to <strong>{email}</strong>
              </>
            ) : null}
            .
          </p>
          <p>Click "Verify my TeamHub account" in the email to activate your account.</p>

          {resendState === 'sent' && <p className="auth-note">Verification email resent. Check your inbox.</p>}
          {errorMessage && (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          )}

          <div className="auth-status-actions">
            <Button
              className="full-button auth-secondary-button"
              disabled={resendState === 'sending' || !email}
              onClick={handleResend}
              type="button"
              variant="secondary"
            >
              {resendState === 'sending' ? 'Sending…' : 'Resend verification email'}
            </Button>
            <Button className="full-button auth-secondary-button" onClick={onBackToSignIn} type="button" variant="ghost">
              Back to sign in
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
