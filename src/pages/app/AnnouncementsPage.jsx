import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { timeAgo } from '../../lib/formatters'
import { listAnnouncementHistory, sendAnnouncementToAll, sendTestAnnouncement } from '../../services/announcementService'

const MAX_SUBJECT_LENGTH = 200
const MAX_MESSAGE_LENGTH = 20000

// Announcements are a platform-wide admin feature (currentUser.isSuperAdmin), a
// separate concept from the per-workspace owner/admin roles every other page checks —
// see App.jsx and services/authService.js for how that flag is derived.
export function AnnouncementsPage({ currentUser }) {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [testedContent, setTestedContent] = useState(null)
  const [history, setHistory] = useState([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [isSendingTest, setIsSendingTest] = useState(false)
  const [isSendingAll, setIsSendingAll] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const isSuperAdmin = Boolean(currentUser?.isSuperAdmin)
  const canSendAll = testedContent && testedContent.subject === subject.trim() && testedContent.message === message.trim()

  useEffect(() => {
    if (!isSuperAdmin) {
      setIsLoadingHistory(false)
      return
    }

    let isMounted = true
    listAnnouncementHistory()
      .then((rows) => {
        if (isMounted) setHistory(rows)
      })
      .catch((err) => {
        if (isMounted) setError(err.message)
      })
      .finally(() => {
        if (isMounted) setIsLoadingHistory(false)
      })

    return () => {
      isMounted = false
    }
  }, [isSuperAdmin])

  if (!isSuperAdmin) {
    return (
      <section className="dashboard-page" aria-labelledby="announcements-title">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Restricted</p>
            <h1 id="announcements-title">Announcements</h1>
            <p>You don't have access to this page.</p>
          </div>
        </div>
      </section>
    )
  }

  async function handleSendTest(event) {
    event.preventDefault()
    setError('')
    setNotice('')

    const cleanSubject = subject.trim()
    const cleanMessage = message.trim()
    if (!cleanSubject || !cleanMessage) {
      setError('Subject and message are both required.')
      return
    }

    setIsSendingTest(true)
    try {
      await sendTestAnnouncement({ subject: cleanSubject, message: cleanMessage })
      setTestedContent({ subject: cleanSubject, message: cleanMessage })
      setNotice(`Test email sent to ${currentUser.email}. Check your inbox, then you can send to all users.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSendingTest(false)
    }
  }

  async function handleSendAll() {
    setError('')
    setNotice('')

    if (!canSendAll) return
    const confirmed = window.confirm(
      'This will email every registered TeamHub user. Are you sure you want to send this announcement to all users?',
    )
    if (!confirmed) return

    setIsSendingAll(true)
    try {
      const result = await sendAnnouncementToAll({ subject: testedContent.subject, message: testedContent.message })
      setNotice(`Announcement sent to ${result.sentCount} user(s)${result.failedCount ? ` (${result.failedCount} failed)` : ''}.`)
      setTestedContent(null)
      setSubject('')
      setMessage('')
      const rows = await listAnnouncementHistory()
      setHistory(rows)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSendingAll(false)
    }
  }

  return (
    <section className="dashboard-page" aria-labelledby="announcements-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Platform admin</p>
          <h1 id="announcements-title">Announcements</h1>
          <p>Send a branded email announcement to TeamHub users. Always test before sending to everyone.</p>
        </div>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {notice && <p className="form-success">{notice}</p>}

      <article className="panel-card">
        <div className="panel-header">
          <h2>Compose announcement</h2>
        </div>

        <form onSubmit={handleSendTest}>
          <div className="task-modal-field" style={{ marginBottom: '0.75rem' }}>
            <label htmlFor="announcement-subject">Subject</label>
            <input
              id="announcement-subject"
              maxLength={MAX_SUBJECT_LENGTH}
              onChange={(event) => {
                setSubject(event.target.value)
                setTestedContent(null)
              }}
              placeholder="e.g. Scheduled maintenance this weekend"
              required
              type="text"
              value={subject}
            />
          </div>

          <div className="task-modal-field" style={{ marginBottom: '1rem' }}>
            <label htmlFor="announcement-message">Message</label>
            <textarea
              id="announcement-message"
              maxLength={MAX_MESSAGE_LENGTH}
              onChange={(event) => {
                setMessage(event.target.value)
                setTestedContent(null)
              }}
              placeholder="Write the announcement message…"
              required
              rows={8}
              value={message}
            />
          </div>

          <div className="row-actions" style={{ justifyContent: 'flex-start', gap: '0.75rem' }}>
            <Button disabled={isSendingTest} type="submit">
              {isSendingTest ? 'Sending test…' : `Send test to ${currentUser.email}`}
            </Button>
            <Button disabled={!canSendAll || isSendingAll} onClick={handleSendAll} type="button" variant="secondary">
              {isSendingAll ? 'Sending to all…' : 'Send to all users'}
            </Button>
          </div>

          {!canSendAll && (
            <p className="auth-note-tiny">Send a test to your own email first — matching the exact subject and message — to enable "Send to all users".</p>
          )}
        </form>
      </article>

      <article className="panel-card">
        <div className="panel-header">
          <h2>Recent announcements</h2>
        </div>
        {isLoadingHistory ? (
          <p className="empty-state-inline">Loading history…</p>
        ) : history.length === 0 ? (
          <p className="empty-state-inline">No announcements sent yet.</p>
        ) : (
          <div className="user-list">
            {history.map((item) => (
              <div className="user-row" key={item.id}>
                <div>
                  <strong>{item.subject}</strong>
                  <span>
                    {item.scope === 'all' ? 'Sent to all users' : 'Test send'} · {item.recipient_count} recipient(s) · {timeAgo(item.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  )
}
