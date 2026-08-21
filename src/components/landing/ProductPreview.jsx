import { useState } from 'react'
import { previewChannels } from '../../data/landingContent'

export function ProductPreview() {
  const [activeChannel, setActiveChannel] = useState('development')

  return (
    <aside className="product-preview" aria-label="TeamHub dashboard preview">
      <div className="preview-sidebar">
        <span className="preview-label">Alpha Workspace</span>
        {previewChannels.map((channel) => (
          <button
            className={activeChannel === channel ? 'preview-channel active' : 'preview-channel'}
            key={channel}
            onClick={() => setActiveChannel(channel)}
            type="button"
          >
            # {channel}
          </button>
        ))}
      </div>

      <div className="preview-main">
        <div className="preview-header">
          <div>
            <span className="preview-label">Current channel</span>
            <strong># {activeChannel}</strong>
          </div>
          <span className="status-pill">42 members</span>
        </div>

        <div className="message-stack">
          <div className="message-row">
            <span className="avatar">SA</span>
            <p>Final product notes are ready for review.</p>
          </div>
          <div className="message-row current-user">
            <span className="avatar">AO</span>
            <p>I will connect this to the sprint board today.</p>
          </div>
          <div className="metric-row">
            <span>Messages</span>
            <strong>1,284</strong>
          </div>
          <div className="metric-row">
            <span>Shared files</span>
            <strong>328</strong>
          </div>
        </div>
      </div>
    </aside>
  )
}
