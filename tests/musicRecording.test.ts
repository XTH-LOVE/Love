import { describe, expect, it } from 'vitest'
import { shouldSendRecordedVoice } from '../app/utils/musicRecording'

describe('music voice recording lifecycle', () => {
  it('sends only a non-cancelled recording with content and a valid duration', () => {
    expect(shouldSendRecordedVoice(false, 2, 1)).toBe(true)
    expect(shouldSendRecordedVoice(true, 2, 1)).toBe(false)
    expect(shouldSendRecordedVoice(false, 0, 1)).toBe(false)
    expect(shouldSendRecordedVoice(false, 2, 0)).toBe(false)
  })
})
