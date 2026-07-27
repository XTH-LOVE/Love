import Uppy from '@uppy/core'
import GoldenRetriever from '@uppy/golden-retriever'
import { restorePersistedJobs, restoredJobPatch, uploadQueueStorageKey } from '~/utils/uploadQueuePersistence'

export type UploadJobStatus = 'queued' | 'uploading' | 'retrying' | 'paused' | 'completed' | 'failed'
export type UploadOperation = {
  kind: 'album' | 'memory' | 'message' | 'avatar' | 'other'
  coupleId?: string
  albumId?: string
  takenDate?: string
  mediaType?: string
}
export type UploadJob = {
  id: string
  name: string
  size: number
  progress: number
  status: UploadJobStatus
  attempts: number
  error: string
  createdAt: string
  operation?: UploadOperation
  uppyFileId?: string
  restored?: boolean
}

type Progress = (value: number) => void
type Runner<T> = (setProgress: Progress) => Promise<T>
type UppyFileLike = { id: string; name?: string; data?: Blob; meta?: Record<string, unknown>; isRestored?: boolean; isGhost?: boolean }

const jobs = ref<UploadJob[]>([])
const runners = new Map<string, () => Promise<unknown>>()
const uppyId = 'couple-space-media'
let initialized = false
let uppy: Uppy | null = null

function persist() {
  if (!import.meta.client) return
  try {
    localStorage.setItem(queueStorageKey, JSON.stringify(jobs.value.filter(job => job.status !== 'completed').slice(-30)))
  } catch { /* best effort */ }
}

function syncRecoveredFiles() {
  if (!uppy) return
  const recovered = uppy.getFiles() as UppyFileLike[]
  for (const file of recovered) {
    const restoredJob = restoredJobPatch({ id: file.id, name: file.name, size: file.data?.size, isGhost: file.isGhost, meta: file.meta })
    if (!restoredJob || jobs.value.some(job => job.id === restoredJob.id)) continue
    jobs.value.push(restoredJob as UploadJob)
  }
  for (const job of jobs.value) {
    if (!job.uppyFileId && job.id) {
      const file = recovered.find(item => item.meta?.jobId === job.id)
      if (file) {
        job.uppyFileId = file.id
        job.restored = true
        if (job.status !== 'completed') {
          job.status = 'paused'
          job.error = file.isGhost ? '浏览器未能恢复文件内容，请重新选择文件' : '文件已从本地恢复，等待继续上传'
        }
      }
    }
  }
  persist()
}

function initUppy() {
  if (!import.meta.client || uppy) return
  uppy = new Uppy({
    id: uppyId,
    autoProceed: false,
    allowMultipleUploadBatches: true,
    restrictions: { maxFileSize: 1024 * 1024 * 1024 },
  })
  uppy.on('restored', () => syncRecoveredFiles())
  uppy.on('file-removed', () => syncRecoveredFiles())
  uppy.use(GoldenRetriever, {
    expires: 7 * 24 * 60 * 60 * 1000,
    serviceWorker: false,
    indexedDB: { name: 'couple-space-upload-recovery', version: 1 },
  })
}

function init() {
  if (!import.meta.client || initialized) return
  initialized = true
  initUppy()
  try {
    const stored = localStorage.getItem(uploadQueueStorageKey) || localStorage.getItem('couple-space-upload-queue-v1')
    jobs.value = restorePersistedJobs(stored) as UploadJob[]
  } catch { /* ignore malformed local queue */ }
  syncRecoveredFiles()
  window.addEventListener('online', () => {
    jobs.value.filter(job => job.status === 'paused' || job.status === 'retrying').forEach(job => {
      if (!job.restored) void retry(job.id)
    })
  })
}

function update(id: string, patch: Partial<UploadJob>) {
  const job = jobs.value.find(item => item.id === id)
  if (job) Object.assign(job, patch)
  persist()
}

function waitForNetwork() {
  if (!import.meta.client || navigator.onLine !== false) return Promise.resolve()
  return new Promise<void>(resolve => {
    const onOnline = () => { window.removeEventListener('online', onOnline); resolve() }
    window.addEventListener('online', onOnline, { once: true })
  })
}

function removeUppyFile(job: UploadJob) {
  if (!uppy || !job.uppyFileId) return
  try { uppy.removeFile(job.uppyFileId) } catch { /* already removed */ }
}

export async function runQueuedUpload<T>(file: File, label: string, runner: Runner<T>, operation?: UploadOperation) {
  init()
  const id = crypto.randomUUID()
  const job: UploadJob = { id, name: label || file.name, size: file.size, progress: 0, status: 'queued', attempts: 0, error: '', createdAt: new Date().toISOString(), operation }
  jobs.value.push(job)
  persist()
  let uppyFileId = ''
  try {
    uppyFileId = uppy?.addFile({
      name: file.name,
      type: file.type,
      data: file,
      source: 'couple-space',
      meta: { jobId: id, displayName: label || file.name, operation: operation || { kind: 'other' }, size: file.size },
    }) || ''
    job.uppyFileId = uppyFileId
  } catch (error) {
    // Uppy persistence is an enhancement; the business upload still works if IndexedDB is unavailable.
    console.warn('[media-upload] Uppy could not persist file', error)
  }
  persist()
  const execute = async () => {
    for (;;) {
      await waitForNetwork()
      update(id, { status: 'uploading', attempts: job.attempts + 1, error: '', progress: Math.max(job.progress, 4), restored: false })
      try {
        const result = await runner(value => update(id, { progress: Math.min(98, Math.max(4, Math.round(value))) }))
        update(id, { progress: 100, status: 'completed', error: '' })
        runners.delete(id)
        removeUppyFile(job)
        window.setTimeout(() => { jobs.value = jobs.value.filter(item => item.id !== id); persist() }, 5000)
        return result
      } catch (error: any) {
        const attempts = job.attempts
        const message = String(error?.message || '上传失败')
        if (attempts >= 3) { update(id, { status: 'failed', error: message }); throw error }
        update(id, { status: navigator.onLine === false ? 'paused' : 'retrying', error: message })
        await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** (attempts - 1)))
      }
    }
  }
  runners.set(id, execute)
  return execute()
}

export async function retry(id: string) {
  const runner = runners.get(id)
  if (!runner) {
    update(id, { error: '文件已保存在本地恢复队列，但当前页面没有可继续的业务操作，请回到原页面重新提交' })
    return
  }
  update(id, { attempts: 0, progress: 0, status: 'queued', error: '', restored: false })
  await runner()
}

export function dismissJob(id: string) {
  const job = jobs.value.find(item => item.id === id)
  if (job) removeUppyFile(job)
  runners.delete(id)
  jobs.value = jobs.value.filter(job => job.id !== id)
  persist()
}

export function getUploadRecoveryState() {
  return { uppy, jobs }
}

export function useMediaUploadQueue() {
  init()
  return { jobs, retry, dismissJob }
}
