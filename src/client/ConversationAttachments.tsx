import React, { useState, useSyncExternalStore } from 'react'
import type { CosStorageItem, SessionAttachment } from '../protocol.ts'
import { importCosAttachment, removeSessionAttachment } from './api.ts'
import { getAttachmentCopy } from './attachment-copy.ts'
import { decodeSessionAttachmentReference, encodeSessionAttachmentReference, sessionAttachmentPath } from './attachment-reference.ts'
import { AttachmentPicker } from './AttachmentPicker.tsx'
import { StorageIcon } from './StorageIcon.tsx'
import { formatBytes } from './storage-format.ts'

const SOURCE_NAME = 'dsh-cos-attachment'

type Occurrence = {
  source: string
  ref: string
  occurrenceId: string | number
  offset: number
  length: number
  label: string
}

type InputSnapshot = {
  draft: string
  draftRev: number
  occurrences: readonly Occurrence[]
}

type InputActions = {
  insertText(text: string, span: { start: number; end: number; draftRev: number }): boolean
}

type InputReference = {
  source: string
  ref: string
  label: string
  clipboardText: string
}

type ActionContext = {
  get(name: string): { input?: { for(actx: ActionContext): { state: { getSnapshot(): InputSnapshot }; insertReference(reference: InputReference, span: { start: number; end: number; draftRev: number }): boolean } } } | undefined
  bail(scope: ActionContext, event: string, payload: Record<string, unknown>): unknown
}

export type InputServiceContext = {
  sessions: { scope(sessionId: string): ActionContext }
}

export type AttachmentSlotProps = {
  sessionId: string
  useInput: (selector: (state: InputSnapshot) => InputSnapshot) => InputSnapshot
  inputActions: InputActions
}

type AttachmentButtonProps = {
  sessionId: string
  attach: (attachment: SessionAttachment, firstInBatch?: boolean) => Promise<void>
}

const attachmentErrors = new Map<string, string>()

const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function setError(sessionId: string, value: string | undefined): void {
  if (value === undefined) attachmentErrors.delete(sessionId)
  else attachmentErrors.set(sessionId, value)
  notify()
}

async function insertReference(actx: ActionContext, attachment: SessionAttachment): Promise<void> {
  const conversation = actx.get('conversation')
  const input = conversation?.input?.for(actx)
  if (input === undefined) throw new Error('会话输入框暂不可用，请稍后重试。')
  const state = input.state.getSnapshot()
  const referenceIndex = state.occurrences.filter(item => item.source === SOURCE_NAME).length + 1
  const ref = encodeSessionAttachmentReference(attachment)
  const end = state.draft.length - state.occurrences
    .reduce((total, item) => total + item.length - 1, 0)
  const span = { start: end, end, draftRev: state.draftRev }
  const inserted = input.insertReference({
    source: SOURCE_NAME,
    ref,
    label: getAttachmentCopy().inputReference(referenceIndex),
    clipboardText: attachment.path,
  }, span)
  if (inserted) return

  throw new Error(getAttachmentCopy().attachmentError)
}

function AttachmentMenu({ sessionId, attach }: AttachmentButtonProps): React.JSX.Element {
  const copy = getAttachmentCopy()
  const [pickerOpen, setPickerOpen] = useState(false)

  const onCosPick = async (items: CosStorageItem[]) => {
    const completedKeys: string[] = []
    for (const item of items) {
      try {
        const response = await importCosAttachment({ sessionId, key: item.key, kind: item.kind })
        await attach(response.attachment)
        completedKeys.push(item.key)
      } catch (error) {
        const message = error instanceof Error ? error.message : getAttachmentCopy().attachmentError
        const prefix = completedKeys.length > 0 ? `已添加 ${completedKeys.length} 个附件。` : ''
        throw Object.assign(new Error(`${prefix}添加“${item.name}”失败：${message}`), { completedKeys })
      }
    }
  }

  return (
    <div className="dsh-cos-conversation-attach">
      <button
        type="button"
        className="dsh-cos-conversation-attach__trigger"
        aria-label={copy.menuLabel}
        aria-expanded={pickerOpen}
        onClick={() => setPickerOpen(true)}
      >{copy.cosStorage}</button>
      {pickerOpen && <AttachmentPicker sessionId={sessionId} copy={copy} onPick={onCosPick} onClose={() => setPickerOpen(false)} />}
    </div>
  )
}

export function ConversationAttachmentButton(props: AttachmentButtonProps): React.JSX.Element {
  return <AttachmentMenu {...props} />
}

export function createAttachmentAction(ctx: InputServiceContext, sessionId: string): (attachment: SessionAttachment, firstInBatch?: boolean) => Promise<void> {
  return async (attachment) => {
    await insertReference(ctx.sessions.scope(sessionId), attachment)
    setError(sessionId, undefined)
  }
}

export function ConversationAttachmentDock({ sessionId, useInput, inputActions }: AttachmentSlotProps): React.JSX.Element | null {
  const copy = getAttachmentCopy()
  const state = useInput(snapshot => snapshot)
  const error = useSyncExternalStore(subscribe, () => attachmentErrors.get(sessionId))
  const occurrences = state.occurrences.filter(item => item.source === SOURCE_NAME)

  if (occurrences.length === 0 && error === undefined) return null

  const remove = (occurrence: Occurrence) => {
    const precedingExpansion = state.occurrences
      .filter(item => item.offset < occurrence.offset)
      .reduce((total, item) => total + item.length - 1, 0)
    const start = occurrence.offset - precedingExpansion
    const removed = inputActions.insertText('', { start, end: start + 1, draftRev: state.draftRev })
    if (!removed) {
      setError(sessionId, '无法从输入框移除附件，请稍后重试。')
      return
    }
    setError(sessionId, undefined)
    void removeSessionAttachment({ sessionId, path: sessionAttachmentPath(occurrence.ref) })
      .catch(error => setError(sessionId, error instanceof Error ? error.message : '删除附件副本失败。'))
  }

  return (
    <div className="dsh-cos-conversation-dock">
      {error && <div className="dsh-cos-conversation-dock__error" role="alert">{error}<button type="button" onClick={() => setError(sessionId, undefined)}>×</button></div>}
      {occurrences.map(occurrence => {
        const attachment = decodeSessionAttachmentReference(occurrence.ref)
        const path = attachment?.path ?? occurrence.ref
        const name = attachment?.name ?? path.split(/[\\/]/).filter(Boolean).pop() ?? path
        const item: CosStorageItem = {
          kind: attachment?.isDirectory ? 'folder' : 'file',
          name,
          key: path,
          path,
          size: attachment?.size ?? 0,
        }
        return (
          <div className="dsh-cos-conversation-card" key={occurrence.occurrenceId}>
            <span className="dsh-cos-conversation-card__icon"><StorageIcon item={item} /></span>
            <span className="dsh-cos-conversation-card__name" title={path}>{name}</span>
            <span className="dsh-cos-conversation-card__meta">{attachment?.source === 'cos' ? copy.cosSource : copy.localSource}{attachment && attachment.size > 0 ? ` · ${formatBytes(attachment.size)}` : ''}</span>
            <button type="button" aria-label={copy.remove} onClick={() => remove(occurrence)}>×</button>
          </div>
        )
      })}
    </div>
  )
}

export const attachmentSourceName = SOURCE_NAME
