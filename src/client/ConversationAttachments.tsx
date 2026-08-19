import React, { useEffect, useState, useSyncExternalStore } from 'react'
import type { CosStorageItem, SessionAttachment } from '../protocol.ts'
import { importCosAttachment, removeSessionAttachment } from './api.ts'
import { getAttachmentCopy } from './attachment-copy.ts'
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

type ActionContext = {
  get(name: string): { input?: { for(actx: ActionContext): { state: { getSnapshot(): InputSnapshot } } } } | undefined
  emit(event: string, payload: Record<string, unknown>): void
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
  attach: (attachment: SessionAttachment) => Promise<void>
}

type AttachmentMeta = SessionAttachment & { label: string }

const metadata = new Map<string, AttachmentMeta>()
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

async function insertReference(actx: ActionContext, attachment: SessionAttachment): Promise<boolean> {
  const conversation = actx.get('conversation')
  const input = conversation?.input?.for(actx)
  if (input === undefined) throw new Error('conversation input service unavailable')
  const state = input.state.getSnapshot()
  const referenceIndex = state.occurrences.filter(item => item.source === SOURCE_NAME).length + 1
  actx.emit('slash/input-insert-reference', {
    reference: {
      source: SOURCE_NAME,
      ref: attachment.path,
      label: getAttachmentCopy().inputReference(referenceIndex),
      clipboardText: attachment.path,
    },
    span: {
      start: state.draft.length,
      end: state.draft.length,
      draftRev: state.draftRev,
    },
  })
  const inserted = input.state.getSnapshot().occurrences.some(item => item.source === SOURCE_NAME && item.ref === attachment.path)
  if (inserted) metadata.set(attachment.path, { ...attachment, label: attachment.name })
  return inserted
}

function AttachmentMenu({ sessionId, attach }: AttachmentButtonProps): React.JSX.Element {
  const copy = getAttachmentCopy()
  const [pickerOpen, setPickerOpen] = useState(false)

  const onCosPick = async (items: CosStorageItem[]) => {
    for (const item of items) {
      const response = await importCosAttachment({ sessionId, key: item.key, kind: item.kind })
      await attach(response.attachment)
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

export function createAttachmentAction(ctx: InputServiceContext, sessionId: string): (attachment: SessionAttachment) => Promise<void> {
  return async (attachment) => {
    const inserted = await insertReference(ctx.sessions.scope(sessionId), attachment)
    if (!inserted) throw new Error(getAttachmentCopy().attachmentError)
    setError(undefined)
  }
}

export function ConversationAttachmentDock({ sessionId, useInput, inputActions }: AttachmentSlotProps): React.JSX.Element | null {
  const copy = getAttachmentCopy()
  const state = useInput(snapshot => snapshot)
  const error = useSyncExternalStore(subscribe, attachmentErrorSnapshot)
  const occurrences = state.occurrences.filter(item => item.source === SOURCE_NAME)

  useEffect(() => {
    const live = new Set(occurrences.map(item => item.ref))
    for (const key of metadata.keys()) {
      if (!live.has(key)) metadata.delete(key)
    }
  }, [occurrences])

  if (occurrences.length === 0 && error === undefined) return null

  const remove = (occurrence: Occurrence) => {
    let end = occurrence.offset
    while (end < state.draft.length && !/\s/.test(state.draft[end])) end += 1
    inputActions.setDraft(`${state.draft.slice(0, occurrence.offset)}${state.draft.slice(end)}`)
    metadata.delete(occurrence.ref)
    void removeSessionAttachment({ sessionId, path: occurrence.ref }).catch(() => {})
  }

  return (
    <div className="dsh-cos-conversation-dock">
      {error && <div className="dsh-cos-conversation-dock__error" role="alert">{error}<button type="button" onClick={() => setError(undefined)}>×</button></div>}
      {occurrences.map(occurrence => {
        const meta = metadata.get(occurrence.ref)
        const name = meta?.name ?? occurrence.ref.split(/[\\/]/).filter(Boolean).pop() ?? occurrence.ref
        const item: CosStorageItem = {
          kind: meta?.isDirectory ? 'folder' : 'file',
          name,
          key: occurrence.ref,
          path: occurrence.ref,
          size: meta?.size ?? 0,
        }
        return (
          <div className="dsh-cos-conversation-card" key={occurrence.occurrenceId}>
            <span className="dsh-cos-conversation-card__icon"><StorageIcon item={item} /></span>
            <span className="dsh-cos-conversation-card__name" title={occurrence.ref}>{name}</span>
            <span className="dsh-cos-conversation-card__meta">{meta?.source === 'cos' ? copy.cosSource : copy.localSource}{meta && meta.size > 0 ? ` · ${formatBytes(meta.size)}` : ''}</span>
            <button type="button" aria-label={copy.remove} onClick={() => remove(occurrence)}>×</button>
          </div>
        )
      })}
    </div>
  )
}

export const attachmentSourceName = SOURCE_NAME
