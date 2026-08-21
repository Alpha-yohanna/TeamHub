import { useEffect, useState } from 'react'
import { timeAgo } from '../../lib/formatters'
import { formatFileSize, getFileCategory, getFileDownloadUrl, getFilePreviewText } from '../../services/fileService'

export function FilePreviewModal({ file, onClose, onDownload }) {
  const [previewUrl, setPreviewUrl] = useState(null)
  const [textContent, setTextContent] = useState(null)
  const [error, setError] = useState('')
  const category = getFileCategory(file.mime_type, file.name)

  useEffect(() => {
    let isMounted = true

    async function load() {
      try {
        if (category === 'image' || category === 'pdf') {
          const url = await getFileDownloadUrl(file.storage_path, 300)
          if (isMounted) setPreviewUrl(url)
        } else if (category === 'text') {
          const text = await getFilePreviewText(file.storage_path)
          if (isMounted) setTextContent(text.slice(0, 20000))
        }
      } catch (err) {
        if (isMounted) setError(err.message)
      }
    }

    load()
    return () => {
      isMounted = false
    }
  }, [file.storage_path, category])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="task-modal" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '760px' }}>
        <div className="task-modal-header">
          <div>
            <h2>{file.name}</h2>
            <span className="team-card-meta">
              {formatFileSize(file.size_bytes)} · Uploaded by {file.profiles?.full_name ?? 'Unknown'} · {timeAgo(file.created_at)}
            </span>
          </div>
          <button aria-label="Close" className="task-modal-close" onClick={onClose} type="button">
            ×
          </button>
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="file-preview-body">
          {category === 'image' && previewUrl && <img alt={file.name} src={previewUrl} />}
          {category === 'pdf' && previewUrl && <iframe src={previewUrl} title={file.name} />}
          {category === 'text' && textContent !== null && <pre>{textContent}</pre>}
          {category !== 'image' && category !== 'pdf' && category !== 'text' && (
            <p className="empty-state-inline">No inline preview available for this file type.</p>
          )}
        </div>

        {file.description && (
          <p style={{ color: 'var(--muted)', marginTop: '0.75rem' }}>{file.description}</p>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button className="small-action" onClick={() => onDownload(file)} type="button">
            Download
          </button>
        </div>
      </div>
    </div>
  )
}
