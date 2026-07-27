import { describe, expect, it } from 'vitest'
import { restorePersistedJobs, restoredJobPatch } from '../app/utils/uploadQueuePersistence'

describe('upload queue persistence', () => {
  it('restores unfinished jobs while preserving terminal failures', () => {
    const jobs = restorePersistedJobs(JSON.stringify([
      { id: 'queued', name: 'photo.jpg', status: 'uploading', error: '', uppyFileId: 'uppy-1' },
      { id: 'failed', name: 'video.mp4', status: 'failed', error: '网络错误' },
    ]))

    expect(jobs[0]).toMatchObject({ id: 'queued', status: 'paused', restored: true })
    expect(jobs[1]).toMatchObject({ id: 'failed', status: 'failed', error: '网络错误' })
  })

  it('rejects malformed queue data instead of breaking app startup', () => {
    expect(restorePersistedJobs('{broken')).toEqual([])
    expect(restorePersistedJobs(JSON.stringify({ id: 'not-an-array' }))).toEqual([])
  })

  it('maps an Uppy restored file to a resumable business job', () => {
    expect(restoredJobPatch({
      id: 'uppy-1',
      name: 'photo.jpg',
      size: 2048,
      meta: { jobId: 'job-1', displayName: '相册 · photo.jpg', operation: { kind: 'album', albumId: 'album-1' } },
    })).toMatchObject({
      id: 'job-1',
      name: '相册 · photo.jpg',
      size: 2048,
      status: 'paused',
      restored: true,
      operation: { kind: 'album', albumId: 'album-1' },
    })
  })

  it('marks a missing IndexedDB blob as a ghost', () => {
    expect(restoredJobPatch({ id: 'uppy-2', meta: { jobId: 'job-2' }, isGhost: true })).toMatchObject({
      id: 'job-2',
      error: '浏览器未能恢复文件内容，请重新选择文件',
    })
  })
})
