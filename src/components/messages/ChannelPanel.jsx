import { useEffect, useRef, useState } from 'react'
import { getFileDownloadUrl, uploadFile } from '../../services/fileService'
import { createNotification } from '../../services/notificationService'
import {
  deleteMessage,
  editMessage,
  listMessages,
  markChannelRead,
  sendMessage,
  subscribeToChannelMessages,
  subscribeToReactions,
  toggleReaction,
} from '../../services/messageService'
import { MessageComposer } from './MessageComposer'
import { MessageItem } from './MessageItem'
import { ThreadPanel } from './ThreadPanel'

const GROUP_WINDOW_MS = 5 * 60 * 1000

function shouldGroup(current, previous) {
  if (!previous) return false
  if (previous.senderId !== current.senderId) return false
  if (previous.parentMessageId || current.parentMessageId) return false
  return new Date(current.createdAt) - new Date(previous.createdAt) < GROUP_WINDOW_MS
}

export function ChannelPanel({
  channelId,
  channelName,
  currentUser,
  workspaceId,
  members = [],
  conversationType = 'channel',
  otherParticipantIds = [],
}) {
  const [messages, setMessages] = useState([])
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingOlder, setIsLoadingOlder] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState(null)
  const [activeThreadMessage, setActiveThreadMessage] = useState(null)
  const messagesEndRef = useRef(null)
  const stackRef = useRef(null)

  useEffect(() => {
    if (!channelId) {
      setMessages([])
      return
    }

    let isMounted = true

    listMessages(channelId, { limit: 40 })
      .then((data) => {
        if (!isMounted) return
        setMessages(data)
        setHasMore(data.length === 40)
        markChannelRead({ channelId, userId: currentUser.id }).catch(() => {})
      })
      .catch((err) => {
        if (isMounted) setError(err.message)
      })

    const unsubscribeMessages = subscribeToChannelMessages(channelId, {
      onInsert: (row) => {
        if (row.parent_message_id) return
        setMessages((prev) => {
          if (prev.some((message) => message.id === row.id)) return prev
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
              replyCount: row.reply_count ?? 0,
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
        if (row.sender_id !== currentUser.id) {
          markChannelRead({ channelId, userId: currentUser.id }).catch(() => {})
        }
      },
      onUpdate: (row) => {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === row.id
              ? { ...message, content: row.content, editedAt: row.edited_at, deletedAt: row.deleted_at, replyCount: row.reply_count ?? message.replyCount }
              : message
          )
        )
      },
    })

    const unsubscribeReactions = subscribeToReactions((payload) => {
      const messageId = payload.new?.message_id ?? payload.old?.message_id
      setMessages((prev) => {
        if (!prev.some((message) => message.id === messageId)) return prev
        return prev.map((message) => {
          if (message.id !== messageId) return message
          const reactions = new Map(message.reactions.map((r) => [r.emoji, [...r.userIds]]))
          if (payload.eventType === 'INSERT') {
            const emoji = payload.new.emoji
            const list = reactions.get(emoji) ?? []
            if (!list.includes(payload.new.user_id)) list.push(payload.new.user_id)
            reactions.set(emoji, list)
          } else if (payload.eventType === 'DELETE') {
            const emoji = payload.old.emoji
            const list = (reactions.get(emoji) ?? []).filter((id) => id !== payload.old.user_id)
            if (list.length === 0) reactions.delete(emoji)
            else reactions.set(emoji, list)
          }
          return { ...message, reactions: Array.from(reactions.entries()).map(([emoji, userIds]) => ({ emoji, userIds })) }
        })
      })
    })

    return () => {
      isMounted = false
      unsubscribeMessages()
      unsubscribeReactions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, currentUser.id, currentUser.name])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function handleLoadOlder() {
    if (messages.length === 0) return
    setIsLoadingOlder(true)
    const previousHeight = stackRef.current?.scrollHeight ?? 0

    try {
      const older = await listMessages(channelId, { limit: 40, before: messages[0].createdAt })
      setMessages((prev) => [...older, ...prev])
      setHasMore(older.length === 40)
      requestAnimationFrame(() => {
        if (stackRef.current) {
          stackRef.current.scrollTop = stackRef.current.scrollHeight - previousHeight
        }
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoadingOlder(false)
    }
  }

  async function handleSend({ content, mentionedUserIds, attachment }) {
    const sent = await sendMessage({
      workspaceId,
      channelId,
      senderId: currentUser.id,
      content: content || null,
      mentionedUserIds,
    })
    // Upsert rather than skip-if-exists: the realtime INSERT event for this same message can
    // arrive before this await resolves, adding a bare-row placeholder with no mentions/
    // reactions. This authoritative, fully-joined result must win regardless of arrival order.
    setMessages((prev) => {
      const exists = prev.some((message) => message.id === sent.id)
      return exists ? prev.map((message) => (message.id === sent.id ? sent : message)) : [...prev, sent]
    })

    if (attachment) {
      const uploaded = await uploadFile({ workspaceId, uploadedBy: currentUser.id, file: attachment, messageId: sent.id })
      setMessages((prev) =>
        prev.map((message) => (message.id === sent.id ? { ...message, attachments: [...message.attachments, uploaded] } : message))
      )
    }

    for (const mentionedUserId of mentionedUserIds) {
      if (mentionedUserId === currentUser.id) continue
      await createNotification({
        workspaceId,
        userId: mentionedUserId,
        actorId: currentUser.id,
        type: 'mention',
        title: `${currentUser.name} mentioned you`,
        message: content || 'Sent an attachment',
        targetType: 'channel',
        targetId: channelId,
        metadata: { conversationType },
      }).catch(() => {})
    }

    if (conversationType === 'dm') {
      for (const participantId of otherParticipantIds) {
        if (participantId === currentUser.id) continue
        await createNotification({
          workspaceId,
          userId: participantId,
          actorId: currentUser.id,
          type: 'direct_message',
          title: `New message from ${currentUser.name}`,
          message: content || 'Sent an attachment',
          targetType: 'channel',
          targetId: channelId,
          metadata: { conversationType },
        }).catch(() => {})
      }
    }
  }

  async function handleEditSubmit(messageId, { content }) {
    const updated = await editMessage({ messageId, content })
    setMessages((prev) => prev.map((message) => (message.id === messageId ? updated : message)))
    setEditingMessageId(null)
  }

  async function handleDelete(message) {
    if (!window.confirm('Delete this message?')) return
    try {
      await deleteMessage(message.id)
      setMessages((prev) =>
        prev.map((item) => (item.id === message.id ? { ...item, content: null, deletedAt: new Date().toISOString() } : item))
      )
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleToggleReaction(message, emoji) {
    try {
      await toggleReaction({ messageId: message.id, userId: currentUser.id, emoji })
      setMessages((prev) =>
        prev.map((item) => {
          if (item.id !== message.id) return item
          const existing = item.reactions.find((r) => r.emoji === emoji)
          const alreadyReacted = existing?.userIds.includes(currentUser.id)
          const next = item.reactions
            .map((r) =>
              r.emoji === emoji
                ? { ...r, userIds: alreadyReacted ? r.userIds.filter((id) => id !== currentUser.id) : [...r.userIds, currentUser.id] }
                : r
            )
            .filter((r) => r.userIds.length > 0)
          if (!existing) next.push({ emoji, userIds: [currentUser.id] })
          return { ...item, reactions: next }
        })
      )
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDownloadAttachment(file) {
    try {
      const url = await getFileDownloadUrl(file.storage_path)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="conversation-body">
      <div className="message-panel">
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="msg-stack" ref={stackRef}>
          {hasMore && (
            <button className="load-older-button" disabled={isLoadingOlder} onClick={handleLoadOlder} type="button">
              {isLoadingOlder ? 'Loading…' : 'Load older messages'}
            </button>
          )}

          {messages.length === 0 ? (
            <p className="empty-state-inline">No messages yet. Start the conversation.</p>
          ) : (
            messages.map((message, index) =>
              editingMessageId === message.id ? (
                <div key={message.id} style={{ padding: '0 0.5rem' }}>
                  <MessageComposer
                    initialValue={message.content ?? ''}
                    isEditing
                    members={members}
                    onCancelEdit={() => setEditingMessageId(null)}
                    onSubmit={(payload) => handleEditSubmit(message.id, payload)}
                    placeholder="Edit message"
                  />
                </div>
              ) : (
                <MessageItem
                  currentUser={currentUser}
                  isGrouped={shouldGroup(message, messages[index - 1])}
                  key={message.id}
                  members={members}
                  message={message}
                  onDelete={handleDelete}
                  onDownloadAttachment={handleDownloadAttachment}
                  onEdit={(msg) => setEditingMessageId(msg.id)}
                  onOpenThread={setActiveThreadMessage}
                  onReply={setActiveThreadMessage}
                  onToggleReaction={handleToggleReaction}
                />
              )
            )
          )}
          <div ref={messagesEndRef} />
        </div>

        {channelId && (
          <MessageComposer members={members} onSubmit={handleSend} placeholder={`Message #${channelName ?? ''}`} />
        )}
      </div>

      {activeThreadMessage && (
        <ThreadPanel
          channelId={channelId}
          currentUser={currentUser}
          members={members}
          onClose={() => setActiveThreadMessage(null)}
          onDownloadAttachment={handleDownloadAttachment}
          onReplyCountChange={(delta) =>
            setMessages((prev) =>
              prev.map((message) =>
                message.id === activeThreadMessage.id ? { ...message, replyCount: message.replyCount + delta } : message
              )
            )
          }
          parentMessage={activeThreadMessage}
          workspaceId={workspaceId}
        />
      )}
    </div>
  )
}
