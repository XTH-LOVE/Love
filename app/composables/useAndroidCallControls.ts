import { Capacitor, registerPlugin } from '@capacitor/core'

type CallControlsPlugin = {
  startCallService(options: { mode: 'audio' | 'video' }): Promise<void>
  stopCallService(): Promise<void>
  startIncomingAlert(): Promise<void>
  stopIncomingAlert(): Promise<void>
  getOverlayPermission(): Promise<{ granted: boolean }>
  requestOverlayPermission(): Promise<void>
  showCallOverlay(options: { text: string }): Promise<void>
  hideCallOverlay(): Promise<void>
}

const CallControls = registerPlugin<CallControlsPlugin>('CallControls')

export function isNativeAndroid() {
  return import.meta.client && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

export async function startNativeCallService(mode: 'audio' | 'video') {
  if (!isNativeAndroid()) return
  await CallControls.startCallService({ mode }).catch(() => undefined)
}

export async function stopNativeCallService() {
  if (!isNativeAndroid()) return
  await CallControls.stopCallService().catch(() => undefined)
}

export async function startNativeIncomingAlert() {
  if (!isNativeAndroid()) return
  await CallControls.startIncomingAlert().catch(() => undefined)
}

export async function stopNativeIncomingAlert() {
  if (!isNativeAndroid()) return
  await CallControls.stopIncomingAlert().catch(() => undefined)
}

export async function getNativeOverlayPermission() {
  if (!isNativeAndroid()) return false
  const result = await CallControls.getOverlayPermission().catch(() => ({ granted: false }))
  return Boolean(result.granted)
}

export async function requestNativeOverlayPermission() {
  if (!isNativeAndroid()) return
  await CallControls.requestOverlayPermission().catch(() => undefined)
}

export async function showNativeCallOverlay(text: string) {
  if (!isNativeAndroid()) return
  await CallControls.showCallOverlay({ text }).catch(() => undefined)
}

export async function hideNativeCallOverlay() {
  if (!isNativeAndroid()) return
  await CallControls.hideCallOverlay().catch(() => undefined)
}
