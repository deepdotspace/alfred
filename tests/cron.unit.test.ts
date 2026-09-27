import { describe, expect, it } from 'vitest'
import { AUTOMATIC_TASKS_ENABLED, tasks } from '../src/cron'

describe('automatic cron spending guard', () => {
  it('keeps every scheduled task disabled until explicitly re-enabled', () => {
    expect(AUTOMATIC_TASKS_ENABLED).toBe(false)
    expect(tasks).toEqual([])
  })
})
