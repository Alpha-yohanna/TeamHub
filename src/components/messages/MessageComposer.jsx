import { useRef, useState } from 'react'
import { Button } from '../ui/Button'
import { EMOJI_PALETTE } from './emojiPalette'

export function MessageComposer({ placeholder, members, initialValue = '', isEditing = false, onSubmit, onCancelEdit }) {
  const [content, setContent] = useState(initialValue)
  const [mentioned, setMentioned] = useState(new Map())
  const [attachment, setAttachment] = useState(null)
  const [status, setStatus] = useState('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [mentionQuery, setMentionQuery] = useState(null)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)

  function handleChange(event) {
    const value = event.target.value
    setContent(value)
    const cursor = event.target.selectionStart
    const beforeCursor = value.slice(0, cursor)
    const match = beforeCursor.match(/@([a-zA-Z0-9 ]{0,24})$/)
    setMentionQuery(match ? match[1] : null)
  }

  function insertMention(member) {
    const cursor = textareaRef.current?.selectionStart ?? content.length
    const before = content.slice(0, cursor).replace(/@([a-zA-Z0-9 ]{0,24})$/, `@${member.full_name} `)
    const after = content.slice(cursor)
    setContent(before + after)
    setMentioned((prev) => new Map(prev).set(member.full_name, member.id))
    setMentionQuery(null)
    textareaRef.current?.focus()
  }

  function insertEmoji(emoji) {
    setContent((prev) => prev + emoji)
    setShowEmoji(false)
    textareaRef.current?.focus()
  }

  async function handleSubmit(event) {
    event?.preventDefault?.()
    if (status === 'sending') return
    if (!content.trim() && !attachment) return
    setStatus('sending')
    setErrorMessage('')

    const mentionedUserIds = Array.from(mentioned.entries())
      .filter(([name]) => content.includes(`@${name}`))
      .map(([, id]) => id)

    try {
      await onSubmit({ content: content.trim(), mentionedUserIds, attachment })
      setContent('')
      setAttachment(null)
      setMentioned(new Map())
      setStatus('idle')
      onCancelEdit?.()
    } catch (err) {
      setStatus('failed')
      setErrorMessage(err?.message || 'Message failed to send.')
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey && mentionQuery === null) {
      event.preventDefault()
      handleSubmit()
    }
    if (event.key === 'Escape' && isEditing) {
      onCancelEdit?.()
    }
  }

  const filteredMembers =
    mentionQuery !== null
      ? members.filter((member) => member.full_name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6)
      : []

  return (
    <div className="composer-wrap">
      {mentionQuery !== null && filteredMembers.length > 0 && (
        <div className="mention-dropdown">
          {filteredMembers.map((member) => (
            <button key={member.id} onClick={() => insertMention(member)} type="button">
              {member.full_name}
            </button>
          ))}
        </div>
      )}

      {showEmoji && (
        <div className="emoji-popover">
          {EMOJI_PALETTE.map((emoji) => (
            <button key={emoji} onClick={() => insertEmoji(emoji)} type="button">
              {emoji}
            </button>
          ))}
        </div>
      )}

      {attachment && (
        <div className="composer-attachment-preview">
          <span>📎 {attachment.name}</span>
          <button className="text-button" onClick={() => setAttachment(null)} type="button">
            Remove
          </button>
        </div>
      )}

      <form className="composer-box" onSubmit={handleSubmit}>
        <button
          aria-label="Add emoji"
          className="composer-icon-button"
          onClick={() => setShowEmoji((open) => !open)}
          type="button"
        >
          😊
        </button>
        <button
          aria-label="Attach file"
          className="composer-icon-button"
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          📎
        </button>
        <input hidden onChange={(event) => setAttachment(event.target.files?.[0] ?? null)} ref={fileInputRef} type="file" />
        <textarea
          aria-label="Message"
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          ref={textareaRef}
          rows={1}
          value={content}
        />
        <Button disabled={(!content.trim() && !attachment) || status === 'sending'} type="submit">
          {status === 'sending' ? '…' : isEditing ? 'Save' : 'Send'}
        </Button>
        {isEditing && (
          <button className="text-button" onClick={onCancelEdit} type="button">
            Cancel
          </button>
        )}
      </form>

      {status === 'failed' && (
        <p className="composer-status failed">
          {errorMessage || 'Message failed to send.'}{' '}
          <button onClick={handleSubmit} type="button">
            Retry
          </button>
        </p>
      )}
    </div>
  )
}
