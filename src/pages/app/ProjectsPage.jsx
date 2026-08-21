import { useEffect, useState } from 'react'
import { ChannelPanel } from '../../components/messages/ChannelPanel'
import { KanbanBoard } from '../../components/projects/KanbanBoard'
import { TaskDetailModal } from '../../components/projects/TaskDetailModal'
import { TaskListView } from '../../components/projects/TaskListView'
import { Button } from '../../components/ui/Button'
import { timeAgo } from '../../lib/formatters'
import { describeActivity, listActivity, logActivity } from '../../services/activityService'
import { deleteFile, formatFileSize, getFileDownloadUrl, listFiles, uploadFile } from '../../services/fileService'
import { createChannel, listProjectChannels } from '../../services/messageService'
import { createNotification } from '../../services/notificationService'
import {
  addProjectMember,
  createProject,
  getProjectTaskCounts,
  listProjectMembers,
  listProjects,
  removeProjectMember,
  updateProject,
} from '../../services/projectService'
import {
  createTask,
  createTaskLabel,
  deleteTask,
  listTaskCommentCounts,
  listTaskLabels,
  listTasks,
  updateTask,
} from '../../services/taskService'
import { listTeamMembers, listTeams } from '../../services/teamService'
import { listWorkspaceMembers } from '../../services/workspaceService'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'members', label: 'Members' },
  { id: 'messages', label: 'Messages' },
  { id: 'files', label: 'Files' },
  { id: 'activity', label: 'Activity' },
]

const STATUS_LABELS = {
  planning: 'Planning',
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
  archived: 'Archived',
}

