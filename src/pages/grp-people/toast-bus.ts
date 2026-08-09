/**
 * ناقل التوستات — pub/sub بسيط بلا مكوّنات React حتى يبقى Toast.tsx
 * مخصصًا للمكوّن فقط (قاعدة react-refresh). استدعِ toast() من أي مكان.
 */

export type ToastKind = 'success' | 'info' | 'error' | 'copy'

export interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

export type ToastListener = (t: ToastItem) => void

const listeners = new Set<ToastListener>()
let nextId = 1

/** اعرض رسالة توست */
export function toast(message: string, kind: ToastKind = 'success') {
  const item: ToastItem = { id: nextId++, kind, message }
  listeners.forEach((l) => l(item))
}

export function subscribeToasts(l: ToastListener): () => void {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
