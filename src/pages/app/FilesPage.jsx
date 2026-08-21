import { useEffect, useRef, useState } from 'react'
import { FilePreviewModal } from '../../components/files/FilePreviewModal'
import { FileTypeIcon } from '../../components/files/FileTypeIcon'
import { ShareFileModal } from '../../components/files/ShareFileModal'
import { Button } from '../../components/ui/Button'
import { timeAgo } from '../../lib/formatters'
import { logActivity } from '../../services/activityService'
import {
  createFolder,
  deleteFile,
  deleteFolder,
  formatFileSize,
  getFileCategory,
  getFileDownloadUrl,
  listAllFolders,
  listFiles,
  listFolders,
  listRecentFiles,
  moveFile,
  renameFile,
  renameFolder,
  searchFiles,
  uploadFile,
} from '../../services/fileService'
import { listTeams } from '../../services/teamService'
import { listWorkspaceMembers } from '../../services/workspaceService'

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'image', label: 'Images' },
  { value: 'pdf', label: 'PDF' },
  { value: 'document', label: 'Documents' },
  { value: 'spreadsheet', label: 'Spreadsheets' },
  { value: 'presentation', label: 'Presentations' },
  { value: 'text', label: 'Text' },
  { value: 'archive', label: 'Archives' },
  { value: 'other', label: 'Other' },
]

function folderDepthLabel(folder, allFolders) {
  const parts = [folder.name]
  let current = folder
  while (current.parent_folder_id) {
    current = allFolders.find((f) => f.id === current.parent_folder_id)
    if (!current) break
    parts.unshift(current.name)
  }
  return parts.join(' / ')
}