export function ProjectsPage({ currentUser, initialFocus, onFocusConsumed, workspace }) {
  const [projects, setProjects] = useState([])
  const [teams, setTeams] = useState([])
  const [workspaceMembers, setWorkspaceMembers] = useState([])
  const [workspaceLabels, setWorkspaceLabels] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [projectMembers, setProjectMembers] = useState([])
  const [teamMembersForProject, setTeamMembersForProject] = useState([])
  const [taskCounts, setTaskCounts] = useState({ totalTasks: 0, completedTasks: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('overview')

  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newTeamId, setNewTeamId] = useState('')
  const [newStartDate, setNewStartDate] = useState('')
  const [newDueDate, setNewDueDate] = useState('')

  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editTeamId, setEditTeamId] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [editDueDate, setEditDueDate] = useState('')

  const [addMemberId, setAddMemberId] = useState('')

  const [tasks, setTasks] = useState([])
  const [isLoadingTasks, setIsLoadingTasks] = useState(false)
  const [taskViewMode, setTaskViewMode] = useState('kanban')
  const [commentCounts, setCommentCounts] = useState({})
  const [attachmentTaskIds, setAttachmentTaskIds] = useState(new Set())
  const [selectedTaskId, setSelectedTaskId] = useState(null)
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState('medium')
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState('')
  const [newTaskDueDate, setNewTaskDueDate] = useState('')
  const [newLabelName, setNewLabelName] = useState('')

  const [projectChannels, setProjectChannels] = useState([])
  const [activeProjectChannelId, setActiveProjectChannelId] = useState(null)
  const [isLoadingChannels, setIsLoadingChannels] = useState(false)
  const [isCreatingChannel, setIsCreatingChannel] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')

  const [projectFiles, setProjectFiles] = useState([])
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const [projectActivityEntries, setProjectActivityEntries] = useState([])
  const [isLoadingActivity, setIsLoadingActivity] = useState(false)

  const isWorkspaceAdmin = workspace?.role === 'admin' || workspace?.role === 'owner'
  const myLedTeams = teams.filter((team) => team.lead?.id === currentUser.id)
  const canCreateProject = isWorkspaceAdmin || myLedTeams.length > 0
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null
  const isProjectAdmin =
    selectedProject &&
    (isWorkspaceAdmin ||
      selectedProject.ownerId === currentUser.id ||
      (selectedProject.teamId && myLedTeams.some((team) => team.id === selectedProject.teamId)))

  const assignableMembers = (() => {
    const merged = [...projectMembers]
    for (const member of teamMembersForProject) {
      if (!merged.some((existing) => existing.id === member.id)) merged.push(member)
    }
    return merged
  })()

  useEffect(() => {
    if (!workspace?.id) {
      setIsLoading(false)
      return
    }

    let isMounted = true
    setIsLoading(true)
    setSelectedProjectId(null)

    async function load() {
      try {
        const [projectList, teamList, members, labels] = await Promise.all([
          listProjects(workspace.id),
          listTeams(workspace.id),
          listWorkspaceMembers(workspace.id),
          listTaskLabels(workspace.id),
        ])
        if (!isMounted) return
        setProjects(projectList)
        setTeams(teamList)
        setWorkspaceMembers(members)
        setWorkspaceLabels(labels)

        const focusProjectId =
          initialFocus?.type === 'project' ? initialFocus.id : initialFocus?.type === 'task' ? initialFocus.metadata?.projectId : null

        if (focusProjectId && projectList.some((project) => project.id === focusProjectId)) {
          setSelectedProjectId(focusProjectId)
          if (initialFocus.type === 'project') onFocusConsumed?.()
        } else if (projectList.length > 0) {
          setSelectedProjectId(projectList[0].id)
        }
      } catch (err) {
        if (isMounted) setError(err.message)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    load()
    return () => {
      isMounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id])

  useEffect(() => {
    setActiveTab(initialFocus?.type === 'task' && initialFocus.metadata?.projectId === selectedProjectId ? 'tasks' : 'overview')
    setIsEditing(false)
    setTasks([])
    setProjectChannels([])
    setActiveProjectChannelId(null)
    setProjectFiles([])
    setProjectActivityEntries([])

    if (!selectedProjectId || !selectedProject) {
      setProjectMembers([])
      setTeamMembersForProject([])
      setTaskCounts({ totalTasks: 0, completedTasks: 0 })
      return
    }

    let isMounted = true
    Promise.all([
      listProjectMembers(selectedProjectId),
      selectedProject.teamId ? listTeamMembers(selectedProject.teamId) : Promise.resolve([]),
      getProjectTaskCounts(selectedProjectId),
    ])
      .then(([members, teamMembers, counts]) => {
        if (!isMounted) return
        setProjectMembers(members)
        setTeamMembersForProject(teamMembers)
        setTaskCounts(counts)
      })
      .catch((err) => {
        if (isMounted) setError(err.message)
      })

    return () => {
      isMounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId])

  useEffect(() => {
    if (activeTab !== 'tasks' || !selectedProjectId) return

    let isMounted = true
    setIsLoadingTasks(true)
    Promise.all([listTasks(selectedProjectId), listTaskCommentCounts(selectedProjectId), listFiles(workspace.id, { projectId: selectedProjectId })])
      .then(([taskList, counts, files]) => {
        if (!isMounted) return
        setTasks(taskList)
        setCommentCounts(counts)
        setAttachmentTaskIds(new Set(files.filter((file) => file.task_id).map((file) => file.task_id)))

        if (initialFocus?.type === 'task' && taskList.some((task) => task.id === initialFocus.id)) {
          setSelectedTaskId(initialFocus.id)
          onFocusConsumed?.()
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message)
      })
      .finally(() => {
        if (isMounted) setIsLoadingTasks(false)
      })

    return () => {
      isMounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedProjectId, workspace?.id])

  useEffect(() => {
    if (activeTab !== 'messages' || !selectedProjectId) return

    let isMounted = true
    setIsLoadingChannels(true)
    listProjectChannels(selectedProjectId)
      .then((channels) => {
        if (!isMounted) return
        setProjectChannels(channels)
        setActiveProjectChannelId((current) => current ?? channels[0]?.id ?? null)
      })
      .catch((err) => {
        if (isMounted) setError(err.message)
      })
      .finally(() => {
        if (isMounted) setIsLoadingChannels(false)
      })

    return () => {
      isMounted = false
    }
  }, [activeTab, selectedProjectId])

  useEffect(() => {
    if (activeTab !== 'files' || !selectedProjectId || !workspace?.id) return

    let isMounted = true
    setIsLoadingFiles(true)
    listFiles(workspace.id, { projectId: selectedProjectId })
      .then((files) => {
        if (isMounted) setProjectFiles(files)
      })
      .catch((err) => {
        if (isMounted) setError(err.message)
      })
      .finally(() => {
        if (isMounted) setIsLoadingFiles(false)
      })

    return () => {
      isMounted = false
    }
  }, [activeTab, selectedProjectId, workspace?.id])

  useEffect(() => {
    if (activeTab !== 'activity' || !selectedProjectId || !workspace?.id) return

    let isMounted = true
    setIsLoadingActivity(true)
    listActivity(workspace.id, 20, { projectId: selectedProjectId })
      .then((entries) => {
        if (isMounted) setProjectActivityEntries(entries)
      })
      .catch((err) => {
        if (isMounted) setError(err.message)
      })
      .finally(() => {
        if (isMounted) setIsLoadingActivity(false)
      })

    return () => {
      isMounted = false
    }
  }, [activeTab, selectedProjectId, workspace?.id])

  async function handleCreateProject(event) {
    event.preventDefault()
    if (!newName.trim()) return
    setError('')

    try {
      const project = await createProject({
        workspaceId: workspace.id,
        name: newName.trim(),
        description: newDescription.trim() || null,
        teamId: newTeamId || null,
        startDate: newStartDate || null,
        dueDate: newDueDate || null,
        ownerId: currentUser.id,
      })
      await logActivity({
        workspaceId: workspace.id,
        actorId: currentUser.id,
        action: 'project.created',
        targetType: 'project',
        targetId: project.id,
        metadata: { name: project.name },
        projectId: project.id,
      })
      setProjects((prev) => [{ ...project, memberCount: 1 }, ...prev])
      setSelectedProjectId(project.id)
      setNewName('')
      setNewDescription('')
      setNewTeamId('')
      setNewStartDate('')
      setNewDueDate('')
      setIsCreating(false)
    } catch (err) {
      setError(err.message)
    }
  }

  function startEditing() {
    setEditName(selectedProject.name)
    setEditDescription(selectedProject.description || '')
    setEditTeamId(selectedProject.teamId || '')
    setEditStartDate(selectedProject.startDate || '')
    setEditDueDate(selectedProject.dueDate || '')
    setIsEditing(true)
  }

  async function handleSaveEdit(event) {
    event.preventDefault()
    if (!editName.trim()) return
    setError('')

    try {
      const updated = await updateProject({
        projectId: selectedProjectId,
        name: editName.trim(),
        description: editDescription.trim() || null,
        teamId: editTeamId || null,
        startDate: editStartDate || null,
        dueDate: editDueDate || null,
      })
      await logActivity({
        workspaceId: workspace.id,
        actorId: currentUser.id,
        action: 'project.updated',
        targetType: 'project',
        targetId: selectedProjectId,
        metadata: { name: updated.name },
        projectId: selectedProjectId,
      })
      setProjects((prev) => prev.map((project) => (project.id === selectedProjectId ? { ...project, ...updated } : project)))
      setIsEditing(false)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleStatusChange(status) {
    setError('')
    try {
      const updated = await updateProject({ projectId: selectedProjectId, status })
      await logActivity({
        workspaceId: workspace.id,
        actorId: currentUser.id,
        action: status === 'archived' ? 'project.archived' : 'project.updated',
        targetType: 'project',
        targetId: selectedProjectId,
        metadata: { name: selectedProject.name },
        projectId: selectedProjectId,
      })
      setProjects((prev) => prev.map((project) => (project.id === selectedProjectId ? { ...project, ...updated } : project)))

      for (const member of projectMembers) {
        if (member.id === currentUser.id) continue
        await createNotification({
          workspaceId: workspace.id,
          userId: member.id,
          actorId: currentUser.id,
          type: 'project_status_changed',
          title: `"${selectedProject.name}" status changed`,
          message: STATUS_LABELS[status],
          targetType: 'project',
          targetId: selectedProjectId,
        })
      }
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleAddProjectMember(event) {
    event.preventDefault()
    if (!addMemberId || !selectedProjectId) return
    setError('')

    try {
      await addProjectMember({ projectId: selectedProjectId, userId: addMemberId, addedBy: currentUser.id })
      const addedMember = workspaceMembers.find((member) => member.id === addMemberId)

      await Promise.all([
        logActivity({
          workspaceId: workspace.id,
          actorId: currentUser.id,
          action: 'project.member_added',
          targetType: 'project_member',
          targetId: addMemberId,
          metadata: { name: addedMember?.full_name },
          projectId: selectedProjectId,
        }),
        createNotification({
          workspaceId: workspace.id,
          userId: addMemberId,
          actorId: currentUser.id,
          type: 'project_added',
          title: 'You were added to a project',
          message: selectedProject?.name ?? null,
          targetType: 'project',
          targetId: selectedProjectId,
        }),
      ])

      const members = await listProjectMembers(selectedProjectId)
      setProjectMembers(members)
      setProjects((prev) =>
        prev.map((project) => (project.id === selectedProjectId ? { ...project, memberCount: members.length } : project))
      )
      setAddMemberId('')
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleRemoveProjectMember(member) {
    if (!window.confirm(`Remove ${member.full_name} from ${selectedProject?.name}?`)) return
    setError('')

    try {
      await removeProjectMember(member.membershipId)

      await Promise.all([
        logActivity({
          workspaceId: workspace.id,
          actorId: currentUser.id,
          action: 'project.member_removed',
          targetType: 'project_member',
          targetId: member.id,
          metadata: { name: member.full_name },
          projectId: selectedProjectId,
        }),
        createNotification({
          workspaceId: workspace.id,
          userId: member.id,
          actorId: currentUser.id,
          type: 'project_removed',
          title: 'You were removed from a project',
          message: selectedProject?.name ?? null,
          targetType: 'project',
          targetId: selectedProjectId,
        }),
      ])

      setProjectMembers((prev) => prev.filter((item) => item.membershipId !== member.membershipId))
      setProjects((prev) =>
        prev.map((project) => (project.id === selectedProjectId ? { ...project, memberCount: project.memberCount - 1 } : project))
      )
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleCreateTask(event) {
    event.preventDefault()
    if (!newTaskTitle.trim()) return
    setError('')

    try {
      const task = await createTask({
        projectId: selectedProjectId,
        workspaceId: workspace.id,
        title: newTaskTitle.trim(),
        priority: newTaskPriority,
        assigneeId: newTaskAssigneeId || null,
        dueDate: newTaskDueDate || null,
        creatorId: currentUser.id,
      })
      await logActivity({
        workspaceId: workspace.id,
        actorId: currentUser.id,
        action: 'task.created',
        targetType: 'task',
        targetId: task.id,
        metadata: { name: task.title },
        projectId: selectedProjectId,
      })

      if (task.assigneeId) {
        const assignee = assignableMembers.find((member) => member.id === task.assigneeId)
        await logActivity({
          workspaceId: workspace.id,
          actorId: currentUser.id,
          action: 'task.assigned',
          targetType: 'task',
          targetId: task.id,
          metadata: { name: task.title, assignee: assignee?.full_name },
          projectId: selectedProjectId,
        })
        if (task.assigneeId !== currentUser.id) {
          await createNotification({
            workspaceId: workspace.id,
            userId: task.assigneeId,
            actorId: currentUser.id,
            type: 'task_assigned',
            title: 'You were assigned a task',
            message: task.title,
            targetType: 'task',
            targetId: task.id,
            metadata: { projectId: selectedProjectId },
          })
        }
      }

      setTasks((prev) => [...prev, task])
      setTaskCounts((prev) => ({ ...prev, totalTasks: prev.totalTasks + 1 }))
      setNewTaskTitle('')
      setNewTaskPriority('medium')
      setNewTaskAssigneeId('')
      setNewTaskDueDate('')
      setIsCreatingTask(false)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleTaskFieldChange(task, field, value) {
    setError('')
    try {
      const updated = await updateTask({ taskId: task.id, [field]: value })
      setTasks((prev) => prev.map((item) => (item.id === task.id ? updated : item)))
      if (selectedTaskId === task.id) {
        // modal reads from `tasks` via derived lookup below, so no extra state needed
      }

      if (field === 'status') {
        await logActivity({
          workspaceId: workspace.id,
          actorId: currentUser.id,
          action: 'task.status_changed',
          targetType: 'task',
          targetId: task.id,
          metadata: { name: task.title, status: value.replace('_', ' ') },
          projectId: selectedProjectId,
        })
        if (value === 'completed') {
          await logActivity({
            workspaceId: workspace.id,
            actorId: currentUser.id,
            action: 'task.completed',
            targetType: 'task',
            targetId: task.id,
            metadata: { name: task.title },
            projectId: selectedProjectId,
          })
          setTaskCounts((prev) => ({ ...prev, completedTasks: prev.completedTasks + 1 }))
        } else if (task.status === 'completed') {
          setTaskCounts((prev) => ({ ...prev, completedTasks: Math.max(0, prev.completedTasks - 1) }))
        }
        if (task.assigneeId && task.assigneeId !== currentUser.id) {
          await createNotification({
            workspaceId: workspace.id,
            userId: task.assigneeId,
            actorId: currentUser.id,
            type: 'task_status_changed',
            title: `"${task.title}" status changed`,
            message: value.replace('_', ' '),
            targetType: 'task',
            targetId: task.id,
            metadata: { projectId: selectedProjectId },
          })
        }
      } else if (field === 'assigneeId') {
        const assignee = assignableMembers.find((member) => member.id === value)
        await logActivity({
          workspaceId: workspace.id,
          actorId: currentUser.id,
          action: 'task.assigned',
          targetType: 'task',
          targetId: task.id,
          metadata: { name: task.title, assignee: assignee?.full_name ?? 'Unassigned' },
          projectId: selectedProjectId,
        })
        if (value && value !== currentUser.id) {
          await createNotification({
            workspaceId: workspace.id,
            userId: value,
            actorId: currentUser.id,
            type: 'task_assigned',
            title: 'You were assigned a task',
            message: task.title,
            targetType: 'task',
            targetId: task.id,
            metadata: { projectId: selectedProjectId },
          })
        }
      } else if (field === 'priority') {
        await logActivity({
          workspaceId: workspace.id,
          actorId: currentUser.id,
          action: 'task.priority_changed',
          targetType: 'task',
          targetId: task.id,
          metadata: { name: task.title, priority: value },
          projectId: selectedProjectId,
        })
      } else if (field === 'dueDate') {
        await logActivity({
          workspaceId: workspace.id,
          actorId: currentUser.id,
          action: 'task.due_date_changed',
          targetType: 'task',
          targetId: task.id,
          metadata: { name: task.title },
          projectId: selectedProjectId,
        })
        if (task.assigneeId && task.assigneeId !== currentUser.id) {
          await createNotification({
            workspaceId: workspace.id,
            userId: task.assigneeId,
            actorId: currentUser.id,
            type: 'task_due_date_changed',
            title: `Due date changed for "${task.title}"`,
            message: value ? `New due date: ${value}` : 'Due date removed',
            targetType: 'task',
            targetId: task.id,
            metadata: { projectId: selectedProjectId },
          })
        }
      }
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDeleteTask(taskId) {
    await deleteTask(taskId)
    setTasks((prev) => prev.filter((task) => task.id !== taskId))
    setTaskCounts((prev) => ({ ...prev, totalTasks: Math.max(0, prev.totalTasks - 1) }))
    setSelectedTaskId(null)
  }

  function handleLabelsChange(taskId, labels) {
    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, labels } : task)))
  }

  async function handleCreateLabel(event) {
    event.preventDefault()
    if (!newLabelName.trim()) return
    const colors = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2']
    const color = colors[workspaceLabels.length % colors.length]

    try {
      const label = await createTaskLabel({ workspaceId: workspace.id, name: newLabelName.trim(), color })
      setWorkspaceLabels((prev) => [...prev, label])
      setNewLabelName('')
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleCreateChannel(event) {
    event.preventDefault()
    if (!newChannelName.trim() || !selectedProjectId) return
    setError('')

    try {
      const channel = await createChannel({
        workspaceId: workspace.id,
        name: newChannelName.trim().toLowerCase().replace(/\s+/g, '-'),
        description: null,
        createdBy: currentUser.id,
        projectId: selectedProjectId,
      })
      await logActivity({
        workspaceId: workspace.id,
        actorId: currentUser.id,
        action: 'channel.created',
        targetType: 'channel',
        targetId: channel.id,
        metadata: { name: channel.name },
        projectId: selectedProjectId,
      })
      setProjectChannels((prev) => [...prev, channel])
      setActiveProjectChannelId(channel.id)
      setNewChannelName('')
      setIsCreatingChannel(false)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0]
    if (!file || !workspace || !selectedProjectId) return
    setError('')
    setIsUploading(true)

    try {
      const uploaded = await uploadFile({ workspaceId: workspace.id, uploadedBy: currentUser.id, file, projectId: selectedProjectId })
      await logActivity({
        workspaceId: workspace.id,
        actorId: currentUser.id,
        action: 'file.uploaded',
        targetType: 'file',
        targetId: uploaded.id,
        metadata: { name: uploaded.name },
        projectId: selectedProjectId,
      })
      setProjectFiles((prev) => [{ ...uploaded, profiles: { full_name: currentUser.name } }, ...prev])
    } catch (err) {
      setError(err.message)
    } finally {
      setIsUploading(false)
      event.target.value = ''
    }
  }

  async function handleFileDownload(file) {
    try {
      const url = await getFileDownloadUrl(file.storage_path)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleFileDelete(file) {
    if (!window.confirm(`Delete ${file.name}?`)) return
    try {
      await deleteFile({ id: file.id, storagePath: file.storage_path })
      setProjectFiles((prev) => prev.filter((item) => item.id !== file.id))
    } catch (err) {
      setError(err.message)
    }
  }

  const availableWorkspaceMembers = workspaceMembers.filter(
    (member) => !projectMembers.some((projectMember) => projectMember.id === member.id)
  )
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null
  const progressPercent = taskCounts.totalTasks > 0 ? Math.round((taskCounts.completedTasks / taskCounts.totalTasks) * 100) : 0

  if (!workspace) {
    return <p className="eyebrow">No workspace found yet.</p>
  }

  if (isLoading) {
    return <p className="eyebrow">Loading projects…</p>
  }

  return (
    <section className="dashboard-page" aria-labelledby="projects-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1 id="projects-title">Projects</h1>
          <p>Plan work, track tasks, and ship as a team.</p>
        </div>
        {canCreateProject && (
          <Button onClick={() => setIsCreating((open) => !open)} type="button">
            {isCreating ? 'Cancel' : 'New project'}
          </Button>
        )}
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {isCreating && (
        <form className="inline-form" onSubmit={handleCreateProject}>
          <input
            aria-label="Project name"
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Project name"
            required
            value={newName}
          />
          <input
            aria-label="Project description"
            onChange={(event) => setNewDescription(event.target.value)}
            placeholder="Description (optional)"
            value={newDescription}
          />
          <select aria-label="Assign to team" onChange={(event) => setNewTeamId(event.target.value)} value={newTeamId}>
            <option value="">No team</option>
            {(isWorkspaceAdmin ? teams : myLedTeams).map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
          <input aria-label="Start date" onChange={(event) => setNewStartDate(event.target.value)} type="date" value={newStartDate} />
          <input aria-label="Due date" onChange={(event) => setNewDueDate(event.target.value)} type="date" value={newDueDate} />
          <Button type="submit">Create project</Button>
        </form>
      )}

      <div className="teams-shell">
        <article className="panel-card">
          <div className="panel-header">
            <h2>All projects</h2>
          </div>
          {projects.length === 0 ? (
            <p className="empty-state-inline">{canCreateProject ? 'No projects yet. Create the first one.' : 'No projects yet.'}</p>
          ) : (
            <div className="user-list">
              {projects.map((project) => (
                <button
                  className={`list-select-row${project.id === selectedProjectId ? ' active' : ''}`}
                  key={project.id}
                  onClick={() => setSelectedProjectId(project.id)}
                  type="button"
                >
                  <div>
                    <strong>{project.name}</strong>
                    <span className="team-card-meta">
                      {STATUS_LABELS[project.status]}
                      {project.teamName ? ` · ${project.teamName}` : ''}
                    </span>
                  </div>
                  <em>{project.memberCount} member{project.memberCount === 1 ? '' : 's'}</em>
                </button>
              ))}
            </div>
          )}
        </article>

        <article className="panel-card">
          {!selectedProject ? (
            <p className="empty-state-inline">Select a project to see its workspace.</p>
          ) : (
            <>
              <div className="panel-header">
                {isEditing ? (
                  <form className="inline-form" onSubmit={handleSaveEdit} style={{ flex: 1 }}>
                    <input aria-label="Project name" onChange={(event) => setEditName(event.target.value)} required value={editName} />
                    <input
                      aria-label="Project description"
                      onChange={(event) => setEditDescription(event.target.value)}
                      placeholder="Description"
                      value={editDescription}
                    />
                    <select aria-label="Team" onChange={(event) => setEditTeamId(event.target.value)} value={editTeamId}>
                      <option value="">No team</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                    <input aria-label="Start date" onChange={(event) => setEditStartDate(event.target.value)} type="date" value={editStartDate} />
                    <input aria-label="Due date" onChange={(event) => setEditDueDate(event.target.value)} type="date" value={editDueDate} />
                    <Button type="submit">Save</Button>
                    <button className="text-button" onClick={() => setIsEditing(false)} type="button">
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    <div>
                      <h2>{selectedProject.name}</h2>
                      <span className="team-card-meta">{selectedProject.description || 'No description'}</span>
                    </div>
                    {isProjectAdmin && (
                      <div className="row-actions">
                        <button className="small-action" onClick={startEditing} type="button">
                          Edit
                        </button>
                        {selectedProject.status === 'archived' ? (
                          <button className="small-action" onClick={() => handleStatusChange('active')} type="button">
                            Restore
                          </button>
                        ) : (
                          <button className="text-button danger" onClick={() => handleStatusChange('archived')} type="button">
                            Archive
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              <nav className="team-tabs" aria-label="Project sections">
                {TABS.map((tab) => (
                  <button className={activeTab === tab.id ? 'active' : ''} key={tab.id} onClick={() => setActiveTab(tab.id)} type="button">
                    {tab.label}
                  </button>
                ))}
              </nav>

              {activeTab === 'overview' && (
                <div className="user-list">
                  <div className="user-row">
                    <div>
                      <strong>Status</strong>
                      {isProjectAdmin ? (
                        <select
                          onChange={(event) => handleStatusChange(event.target.value)}
                          style={{ marginTop: '0.3rem' }}
                          value={selectedProject.status}
                        >
                          {Object.entries(STATUS_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span>{STATUS_LABELS[selectedProject.status]}</span>
                      )}
                    </div>
                  </div>
                  <div className="user-row">
                    <div>
                      <strong>Owner</strong>
                      <span>{selectedProject.owner?.full_name ?? 'Unknown'}</span>
                    </div>
                  </div>
                  <div className="user-row">
                    <div>
                      <strong>Team</strong>
                      <span>{selectedProject.teamName ?? 'No team'}</span>
                    </div>
                  </div>
                  <div className="user-row">
                    <div>
                      <strong>Timeline</strong>
                      <span>
                        {selectedProject.startDate ?? 'No start date'} → {selectedProject.dueDate ?? 'No due date'}
                      </span>
                    </div>
                  </div>
                  <div className="user-row">
                    <div style={{ width: '100%' }}>
                      <strong>
                        Progress · {taskCounts.completedTasks}/{taskCounts.totalTasks} tasks complete
                      </strong>
                      <div className="progress-track" style={{ marginTop: '0.4rem' }}>
                        <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'tasks' && (
                <>
                  <div className="panel-header">
                    <div className="view-toggle">
                      <button className={taskViewMode === 'kanban' ? 'active' : ''} onClick={() => setTaskViewMode('kanban')} type="button">
                        Kanban
                      </button>
                      <button className={taskViewMode === 'list' ? 'active' : ''} onClick={() => setTaskViewMode('list')} type="button">
                        List
                      </button>
                    </div>
                    <button className="small-action" onClick={() => setIsCreatingTask((open) => !open)} type="button">
                      {isCreatingTask ? 'Cancel' : 'New task'}
                    </button>
                  </div>

                  {isCreatingTask && (
                    <form className="inline-form" onSubmit={handleCreateTask}>
                      <input
                        aria-label="Task title"
                        onChange={(event) => setNewTaskTitle(event.target.value)}
                        placeholder="Task title"
                        required
                        value={newTaskTitle}
                      />
                      <select aria-label="Priority" onChange={(event) => setNewTaskPriority(event.target.value)} value={newTaskPriority}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                      <select aria-label="Assignee" onChange={(event) => setNewTaskAssigneeId(event.target.value)} value={newTaskAssigneeId}>
                        <option value="">Unassigned</option>
                        {assignableMembers.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.full_name}
                          </option>
                        ))}
                      </select>
                      <input aria-label="Due date" onChange={(event) => setNewTaskDueDate(event.target.value)} type="date" value={newTaskDueDate} />
                      <Button type="submit">Create task</Button>
                    </form>
                  )}

                  {isWorkspaceAdmin && (
                    <form className="inline-form" onSubmit={handleCreateLabel} style={{ marginTop: '0.5rem' }}>
                      <input
                        aria-label="New label name"
                        onChange={(event) => setNewLabelName(event.target.value)}
                        placeholder="New label name"
                        value={newLabelName}
                      />
                      <button className="small-action" disabled={!newLabelName.trim()} type="submit">
                        Add label
                      </button>
                    </form>
                  )}

                  {isLoadingTasks ? (
                    <p className="empty-state-inline">Loading tasks…</p>
                  ) : tasks.length === 0 ? (
                    <p className="empty-state-inline">No tasks yet.</p>
                  ) : taskViewMode === 'kanban' ? (
                    <KanbanBoard
                      attachmentTaskIds={attachmentTaskIds}
                      commentCounts={commentCounts}
                      onCardClick={(task) => setSelectedTaskId(task.id)}
                      onStatusChange={(task, status) => handleTaskFieldChange(task, 'status', status)}
                      tasks={tasks}
                    />
                  ) : (
                    <TaskListView onRowClick={(task) => setSelectedTaskId(task.id)} projectMembers={assignableMembers} tasks={tasks} />
                  )}
                </>
              )}

              {activeTab === 'members' && (
                <>
                  <div className="user-list">
                    {projectMembers.map((member) => (
                      <div className="user-row" key={member.membershipId}>
                        <span className="avatar">{(member.full_name || member.username || '?').slice(0, 2).toUpperCase()}</span>
                        <div>
                          <strong>{member.full_name}</strong>
                          <span>{member.email || member.username}</span>
                        </div>
                        {isProjectAdmin && member.id !== currentUser.id && (
                          <button className="text-button danger" onClick={() => handleRemoveProjectMember(member)} type="button">
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {isProjectAdmin && availableWorkspaceMembers.length > 0 && (
                    <form className="inline-form" onSubmit={handleAddProjectMember}>
                      <select aria-label="Add workspace member" onChange={(event) => setAddMemberId(event.target.value)} value={addMemberId}>
                        <option value="">Add a workspace member…</option>
                        {availableWorkspaceMembers.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.full_name}
                          </option>
                        ))}
                      </select>
                      <Button disabled={!addMemberId} type="submit">
                        Add
                      </Button>
                    </form>
                  )}
                </>
              )}

              {activeTab === 'messages' && (
                <>
                  <div className="panel-header">
                    <button className="small-action" onClick={() => setIsCreatingChannel((open) => !open)} type="button">
                      {isCreatingChannel ? 'Cancel' : 'New project channel'}
                    </button>
                  </div>
                  {isCreatingChannel && (
                    <form className="inline-form" onSubmit={handleCreateChannel}>
                      <input
                        aria-label="Channel name"
                        onChange={(event) => setNewChannelName(event.target.value)}
                        placeholder="channel-name"
                        required
                        value={newChannelName}
                      />
                      <Button type="submit">Create</Button>
                    </form>
                  )}

                  {isLoadingChannels ? (
                    <p className="empty-state-inline">Loading channels…</p>
                  ) : projectChannels.length === 0 ? (
                    <p className="empty-state-inline">No channels for this project yet.</p>
                  ) : (
                    <div className="messages-shell">
                      <aside className="channel-list" aria-label="Project channels">
                        {projectChannels.map((channel) => (
                          <button
                            className={`channel-item${channel.id === activeProjectChannelId ? ' active' : ''}`}
                            key={channel.id}
                            onClick={() => setActiveProjectChannelId(channel.id)}
                            type="button"
                          >
                            # {channel.name}
                          </button>
                        ))}
                      </aside>
                      <ChannelPanel
                        channelId={activeProjectChannelId}
                        channelName={projectChannels.find((c) => c.id === activeProjectChannelId)?.name}
                        currentUser={currentUser}
                        members={assignableMembers}
                        workspaceId={workspace.id}
                      />
                    </div>
                  )}
                </>
              )}

              {activeTab === 'files' && (
                <>
                  <div className="panel-header">
                    <label className="small-action" style={{ cursor: 'pointer' }}>
                      {isUploading ? 'Uploading…' : 'Upload file'}
                      <input hidden onChange={handleFileChange} type="file" />
                    </label>
                  </div>
                  {isLoadingFiles ? (
                    <p className="empty-state-inline">Loading files…</p>
                  ) : projectFiles.length === 0 ? (
                    <p className="empty-state-inline">No files uploaded to this project yet.</p>
                  ) : (
                    <div className="user-list">
                      {projectFiles.map((file) => (
                        <div className="user-row" key={file.id}>
                          <span className="avatar">{file.name.slice(0, 2).toUpperCase()}</span>
                          <div>
                            <strong>{file.name}</strong>
                            <span>
                              {formatFileSize(file.size_bytes)} · {file.profiles?.full_name || 'Unknown'} · {timeAgo(file.created_at)}
                            </span>
                          </div>
                          <div className="row-actions">
                            <button className="text-button" onClick={() => handleFileDownload(file)} type="button">
                              Download
                            </button>
                            {file.uploaded_by === currentUser.id && (
                              <button className="text-button danger" onClick={() => handleFileDelete(file)} type="button">
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {activeTab === 'activity' && (
                <div className="activity-list">
                  {isLoadingActivity ? (
                    <p className="empty-state-inline">Loading activity…</p>
                  ) : projectActivityEntries.length === 0 ? (
                    <p className="empty-state-inline">No activity for this project yet.</p>
                  ) : (
                    projectActivityEntries.map((entry) => (
                      <div className="activity-item" key={entry.id}>
                        <span className="feature-dot" aria-hidden="true" />
                        <p>{describeActivity(entry)}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </article>
      </div>

      {selectedTask && (
        <TaskDetailModal
          canDelete={isProjectAdmin || selectedTask.creatorId === currentUser.id}
          canEdit={Boolean(selectedProject)}
          currentUser={currentUser}
          onClose={() => setSelectedTaskId(null)}
          onDeleteTask={handleDeleteTask}
          onFieldChange={(field, value) => handleTaskFieldChange(selectedTask, field, value)}
          onLabelsChange={handleLabelsChange}
          projectId={selectedProjectId}
          projectMembers={assignableMembers}
          task={selectedTask}
          workspaceId={workspace.id}
          workspaceLabels={workspaceLabels}
        />
      )}
    </section>
  )
}
