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
  label: string
}

type InputSnapshot = {
  draft: string
  draftRev: number
  occurrences: readonly Occurrence[]
}

type InputActions = {
  setDraft(text: string): void
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

let lastError: string | undefined

const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function attachmentErrorSnapshot(): string | undefined {
  return lastError
}

function setError(value: string | undefined): void {
  lastError = value
  notify()
}

async function insertReference(
  actx: ActionContext,
  attachment: SessionAttachment,
  detectEnd?: number,
): Promise<{ nextDetectEnd: number }> {
  const conversation = actx.get('conversation')
  const input = conversation?.input?.for(actx)
  if (input === undefined) throw new Error('会话输入框暂不可用，请稍后重试。')
  const state = input.state.getSnapshot()
  const referenceIndex = state.occurrences.filter(item => item.source === SOURCE_NAME).length + 1
  const ref = encodeSessionAttachmentReference(attachment)
  const existingOwnReferenceLength = state.occurrences
    .filter(item => item.source === SOURCE_NAME)
    .reduce((total, item) => total + sessionAttachmentPath(item.ref).length, 0)
  const end = detectEnd ?? state.draft.length - existingOwnReferenceLength
  const span = { start: end, end, draftRev: state.draftRev }
  const inserted = input.insertReference({
    source: SOURCE_NAME,
    ref,
    label: getAttachmentCopy().inputReference(referenceIndex),
    clipboardText: attachment.path,
  }, span)
  if (inserted) return { nextDetectEnd: end + 1 }

  throw new Error(getAttachmentCopy().attachmentError)
}

function AttachmentMenu({ sessionId, attach }: AttachmentButtonProps): React.JSX.Element {
  const copy = getAttachmentCopy()
  const [pickerOpen, setPickerOpen] = useState(false)

  const onCosPick = async (items: CosStorageItem[]) => {
    for (const [index, item] of items.entries()) {
      try {
        const response = await importCosAttachment({ sessionId, key: item.key, kind: item.kind })
        await attach(response.attachment, index === 0)
      } catch (error) {
        const message = error instanceof Error ? error.message : getAttachmentCopy().attachmentError
        throw new Error(`添加“${item.name}”失败：${message}`)
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
  let nextDetectEnd: number | undefined
  return async (attachment, firstInBatch = false) => {
    if (firstInBatch) nextDetectEnd = undefined
    const result = await insertReference(ctx.sessions.scope(sessionId), attachment, nextDetectEnd)
    nextDetectEnd = result.nextDetectEnd
    setError(undefined)
  }
}

export function ConversationAttachmentDock({ sessionId, useInput, inputActions }: AttachmentSlotProps): React.JSX.Element | null {
  const copy = getAttachmentCopy()
  const state = useInput(snapshot => snapshot)
  const error = useSyncExternalStore(subscribe, attachmentErrorSnapshot)
  const occurrences = state.occurrences.filter(item => item.source === SOURCE_NAME)

  if (occurrences.length === 0 && error === undefined) return null

  const remove = (occurrence: Occurrence) => {
    let end = occurrence.offset
    while (end < state.draft.length && !/\s/.test(state.draft[end])) end += 1
    inputActions.setDraft(`${state.draft.slice(0, occurrence.offset)}${state.draft.slice(end)}`)
    void removeSessionAttachment({ sessionId, path: sessionAttachmentPath(occurrence.ref) }).catch(() => {})
  }

  return (
    <div className="dsh-cos-conversation-dock">
      {error && <div className="dsh-cos-conversation-dock__error" role="alert">{error}<button type="button" onClick={() => setError(undefined)}>×</button></div>}
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
