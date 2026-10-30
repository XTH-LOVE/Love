export function shouldSendRecordedVoice(cancelled: boolean, seconds: number, chunkCount: number) {
  return !cancelled && seconds >= 1 && chunkCount > 0
}
