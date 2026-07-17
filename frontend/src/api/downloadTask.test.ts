import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import request from '@/utils/request'
import { downloadTaskFile } from './downloadTask'

vi.mock('@/utils/request', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('downloadTaskFile', () => {
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(request.post).mockResolvedValue({ success: true } as never)
    clickSpy.mockClear()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('creates a signed session before handing the file to the browser', async () => {
    await downloadTaskFile('task-123', 'large-file.zip')

    expect(request.post).toHaveBeenCalledWith(
      '/api/v1/download-tasks/task-123/download-session',
    )
    expect(clickSpy).toHaveBeenCalledTimes(1)

    const link = document.querySelector('a')
    expect(link?.getAttribute('href')).toBe('/api/v1/download-tasks/task-123/download')
    expect(link?.getAttribute('download')).toBe('large-file.zip')
  })

  it('does not start a download when the session cannot be created', async () => {
    vi.mocked(request.post).mockResolvedValue({ success: false, message: 'denied' } as never)

    await expect(downloadTaskFile('task-123', 'large-file.zip')).rejects.toThrow('denied')
    expect(clickSpy).not.toHaveBeenCalled()
  })
})