export function FilesPage({ currentUser, initialFocus, onFocusConsumed, workspace }) {
  const [currentFolderId, setCurrentFolderId] = useState(null)
  const [folderPath, setFolderPath] = useState([])
  const [folders, setFolders] = useState([])
  const [files, setFiles] = useState([])
  const [recentFiles, setRecentFiles] = useState([])
  const [workspaceMembers, setWorkspaceMembers] = useState([])
  const [teams, setTeams] = useState([])
  const [allFolders, setAllFolders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [typeFilter, setTypeFilter] = useState('')
  const [sortBy, setSortBy] = useState('date')
  const [viewMode, setViewMode] = useState('grid')

  const [isUploading, setIsUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  const [previewFile, setPreviewFile] = useState(null)
  const [shareTarget, setShareTarget] = useState(null)
  const [openMenuId, setOpenMenuId] = useState(null)
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [movingFile, setMovingFile] = useState(null)

  const fileInputRef = useRef(null)

  async function loadFolderContents(folderId) {
    const [folderList, fileList] = await Promise.all([
      listFolders(workspace.id, folderId),
      listFiles(workspace.id, { folderId }),
    ])
    setFolders(folderList)
    setFiles(fileList)
    setFolderPath(folderId ? await buildPath(folderId) : [])
  }

  async function buildPath(folderId) {
    const path = []
    let id = folderId
    const flat = allFolders.length > 0 ? allFolders : await listAllFolders(workspace.id)
    while (id) {
      const folder = flat.find((f) => f.id === id)
      if (!folder) break
      path.unshift(folder)
      id = folder.parent_folder_id
    }
    return path
  }

  useEffect(() => {
    if (!workspace?.id) {
      setIsLoading(false)
      return
    }

    let isMounted = true
    setIsLoading(true)

    Promise.all([
      listFolders(workspace.id, null),
      listFiles(workspace.id, { folderId: null }),
      listRecentFiles(workspace.id, 5),
      listWorkspaceMembers(workspace.id),
      listTeams(workspace.id),
      listAllFolders(workspace.id),
    ])
      .then(([folderList, fileList, recent, members, teamList, flatFolders]) => {
        if (!isMounted) return
        setFolders(folderList)
        setFiles(fileList)
        setRecentFiles(recent)
        setWorkspaceMembers(members)
        setTeams(teamList)
        setAllFolders(flatFolders)

        if (initialFocus?.type === 'folder') {
          navigateToFolder(initialFocus.id).catch(() => {})
          onFocusConsumed?.()
        } else if (initialFocus?.type === 'file') {
          listFiles(workspace.id, {})
            .then((allFiles) => {
              const file = allFiles.find((item) => item.id === initialFocus.id)
              if (!file || !isMounted) return
              if (file.folder_id) {
                navigateToFolder(file.folder_id).catch(() => {})
              }
              setPreviewFile(file)
              onFocusConsumed?.()
            })
            .catch(() => {})
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message)
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id])

  async function navigateToFolder(folderId) {
    setError('')
    setSearchResults(null)
    setCurrentFolderId(folderId)
    try {
      await loadFolderContents(folderId)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleCreateFolder(event) {
    event.preventDefault()
    if (!newFolderName.trim()) return
    setError('')

    try {
      const folder = await createFolder({
        workspaceId: workspace.id,
        name: newFolderName.trim(),
        parentFolderId: currentFolderId,
        createdBy: currentUser.id,
      })
      await logActivity({
        workspaceId: workspace.id,
        actorId: currentUser.id,
        action: 'folder.created',
        targetType: 'folder',
        targetId: folder.id,
        metadata: { name: folder.name },
      })
      setFolders((prev) => [...prev, folder].sort((a, b) => a.name.localeCompare(b.name)))
      setAllFolders((prev) => [...prev, folder])
      setNewFolderName('')
      setIsCreatingFolder(false)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleUploadFiles(fileList) {
    if (!fileList || fileList.length === 0 || !workspace) return
    setError('')
    setIsUploading(true)

    for (const file of Array.from(fileList)) {
      try {
        const uploaded = await uploadFile({
          workspaceId: workspace.id,
          uploadedBy: currentUser.id,
          file,
          folderId: currentFolderId,
        })
        await logActivity({
          workspaceId: workspace.id,
          actorId: currentUser.id,
          action: 'file.uploaded',
          targetType: 'file',
          targetId: uploaded.id,
          metadata: { name: uploaded.name },
        })
        setFiles((prev) => [{ ...uploaded, profiles: { id: currentUser.id, full_name: currentUser.name } }, ...prev])
        setRecentFiles((prev) => [uploaded, ...prev].slice(0, 5))
      } catch (err) {
        setError(err.message)
      }
    }

    setIsUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleDrop(event) {
    event.preventDefault()
    setIsDragOver(false)
    handleUploadFiles(event.dataTransfer.files)
  }

  async function handleDownload(file) {
    try {
      const url = await getFileDownloadUrl(file.storage_path)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDeleteFile(file) {
    if (!window.confirm(`Delete ${file.name}? This cannot be undone.`)) return
    setError('')
    try {
      await deleteFile({ id: file.id, storagePath: file.storage_path })
      await logActivity({
        workspaceId: workspace.id,
        actorId: currentUser.id,
        action: 'file.deleted',
        targetType: 'file',
        metadata: { name: file.name },
      })
      setFiles((prev) => prev.filter((item) => item.id !== file.id))
      setRecentFiles((prev) => prev.filter((item) => item.id !== file.id))
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDeleteFolder(folder) {
    if (!window.confirm(`Delete folder "${folder.name}"? Files inside will move to the parent folder.`)) return
    setError('')
    try {
      await deleteFolder(folder.id)
      setFolders((prev) => prev.filter((item) => item.id !== folder.id))
      setAllFolders((prev) => prev.filter((item) => item.id !== folder.id))
    } catch (err) {
      setError(err.message)
    }
  }

  function startRename(item, isFolder) {
    setRenamingId(`${isFolder ? 'folder' : 'file'}:${item.id}`)
    setRenameValue(item.name)
    setOpenMenuId(null)
  }

  async function handleRenameSubmit(event, item, isFolder) {
    event.preventDefault()
    if (!renameValue.trim()) return
    setError('')

    try {
      if (isFolder) {
        const updated = await renameFolder({ folderId: item.id, name: renameValue.trim() })
        setFolders((prev) => prev.map((f) => (f.id === item.id ? { ...f, name: updated.name } : f)))
        setAllFolders((prev) => prev.map((f) => (f.id === item.id ? { ...f, name: updated.name } : f)))
      } else {
        const updated = await renameFile({ fileId: item.id, name: renameValue.trim() })
        await logActivity({
          workspaceId: workspace.id,
          actorId: currentUser.id,
          action: 'file.renamed',
          targetType: 'file',
          targetId: item.id,
          metadata: { name: updated.name, previousName: item.name },
        })
        setFiles((prev) => prev.map((f) => (f.id === item.id ? updated : f)))
        setRecentFiles((prev) => prev.map((f) => (f.id === item.id ? { ...f, name: updated.name } : f)))
      }
      setRenamingId(null)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleMoveFile(file, folderId) {
    setError('')
    try {
      await moveFile({ fileId: file.id, folderId: folderId || null })
      setFiles((prev) => prev.filter((item) => item.id !== file.id))
      setMovingFile(null)
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
    setError('')
    try {
      const results = await searchFiles(workspace.id, searchQuery.trim())
      setSearchResults(results)
    } catch (err) {
      setError(err.message)
    }
  }

  const displayFiles = (searchResults ?? files)
    .filter((file) => !typeFilter || getFileCategory(file.mime_type, file.name) === typeFilter)
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'size') return (b.size_bytes ?? 0) - (a.size_bytes ?? 0)
      if (sortBy === 'type') return getFileCategory(a.mime_type, a.name).localeCompare(getFileCategory(b.mime_type, b.name))
      return new Date(b.created_at) - new Date(a.created_at)
    })

  if (!workspace) {
    return <p className="eyebrow">No workspace found yet.</p>
  }

  if (isLoading) {
    return (
      <section className="dashboard-page">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Workspace</p>
            <h1>Files</h1>
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
    <section className="dashboard-page" aria-labelledby="files-title" onClick={() => setOpenMenuId(null)}>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1 id="files-title">Files</h1>
          <p>Share and store files with your workspace.</p>
        </div>
        <div className="row-actions">
          <button className="small-action" onClick={() => setIsCreatingFolder((open) => !open)} type="button">
            {isCreatingFolder ? 'Cancel' : 'New folder'}
          </button>
          <Button disabled={isUploading} onClick={() => fileInputRef.current?.click()} type="button">
            {isUploading ? 'Uploading…' : 'Upload file'}
          </Button>
          <input hidden multiple onChange={(event) => handleUploadFiles(event.target.files)} ref={fileInputRef} type="file" />
        </div>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {isCreatingFolder && (
        <form className="inline-form" onSubmit={handleCreateFolder} style={{ marginBottom: '1rem' }}>
          <input
            aria-label="Folder name"
            onChange={(event) => setNewFolderName(event.target.value)}
            placeholder="Folder name"
            required
            value={newFolderName}
          />
          <Button type="submit">Create</Button>
        </form>
      )}

      {!searchResults && recentFiles.length > 0 && !currentFolderId && (
        <article className="panel-card" style={{ marginBottom: '1rem' }}>
          <div className="panel-header">
            <h2>Recent files</h2>
          </div>
          <div className="user-list">
            {recentFiles.map((file) => (
              <div className="user-row" key={file.id}>
                <span className="avatar">
                  <FileTypeIcon category={getFileCategory(file.mime_type, file.name)} />
                </span>
                <div>
                  <strong>{file.name}</strong>
                  <span>
                    {formatFileSize(file.size_bytes)} · {file.profiles?.full_name || 'Unknown'} · {timeAgo(file.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </article>
      )}

      <article className="panel-card">
        <div className="files-toolbar">
          <form onSubmit={handleSearch} style={{ flex: 1 }}>
            <input
              aria-label="Search files"
              className="files-search"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search files…"
              value={searchQuery}
            />
          </form>
          <div className="view-toggle">
            <button className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')} type="button">
              Grid
            </button>
            <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')} type="button">
              List
            </button>
          </div>
        </div>

        <div className="task-filters">
          <select aria-label="Filter by type" onChange={(event) => setTypeFilter(event.target.value)} value={typeFilter}>
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select aria-label="Sort by" onChange={(event) => setSortBy(event.target.value)} value={sortBy}>
            <option value="date">Sort by date uploaded</option>
            <option value="name">Sort by name</option>
            <option value="size">Sort by size</option>
            <option value="type">Sort by type</option>
          </select>
        </div>

        {!searchResults && (
          <div className="breadcrumb">
            <button onClick={() => navigateToFolder(null)} type="button">
              Files
            </button>
            {folderPath.map((folder, index) => (
              <span key={folder.id}>
                {' / '}
                {index === folderPath.length - 1 ? (
                  <span className="current">{folder.name}</span>
                ) : (
                  <button onClick={() => navigateToFolder(folder.id)} type="button">
                    {folder.name}
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

        <div
          className={`dropzone${isDragOver ? ' drag-over' : ''}`}
          onDragLeave={() => setIsDragOver(false)}
          onDragOver={(event) => {
            event.preventDefault()
            setIsDragOver(true)
          }}
          onDrop={handleDrop}
          style={{ marginBottom: '1rem' }}
        >
          <p>Drag and drop files here, or use the Upload button above.</p>
        </div>

        {!searchResults && folders.length > 0 && (
          <div className="file-grid" style={{ marginBottom: '1rem' }}>
            {folders.map((folder) => (
              <div className="file-card" key={folder.id} onClick={(event) => event.stopPropagation()}>
                {renamingId === `folder:${folder.id}` ? (
                  <form onSubmit={(event) => handleRenameSubmit(event, folder, true)}>
                    <input
                      autoFocus
                      onChange={(event) => setRenameValue(event.target.value)}
                      style={{ width: '100%' }}
                      value={renameValue}
                    />
                  </form>
                ) : (
                  <>
                    <button
                      aria-label="Folder actions"
                      className="file-card-menu-trigger"
                      onClick={() => setOpenMenuId(openMenuId === `folder:${folder.id}` ? null : `folder:${folder.id}`)}
                      type="button"
                    >
                      ⋮
                    </button>
                    <div className="file-card-icon" onClick={() => navigateToFolder(folder.id)}>
                      📁
                    </div>
                    <strong onClick={() => navigateToFolder(folder.id)}>{folder.name}</strong>
                    {openMenuId === `folder:${folder.id}` && (
                      <div className="context-menu">
                        <button onClick={() => startRename(folder, true)} type="button">
                          Rename
                        </button>
                        <button className="danger" onClick={() => handleDeleteFolder(folder)} type="button">
                          Delete
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {displayFiles.length === 0 ? (
          <p className="empty-state-inline">
            {searchResults ? 'No files match your search.' : 'No files uploaded yet.'}
          </p>
        ) : viewMode === 'grid' ? (
          <div className="file-grid">
            {displayFiles.map((file) => (
              <div className="file-card" key={file.id} onClick={(event) => event.stopPropagation()}>
                {renamingId === `file:${file.id}` ? (
                  <form onSubmit={(event) => handleRenameSubmit(event, file, false)}>
                    <input
                      autoFocus
                      onChange={(event) => setRenameValue(event.target.value)}
                      style={{ width: '100%' }}
                      value={renameValue}
                    />
                  </form>
                ) : (
                  <>
                    <button
                      aria-label="File actions"
                      className="file-card-menu-trigger"
                      onClick={() => setOpenMenuId(openMenuId === `file:${file.id}` ? null : `file:${file.id}`)}
                      type="button"
                    >
                      ⋮
                    </button>
                    <div className="file-card-icon" onClick={() => setPreviewFile(file)}>
                      <FileTypeIcon category={getFileCategory(file.mime_type, file.name)} />
                    </div>
                    <strong onClick={() => setPreviewFile(file)}>{file.name}</strong>
                    <span>
                      {formatFileSize(file.size_bytes)} · {timeAgo(file.created_at)}
                    </span>
                    {(file.teamName || file.projectName) && (
                      <span className="folder-tag">{file.teamName || file.projectName}</span>
                    )}
                    {openMenuId === `file:${file.id}` && (
                      <div className="context-menu">
                        <button onClick={() => setPreviewFile(file)} type="button">
                          Preview
                        </button>
                        <button onClick={() => handleDownload(file)} type="button">
                          Download
                        </button>
                        <button onClick={() => setShareTarget(file)} type="button">
                          Share
                        </button>
                        <button onClick={() => setMovingFile(file)} type="button">
                          Move
                        </button>
                        {file.uploaded_by === currentUser.id && (
                          <button onClick={() => startRename(file, false)} type="button">
                            Rename
                          </button>
                        )}
                        {file.uploaded_by === currentUser.id && (
                          <button className="danger" onClick={() => handleDeleteFile(file)} type="button">
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="user-list">
            {displayFiles.map((file) => (
              <div className="user-row" key={file.id}>
                <span className="avatar">
                  <FileTypeIcon category={getFileCategory(file.mime_type, file.name)} />
                </span>
                <div style={{ cursor: 'pointer' }} onClick={() => setPreviewFile(file)}>
                  <strong>{file.name}</strong>
                  <span>
                    {formatFileSize(file.size_bytes)} · {file.profiles?.full_name || 'Unknown'} · {timeAgo(file.created_at)}
                  </span>
                </div>
                <div className="row-actions">
                  <button className="text-button" onClick={() => handleDownload(file)} type="button">
                    Download
                  </button>
                  <button className="text-button" onClick={() => setShareTarget(file)} type="button">
                    Share
                  </button>
                  {file.uploaded_by === currentUser.id && (
                    <button className="text-button danger" onClick={() => handleDeleteFile(file)} type="button">
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </article>

      {previewFile && (
        <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} onDownload={handleDownload} />
      )}

      {shareTarget && (
        <ShareFileModal
          currentUser={currentUser}
          file={shareTarget}
          onClose={() => setShareTarget(null)}
          teams={teams}
          workspace={workspace}
          workspaceMembers={workspaceMembers}
        />
      )}

      {movingFile && (
        <div className="modal-backdrop" onClick={() => setMovingFile(null)}>
          <div className="task-modal" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="task-modal-header">
              <h2>Move "{movingFile.name}"</h2>
              <button aria-label="Close" className="task-modal-close" onClick={() => setMovingFile(null)} type="button">
                ×
              </button>
            </div>
            <div className="user-list">
              <button className="list-select-row" onClick={() => handleMoveFile(movingFile, null)} type="button">
                <div>
                  <strong>Files (root)</strong>
                </div>
              </button>
              {allFolders.map((folder) => (
                <button className="list-select-row" key={folder.id} onClick={() => handleMoveFile(movingFile, folder.id)} type="button">
                  <div>
                    <strong>{folderDepthLabel(folder, allFolders)}</strong>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
