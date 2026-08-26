import { useEffect, useState } from 'react'
import { ChannelPanel } from '../../components/messages/ChannelPanel'
import { Button } from '../../components/ui/Button'
import { timeAgo } from '../../lib/formatters'
import { logActivity } from '../../services/activityService'
import {
  createChannel,
  createGroupConversation,
  getChannelUnreadCounts,
  getOrCreateDM,
  listChannelAttachments,
  listChannelMembers,
  listChannels,
  listConversations,
  markChannelRead,
  searchMessages,
  subscribeToWorkspaceMessageActivity,
} from '../../services/messageService'
import { listWorkspaceMembers } from '../../services/workspaceService'

export function MessagesPage({ currentUser, initialFocus, onFocusConsumed, workspace }) {
  const [channels, setChannels] = useState([])
  const [conversations, setConversations] = useState([])
  const [workspaceMembers, setWorkspaceMembers] = useState([])
  const [selected, setSelected] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [mobileShowConversation, setMobileShowConversation] = useState(false)
  const [showContext, setShowContext] = useState(false)
  const [contextMembers, setContextMembers] = useState([])
  const [contextFiles, setContextFiles] = useState([])

  const [isCreatingChannel, setIsCreatingChannel] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelPrivate, setNewChannelPrivate] = useState(false)

  const [isStartingDM, setIsStartingDM] = useState(false)
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupMemberIds, setGroupMemberIds] = useState([])

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [isSearching, setIsSearching] = useState(false)

  async function loadAll() {
    if (!workspace?.id) return { channelList: [], conversationList: [] }
    const [channelList, conversationList, members] = await Promise.all([
      listChannels(workspace.id),
      listConversations(workspace.id, currentUser.id),
      listWorkspaceMembers(workspace.id),
    ])

    const unreadCounts = await getChannelUnreadCounts(
      channelList.map((c) => c.id),
      currentUser.id
    )
    const channelsWithCounts = channelList.map((channel) => ({ ...channel, unreadCount: unreadCounts[channel.id] ?? 0 }))
    setChannels(channelsWithCounts)
    setConversations(conversationList)
    setWorkspaceMembers(members)
    return { channelList: channelsWithCounts, conversationList }
  }

  useEffect(() => {
    if (!workspace?.id) {
      setIsLoading(false)
      return
    }

    let isMounted = true
    setIsLoading(true)
    setSelected(null)

    loadAll()
      .then(({ channelList, conversationList }) => {
        if (!isMounted || initialFocus?.type !== 'channel') return
        const channel = channelList.find((c) => c.id === initialFocus.id)
        if (channel) {
          selectConversation({ id: channel.id, type: 'channel', name: channel.name, isPrivate: channel.is_private })
          onFocusConsumed?.()
          return
        }
        const conversation = conversationList.find((c) => c.id === initialFocus.id)
        if (conversation) {
          selectConversation({ id: conversation.id, type: conversation.type, name: conversation.name })
          onFocusConsumed?.()
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message)
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    const unsubscribe = subscribeToWorkspaceMessageActivity(workspace.id, (row) => {
      setChannels((prev) =>
        prev.map((channel) =>
          channel.id === row.channel_id && row.sender_id !== currentUser.id && (!selected || selected.id !== row.channel_id)
            ? { ...channel, unreadCount: channel.unreadCount + 1 }
            : channel
        )
      )
      setConversations((prev) => {
        const exists = prev.some((conversation) => conversation.id === row.channel_id)
        if (!exists) {
          loadAll().catch(() => {})
          return prev
        }
        return prev.map((conversation) =>
          conversation.id === row.channel_id
            ? {
                ...conversation,
                lastMessage: row.content,
                lastMessageAt: row.created_at,
                unreadCount:
                  row.sender_id !== currentUser.id && (!selected || selected.id !== row.channel_id)
                    ? conversation.unreadCount + 1
                    : conversation.unreadCount,
              }
            : conversation
        )
      })
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id])

  useEffect(() => {
    if (!selected) {
      setContextMembers([])
      setContextFiles([])
      return
    }

    let isMounted = true

    if (selected.type !== 'channel' || selected.isPrivate) {
      listChannelMembers(selected.id)
        .then((data) => {
          if (isMounted) setContextMembers(data)
        })
        .catch(() => {})
    } else {
      setContextMembers([])
    }

    listChannelAttachments(selected.id)
      .then((files) => {
        if (isMounted) setContextFiles(files)
      })
      .catch(() => {})

    return () => {
      isMounted = false
    }
  }, [selected, workspace?.id])

  function selectConversation(item) {
    setSelected(item)
    setMobileShowConversation(true)
    markChannelRead({ channelId: item.id, userId: currentUser.id }).catch(() => {})
    setChannels((prev) => prev.map((channel) => (channel.id === item.id ? { ...channel, unreadCount: 0 } : channel)))
    setConversations((prev) => prev.map((conversation) => (conversation.id === item.id ? { ...conversation, unreadCount: 0 } : conversation)))
  }

  async function handleCreateChannel(event) {
    event.preventDefault()
    if (!newChannelName.trim()) return
    setError('')

    try {
      const channel = await createChannel({
        workspaceId: workspace.id,
        name: newChannelName.trim().toLowerCase().replace(/\s+/g, '-'),
        description: null,
        createdBy: currentUser.id,
        isPrivate: newChannelPrivate,
      })
      await logActivity({
        workspaceId: workspace.id,
        actorId: currentUser.id,
        action: 'channel.created',
        targetType: 'channel',
        targetId: channel.id,
        metadata: { name: channel.name },
      })
      setChannels((prev) => [...prev, { ...channel, unreadCount: 0, teamName: null }])
      selectConversation({ id: channel.id, type: 'channel', name: channel.name, isPrivate: channel.is_private })
      setNewChannelName('')
      setNewChannelPrivate(false)
      setIsCreatingChannel(false)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleStartDM(memberId) {
    setError('')
    try {
      const channelId = await getOrCreateDM(memberId, workspace.id)
      const member = workspaceMembers.find((m) => m.id === memberId)
      selectConversation({ id: channelId, type: 'dm', name: member?.full_name ?? 'Direct message' })
      setIsStartingDM(false)
      await loadAll()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleCreateGroup(event) {
    event.preventDefault()
    if (!groupName.trim() || groupMemberIds.length === 0) return
    setError('')

    try {
      const channel = await createGroupConversation({
        workspaceId: workspace.id,
        name: groupName.trim(),
        memberIds: groupMemberIds,
        createdBy: currentUser.id,
      })
      selectConversation({ id: channel.id, type: 'group', name: channel.name })
      setGroupName('')
      setGroupMemberIds([])
      setIsCreatingGroup(false)
      await loadAll()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleSearch(event) {
    event.preventDefault()
    if (!searchQuery.trim()) {
      setSearchResults(null)
      return
    }
    setIsSearching(true)
    try {
      const results = await searchMessages(workspace.id, searchQuery.trim())
      setSearchResults(results)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSearching(false)
    }
  }

  function handleSearchResultClick(result) {
    setSearchResults(null)
    setSearchQuery('')
    const channel = channels.find((c) => c.id === result.channel_id)
    if (channel) {
      selectConversation({ id: channel.id, type: 'channel', name: channel.name, isPrivate: channel.is_private })
      return
    }
    const conversation = conversations.find((c) => c.id === result.channel_id)
    if (conversation) {
      selectConversation({ id: conversation.id, type: conversation.type, name: conversation.name })
    }
  }

  if (!workspace) {
    return <p className="eyebrow">No workspace found yet.</p>
  }

  if (isLoading) {
    return (
      <section className="messages-page">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Workspace</p>
            <h1>Messages</h1>
          </div>
        </div>
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="skeleton-line" key={index} />
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="messages-page" aria-labelledby="messages-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1 id="messages-title">Messages</h1>
        </div>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className={`messaging-layout${showContext ? ' context-open' : ''}${mobileShowConversation ? ' show-conversation' : ''}`}>
        <aside className="conversation-sidebar">
          <form onSubmit={handleSearch}>
            <input
              aria-label="Search messages"
              className="sidebar-search"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search messages…"
              value={searchQuery}
            />
          </form>

          {searchResults ? (
            <div className="conversation-section">
              <div className="conversation-section-header">
                <p>Results</p>
                <button onClick={() => setSearchResults(null)} type="button">
                  ×
                </button>
              </div>
              {isSearching ? (
                <p className="empty-state-inline">Searching…</p>
              ) : searchResults.length === 0 ? (
                <p className="empty-state-inline">No messages found.</p>
              ) : (
                searchResults.map((result) => (
                  <button className="conversation-item" key={result.id} onClick={() => handleSearchResultClick(result)} type="button">
                    <div className="conversation-item-body">
                      <strong>
                        {result.profiles?.full_name ?? 'Member'} in {result.channels?.name ? `#${result.channels.name}` : 'a conversation'}
                      </strong>
                      <span>{result.content}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : (
            <>
              <div className="conversation-section">
                <div className="conversation-section-header">
                  <p>Channels</p>
                  <button aria-label="New channel" onClick={() => setIsCreatingChannel((open) => !open)} type="button">
                    +
                  </button>
                </div>
                {isCreatingChannel && (
                  <form className="inline-form" onSubmit={handleCreateChannel} style={{ marginBottom: '0.6rem' }}>
                    <input
                      aria-label="Channel name"
                      onChange={(event) => setNewChannelName(event.target.value)}
                      placeholder="channel-name"
                      required
                      value={newChannelName}
                    />
                    <label className="checkbox-field private-toggle" style={{ alignItems: 'center', display: 'flex', fontSize: '0.8rem', gap: '0.3rem' }}>
                      <input checked={newChannelPrivate} onChange={(event) => setNewChannelPrivate(event.target.checked)} type="checkbox" />
                      <span>Private</span>
                    </label>
                    <Button type="submit">Create</Button>
                  </form>
                )}
                {channels.length === 0 ? (
                  <p className="empty-state-inline">Create your first channel to start collaborating.</p>
                ) : (
                  channels.map((channel) => (
                    <button
                      className={`conversation-item${selected?.id === channel.id ? ' active' : ''}`}
                      key={channel.id}
                      onClick={() => selectConversation({ id: channel.id, type: 'channel', name: channel.name, isPrivate: channel.is_private })}
                      type="button"
                    >
                      <div className="conversation-item-body">
                        <strong>
                          {channel.is_private ? '🔒 ' : '# '}
                          {channel.name}
                        </strong>
                        <span>{channel.teamName ? `Team · ${channel.teamName}` : channel.description || 'No description'}</span>
                      </div>
                      {channel.unreadCount > 0 && <span className="unread-badge">{channel.unreadCount}</span>}
                    </button>
                  ))
                )}
              </div>

              <div className="conversation-section">
                <div className="conversation-section-header">
                  <p>Direct messages</p>
                  <button aria-label="New direct message" onClick={() => setIsStartingDM((open) => !open)} type="button">
                    +
                  </button>
                </div>
                {isStartingDM && (
                  <div className="user-list" style={{ marginBottom: '0.6rem' }}>
                    {workspaceMembers
                      .filter((member) => member.id !== currentUser.id)
                      .map((member) => (
                        <button className="conversation-item" key={member.id} onClick={() => handleStartDM(member.id)} type="button">
                          <span className="avatar">{(member.full_name || '?').slice(0, 2).toUpperCase()}</span>
                          <div className="conversation-item-body">
                            <strong>{member.full_name}</strong>
                          </div>
                        </button>
                      ))}
                  </div>
                )}
                {conversations.filter((c) => c.type === 'dm').length === 0 ? (
                  <p className="empty-state-inline">Your direct conversations will appear here.</p>
                ) : (
                  conversations
                    .filter((c) => c.type === 'dm')
                    .map((conversation) => (
                      <button
                        className={`conversation-item${selected?.id === conversation.id ? ' active' : ''}`}
                        key={conversation.id}
                        onClick={() => selectConversation({ id: conversation.id, type: 'dm', name: conversation.name })}
                        type="button"
                      >
                        <span className="avatar">{conversation.name.slice(0, 2).toUpperCase()}</span>
                        <div className="conversation-item-body">
                          <strong>{conversation.name}</strong>
                          <span>{conversation.lastMessage || 'No messages yet'}</span>
                        </div>
                        {conversation.unreadCount > 0 && <span className="unread-badge">{conversation.unreadCount}</span>}
                      </button>
                    ))
                )}
              </div>

              <div className="conversation-section">
                <div className="conversation-section-header">
                  <p>Group conversations</p>
                  <button aria-label="New group" onClick={() => setIsCreatingGroup((open) => !open)} type="button">
                    +
                  </button>
                </div>
                {isCreatingGroup && (
                  <form className="inline-form" onSubmit={handleCreateGroup} style={{ display: 'grid', marginBottom: '0.6rem' }}>
                    <input
                      aria-label="Group name"
                      onChange={(event) => setGroupName(event.target.value)}
                      placeholder="Group name"
                      required
                      value={groupName}
                    />
                    <div style={{ display: 'grid', gap: '0.2rem', maxHeight: '140px', overflowY: 'auto' }}>
                      {workspaceMembers
                        .filter((member) => member.id !== currentUser.id)
                        .map((member) => (
                          <label
                            className="checkbox-field"
                            key={member.id}
                            style={{ alignItems: 'center', display: 'flex', fontSize: '0.82rem', gap: '0.4rem' }}
                          >
                            <input
                              checked={groupMemberIds.includes(member.id)}
                              onChange={(event) =>
                                setGroupMemberIds((prev) =>
                                  event.target.checked ? [...prev, member.id] : prev.filter((id) => id !== member.id)
                                )
                              }
                              type="checkbox"
                            />
                            <span>{member.full_name}</span>
                          </label>
                        ))}
                    </div>
                    <Button disabled={!groupName.trim() || groupMemberIds.length === 0} type="submit">
                      Create group
                    </Button>
                  </form>
                )}
                {conversations.filter((c) => c.type === 'group').length === 0 ? (
                  <p className="empty-state-inline">No group conversations yet.</p>
                ) : (
                  conversations
                    .filter((c) => c.type === 'group')
                    .map((conversation) => (
                      <button
                        className={`conversation-item${selected?.id === conversation.id ? ' active' : ''}`}
                        key={conversation.id}
                        onClick={() => selectConversation({ id: conversation.id, type: 'group', name: conversation.name })}
                        type="button"
                      >
                        <span className="avatar">{conversation.name.slice(0, 2).toUpperCase()}</span>
                        <div className="conversation-item-body">
                          <strong>{conversation.name}</strong>
                          <span>{conversation.lastMessage || 'No messages yet'}</span>
                        </div>
                        {conversation.unreadCount > 0 && <span className="unread-badge">{conversation.unreadCount}</span>}
                      </button>
                    ))
                )}
              </div>
            </>
          )}
        </aside>

        {!selected ? (
          <div className="conversation-view">
            <p className="empty-state-inline" style={{ margin: 'auto' }}>
              Select a conversation to get started.
            </p>
          </div>
        ) : (
          <div className="conversation-view">
            <div className="conversation-header">
              <button className="mobile-back-button" onClick={() => setMobileShowConversation(false)} type="button">
                ← Back
              </button>
              <div className="conversation-header-meta">
                <strong>
                  {selected.type === 'channel' ? (selected.isPrivate ? '🔒 ' : '# ') : ''}
                  {selected.name}
                </strong>
                {selected.type !== 'channel' && <span>{selected.type === 'dm' ? 'Direct message' : 'Group conversation'}</span>}
              </div>
              <button className="small-action" onClick={() => setShowContext((open) => !open)} type="button">
                {showContext ? 'Hide details' : 'Details'}
              </button>
            </div>

            <ChannelPanel
              channelId={selected.id}
              channelName={selected.name}
              conversationType={selected.type}
              currentUser={currentUser}
              members={workspaceMembers}
              otherParticipantIds={conversations.find((c) => c.id === selected.id)?.otherMembers.map((m) => m.id) ?? []}
              workspaceId={workspace.id}
            />
          </div>
        )}

        {showContext && selected && (
          <div className="context-panel">
            {contextMembers.length > 0 && (
              <>
                <h3>Members</h3>
                <div className="user-list" style={{ marginBottom: '1.25rem' }}>
                  {contextMembers.map((member) => (
                    <div className="user-row" key={member.membershipId}>
                      <span className="avatar">{(member.full_name || '?').slice(0, 2).toUpperCase()}</span>
                      <div>
                        <strong>{member.full_name}</strong>
                        <span>{member.username}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <h3>Shared files</h3>
            {contextFiles.filter((file) => file.storage_path).length === 0 ? (
              <p className="empty-state-inline">No files shared yet.</p>
            ) : (
              <div className="user-list">
                {contextFiles.map((file) => (
                  <div className="user-row" key={file.id}>
                    <span className="avatar">{file.name.slice(0, 2).toUpperCase()}</span>
                    <div>
                      <strong>{file.name}</strong>
                      <span>{timeAgo(file.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
