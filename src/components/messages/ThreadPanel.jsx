import { useEffect, useState } from 'react'
import { createNotification } from '../../services/notificationService'
import {
  deleteMessage,
  editMessage,
  listThreadReplies,
  sendMessage,
  subscribeToChannelMessages,
  toggleReaction,
} from '../../services/messageService'
import { MessageComposer } from './MessageComposer'
import { MessageItem } from './MessageItem'

export function ThreadPanel({ parentMessage, currentUser, members, workspaceId, channelId, onClose, onReplyCountChange, onDownloadAttachment }) {
  const [replies, setReplies] = useState([])
  const [error, setError] = useState('')
  const [editingMessageId, setEditingMessageId] = useState(null)

  useEffect(() => {
    let isMounted = true

    listThreadReplies(parentMessage.id)
      .then((data) => {
        if (isMounted) setReplies(data)
      })
      .catch((err) => {
        if (isMounted) setError(err.message)
      })

    const unsubscribe = subscribeToChannelMessages(channelId, {
      onInsert: (row) => {
        if (row.parent_message_id !== parentMessage.id) return
        setReplies((prev) => {
          if (prev.some((reply) => reply.id === row.id)) return prev
          return [
            ...prev,
            {
              id: row.id,
              channelId: row.channel_id,
              content: row.content,
              createdAt: row.created_at,
              editedAt: row.edited_at,
              deletedAt: row.deleted_at,
              parentMessageId: row.parent_message_id,
              replyCount: 0,
              senderId: row.sender_id,
              sender:
                row.sender_id === currentUser.id
                  ? { id: currentUser.id, full_name: currentUser.name }
                  : (members.find((member) => member.id === row.sender_id) ?? null),
              reactions: [],
              mentionedUserIds: [],
              attachments: [],
            },
          ]
        })
        onReplyCountChange?.(1)
      },
      onUpdate: (row) => {
        if (row.parent_message_id !== parentMessage.id) return
        setReplies((prev) =>
          prev.map((reply) =>
            reply.id === row.id ? { ...reply, content: row.content, editedAt: row.edited_at, deletedAt: row.deleted_at } : reply
          )
        )
      },
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentMessage.id, channelId])

  async function handleSubmit({ content, mentionedUserIds }) {
    if (!content) return
    const sent = await sendMessage({
      workspaceId,
      channelId,
      senderId: currentUser.id,
      content,
      parentMessageId: parentMessage.id,
      mentionedUserIds,
    })
    // Upsert rather than skip-if-exists — see the matching comment in ChannelPanel.handleSend.
    setReplies((prev) => {
      const exists = prev.some((reply) => reply.id === sent.id)
      return exists ? prev.map((reply) => (reply.id === sent.id ? sent : reply)) : [...prev, sent]
    })

    if (parentMessage.senderId !== currentUser.id) {
      await createNotification({
        workspaceId,
        userId: parentMessage.senderId,
        actorId: currentUser.id,
        type: 'thread_reply',
        title: `${currentUser.name} replied to your message`,
        message: content,
        targetType: 'channel',
        targetId: channelId,
        metadata: { parentMessageId: parentMessage.id },
      }).catch(() => {})
    }

    for (const mentionedUserId of mentionedUserIds) {
      if (mentionedUserId === currentUser.id) continue
      await createNotification({
        workspaceId,
        userId: mentionedUserId,
        actorId: currentUser.id,
        type: 'mention',
        title: `${currentUser.name} mentioned you in a thread`,
        message: content,
        targetType: 'channel',
        targetId: channelId,
        metadata: { parentMessageId: parentMessage.id },
      }).catch(() => {})
    }
  }

  async function handleToggleReaction(message, emoji) {
    try {
      await toggleReaction({ messageId: message.id, userId: currentUser.id, emoji })
      setReplies((prev) =>
        prev.map((reply) => {
          if (reply.id !== message.id) return reply
          const existing = reply.reactions.find((r) => r.emoji === emoji)
          const alreadyReacted = existing?.userIds.includes(currentUser.id)
          const nextReactions = reply.reactions
            .map((r) =>
              r.emoji === emoji
                ? { ...r, userIds: alreadyReacted ? r.userIds.filter((id) => id !== currentUser.id) : [...r.userIds, currentUser.id] }
                : r
            )
            .filter((r) => r.userIds.length > 0)
          if (!existing && !alreadyReacted) nextReactions.push({ emoji, userIds: [currentUser.id] })
          return { ...reply, reactions: nextReactions }
        })
      )
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleEditSubmit(messageId, { content }) {
    const updated = await editMessage({ messageId, content })
    setReplies((prev) => prev.map((reply) => (reply.id === messageId ? updated : reply)))
    setEditingMessageId(null)
  }

  async function handleDelete(message) {
    if (!window.confirm('Delete this reply?')) return
    try {
      await deleteMessage(message.id)
      setReplies((prev) => prev.map((reply) => (reply.id === message.id ? { ...reply, content: null, deletedAt: new Date().toISOString() } : reply)))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <aside className="thread-panel">
      <div className="thread-panel-header">
        <strong>Thread</strong>
        <button aria-label="Close thread" className="task-modal-close" onClick={onClose} type="button">
          ×
        </button>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="msg-stack">
        <MessageItem
          currentUser={currentUser}
          isGrouped={false}
          members={members}
          message={parentMessage}
          onDownloadAttachment={onDownloadAttachment}
          onEdit={() => {}}
          onDelete={() => {}}
          onReply={() => {}}
          onOpenThread={() => {}}
          onToggleReaction={handleToggleReaction}
          showThreadIndicator={false}
        />
        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0.5rem 0' }} />
        {replies.length === 0 ? (
          <p className="empty-state-inline">No replies yet.</p>
        ) : (
          replies.map((reply) =>
            editingMessageId === reply.id ? (
              <div key={reply.id} style={{ padding: '0 0.5rem' }}>
                <MessageComposer
                  initialValue={reply.content ?? ''}
                  isEditing
                  members={members}
                  onCancelEdit={() => setEditingMessageId(null)}
                  onSubmit={(payload) => handleEditSubmit(reply.id, payload)}
                  placeholder="Edit reply"
                />
              </div>
            ) : (
              <MessageItem
                currentUser={currentUser}
                isGrouped={false}
                key={reply.id}
                members={members}
                message={reply}
                onDownloadAttachment={onDownloadAttachment}
                onDelete={handleDelete}
                onEdit={(msg) => setEditingMessageId(msg.id)}
                onOpenThread={() => {}}
                onReply={() => {}}
                onToggleReaction={handleToggleReaction}
                showThreadIndicator={false}
              />
            )
          )
        )}
      </div>

      <MessageComposer members={members} onSubmit={handleSubmit} placeholder="Reply in thread…" />
    </aside>
  )
}
