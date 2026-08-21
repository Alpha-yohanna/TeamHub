import { supabase } from '../lib/supabaseClient'

const BUCKET = 'workspace-files'
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024 // 50MB

const ALLOWED_MIME_PREFIXES = ['image/', 'text/']
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed',
  'application/json',
]

const FILE_SELECT =
  'id, name, mime_type, size_bytes, storage_path, description, folder_id, team_id, project_id, task_id, message_id, created_at, updated_at, uploaded_by, profiles (id, full_name, username), teams (name), projects (name), folders (name)'

function mapFile(file) {
  return {
    ...file,
    teamName: file.teams?.name ?? null,
    projectName: file.projects?.name ?? null,
    folderName: file.folders?.name ?? null,
  }
}

export function isFileTypeAllowed(file) {
  if (!file.type) return true // browsers sometimes omit type for unusual extensions; don't block
  return ALLOWED_MIME_PREFIXES.some((prefix) => file.type.startsWith(prefix)) || ALLOWED_MIME_TYPES.includes(file.type)
}

export function getFileCategory(mimeType, name = '') {
  const extension = name.split('.').pop()?.toLowerCase() ?? ''

  if (mimeType?.startsWith('image/')) return 'image'
  if (mimeType === 'application/pdf' || extension === 'pdf') return 'pdf'
  if (mimeType?.startsWith('text/') || ['txt', 'md', 'csv'].includes(extension)) return 'text'
  if (mimeType?.includes('word') || ['doc', 'docx'].includes(extension)) return 'document'
  if (mimeType?.includes('sheet') || mimeType?.includes('excel') || ['xls', 'xlsx'].includes(extension)) return 'spreadsheet'
  if (mimeType?.includes('presentation') || mimeType?.includes('powerpoint') || ['ppt', 'pptx'].includes(extension)) return 'presentation'
  if (mimeType?.includes('zip') || ['zip', 'rar', '7z'].includes(extension)) return 'archive'
  return 'other'
}

export async function listFiles(workspaceId, { teamId, projectId, taskId, messageId, folderId } = {}) {
  let query = supabase.from(`files`).select(FILE_SELECT).eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(500)

  if (teamId) query = query.eq('team_id', teamId)
  if (projectId) query = query.eq('project_id', projectId)
  if (taskId) query = query.eq('task_id', taskId)
  if (messageId) query = query.eq('message_id', messageId)
  // PostgREST: .eq('col', null) never matches (SQL NULL semantics) — .is() is required for NULL.
  if (folderId !== undefined) query = folderId === null ? query.is('folder_id', null) : query.eq('folder_id', folderId)

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map(mapFile)
}

export async function searchFiles(workspaceId, queryText, limit = 30) {
  const trimmed = queryText.trim()
  if (!trimmed) return []

  const { data, error } = await supabase
    .from('files')
    .select(FILE_SELECT)
    .eq('workspace_id', workspaceId)
    .ilike('name', `%${trimmed}%`)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map(mapFile)
}

export async function listRecentFiles(workspaceId, limit = 5) {
  const { data, error } = await supabase
    .from('files')
    .select('id, name, mime_type, size_bytes, created_at, profiles (full_name, username)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function uploadFile({
  workspaceId,
  uploadedBy,
  file,
  teamId = null,
  projectId = null,
  taskId = null,
  messageId = null,
  folderId = null,
}) {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`${file.name} is larger than the 50MB limit.`)
  }
  if (!isFileTypeAllowed(file)) {
    throw new Error(`${file.name} isn't a supported file type.`)
  }

  const storagePath = `${workspaceId}/${crypto.randomUUID()}-${file.name}`

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file)

  if (uploadError) {
    throw new Error(uploadError.message)
  }

  const { data, error } = await supabase
    .from('files')
    .insert({
      workspace_id: workspaceId,
      uploaded_by: uploadedBy,
      name: file.name,
      storage_path: storagePath,
      mime_type: file.type || null,
      size_bytes: file.size,
      team_id: teamId,
      project_id: projectId,
      task_id: taskId,
      message_id: messageId,
      folder_id: folderId,
    })
    .select(FILE_SELECT)
    .single()

  if (error) {
    await supabase.storage.from(BUCKET).remove([storagePath])
    throw new Error(error.message)
  }

  return mapFile(data)
}

export async function renameFile({ fileId, name }) {
  const { data, error } = await supabase.from('files').update({ name }).eq('id', fileId).select(FILE_SELECT).single()

  if (error) {
    throw new Error(error.message)
  }

  return mapFile(data)
}

export async function updateFileDescription({ fileId, description }) {
  const { data, error } = await supabase.from('files').update({ description }).eq('id', fileId).select(FILE_SELECT).single()

  if (error) {
    throw new Error(error.message)
  }

  return mapFile(data)
}

export async function moveFile({ fileId, folderId }) {
  const { data, error } = await supabase.from('files').update({ folder_id: folderId }).eq('id', fileId).select(FILE_SELECT).single()

  if (error) {
    throw new Error(error.message)
  }

  return mapFile(data)
}

export async function getFileDownloadUrl(storagePath, expiresIn = 60) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresIn)

  if (error) {
    throw new Error(error.message)
  }

  return data.signedUrl
}

export async function getShareableLink(storagePath) {
  return getFileDownloadUrl(storagePath, 60 * 60 * 24)
}

export async function getFilePreviewText(storagePath) {
  const url = await getFileDownloadUrl(storagePath)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Could not load file preview.')
  }
  return response.text()
}

export async function deleteFile({ id, storagePath }) {
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([storagePath])

  if (storageError) {
    throw new Error(storageError.message)
  }

  const { error } = await supabase.from('files').delete().eq('id', id)

  if (error) {
    throw new Error(error.message)
  }
}

// --- Folders ---

export async function listFolders(workspaceId, parentFolderId = null) {
  let query = supabase
    .from('folders')
    .select('id, name, parent_folder_id, created_by, created_at, updated_at')
    .eq('workspace_id', workspaceId)
    .order('name', { ascending: true })

  query = parentFolderId ? query.eq('parent_folder_id', parentFolderId) : query.is('parent_folder_id', null)

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function listAllFolders(workspaceId) {
  const { data, error } = await supabase
    .from('folders')
    .select('id, name, parent_folder_id')
    .eq('workspace_id', workspaceId)
    .order('name', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function createFolder({ workspaceId, name, parentFolderId = null, createdBy }) {
  const { data, error } = await supabase
    .from('folders')
    .insert({ workspace_id: workspaceId, name, parent_folder_id: parentFolderId, created_by: createdBy })
    .select('id, name, parent_folder_id, created_by, created_at, updated_at')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function renameFolder({ folderId, name }) {
  const { data, error } = await supabase
    .from('folders')
    .update({ name })
    .eq('id', folderId)
    .select('id, name, parent_folder_id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function deleteFolder(folderId) {
  const { error } = await supabase.from('folders').delete().eq('id', folderId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function getFolderPath(folderId) {
  const path = []
  let currentId = folderId

  while (currentId) {
    const { data, error } = await supabase.from('folders').select('id, name, parent_folder_id').eq('id', currentId).single()

    if (error) {
      throw new Error(error.message)
    }

    path.unshift({ id: data.id, name: data.name })
    currentId = data.parent_folder_id
  }

  return path
}

export function formatFileSize(bytes) {
  if (!bytes) {
    return '0 KB'
  }

  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}
