import { useState } from 'react'
import { EMOJI_PALETTE } from './emojiPalette'

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function renderContent(content, mentionedUserIds, members) {
  if (!content) return null

  const mentionedNames = mentionedUserIds.map((id) => members.find((member) => member.id === id)?.full_name).filter(Boolean)

  if (mentionedNames.length === 0) return content

  const pattern = new RegExp(`(@(?:${mentionedNames.map(escapeRegExp).join('|')}))`, 'g')
  const parts = content.split(pattern)

  return parts.map((part, index) =>
    mentionedNames.some((name) => part === `@${name}`) ? (
      <span className="mention-highlight" key={index}>
        {part}
      </span>
    ) : (
      <span key={index}>{part}</span>
    )
  )
}

function formatTime(dateString) {
  return new Date(dateString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function MessageItem({
  message,
  currentUser,
  members,
  isGrouped,
  showThreadIndicator = true,
  onReply,
  onToggleReaction,
  onEdit,
  onDelete,
  onOpenThread,
  onDownloadAttachment,
}) {
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const isDeleted = Boolean(message.deletedAt)
  const canModify = message.senderId === currentUser.id

  return (
    <div className="msg-group">
      {!isGrouped ? (
        <span className="avatar">{(message.sender?.full_name || '?').slice(0, 2).toUpperCase()}</span>
      ) : (
        <span style={{ display: 'inline-block', width: '2.15rem' }} />
      )}

      <div className="msg-group-body">
        {!isGrouped && (
          <div className="msg-group-header">
            <strong>{message.sender?.full_name || 'Member'}</strong>
            <time>{formatTime(message.createdAt)}</time>
          </div>
        )}

        <div className={`msg-item${isDeleted ? ' deleted' : ''}`}>
          {isDeleted ? 'This message was deleted' : renderContent(message.content, message.mentionedUserIds, members)}
          {message.editedAt && !isDeleted && <span className="msg-edited-tag">(edited)</span>}
        </div>

        {!isDeleted && message.attachments.length > 0 && (
          <div className="msg-attachments">
            {message.attachments.map((file) => (
              <button className="msg-attachment" key={file.id} onClick={() => onDownloadAttachment(file)} type="button">
                📎 {file.name}
              </button>
            ))}
          </div>
        )}

        {!isDeleted && message.reactions.length > 0 && (
          <div className="msg-reactions">
            {message.reactions.map((reaction) => (
              <button
                className={`reaction-chip${reaction.userIds.includes(currentUser.id) ? ' mine' : ''}`}
                key={reaction.emoji}
                onClick={() => onToggleReaction(message, reaction.emoji)}
                title={reaction.userIds
                  .map((id) => members.find((member) => member.id === id)?.full_name)
                  .filter(Boolean)
                  .join(', ')}
                type="button"
              >
                {reaction.emoji} {reaction.userIds.length}
              </button>
            ))}
          </div>
        )}

        {!isDeleted && showThreadIndicator && !message.parentMessageId && message.replyCount > 0 && (
          <button className="thread-indicator" onClick={() => onOpenThread(message)} type="button">
            💬 {message.replyCount} {message.replyCount === 1 ? 'reply' : 'replies'}
          </button>
        )}
      </div>

      {!isDeleted && (
        <div className="msg-hover-actions" style={{ position: 'relative' }}>
          <button onClick={() => setShowReactionPicker((open) => !open)} title="React" type="button">
            😊
          </button>
          {showReactionPicker && (
            <div className="emoji-popover" style={{ bottom: 'auto', top: '100%' }}>
              {EMOJI_PALETTE.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onToggleReaction(message, emoji)
                    setShowReactionPicker(false)
                  }}
                  type="button"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          {!message.parentMessageId && (
            <button onClick={() => onReply(message)} title="Reply in thread" type="button">
              ↩
            </button>
          )}
          {canModify && (
            <button onClick={() => onEdit(message)} title="Edit" type="button">
              ✎
            </button>
          )}
          {canModify && (
            <button onClick={() => onDelete(message)} title="Delete" type="button">
              🗑
            </button>
          )}
          <button onClick={() => navigator.clipboard?.writeText(message.content || '')} title="Copy text" type="button">
            ⧉
          </button>
        </div>
      )}
    </div>
  )
}
