import { describe, expect, it } from 'vitest'
import type { SessionAttachment } from '../src/protocol.ts'
import { createAttachmentAction } from '../src/client/ConversationAttachments.tsx'
import { apply } from '../src/client/index.ts'

type Occurrence = { source: string; ref: string; occurrenceId: string; offset: number; length: number; label: string }
type RegisteredSource = {
  name: string
  codec: {
    clipboardText(ref: string): string
    serialize(ref: string, signal: AbortSignal): Promise<string>
  }
}

function harness() {
  const occurrences = new Map<string, Occurrence[]>()
  const attachmentActions = new Map<string, (attachment: SessionAttachment, firstInBatch?: boolean) => Promise<void>>()
  const drafts = new Map<string, string>()
  const detectEnds = new Map<string, number>()
  let source: RegisteredSource | undefined
  let insertCalls = 0
  const cleanups: Array<() => void> = []
  const scope = (sessionId: string) => {
    const sessionOccurrences = occurrences.get(sessionId) ?? []
    occurrences.set(sessionId, sessionOccurrences)
    drafts.set(sessionId, drafts.get(sessionId) ?? '请分析附件')
    detectEnds.set(sessionId, detectEnds.get(sessionId) ?? '请分析附件'.length)
    return {
      get: () => ({
        input: {
          for: () => ({
            state: { getSnapshot: () => ({ draft: drafts.get(sessionId)!, draftRev: 1, occurrences: sessionOccurrences }) },
            insertReference: (reference: { source: string; ref: string; label: string; clipboardText: string }, span: { start: number; end: number }) => {
              if (span.start !== detectEnds.get(sessionId) || span.end !== detectEnds.get(sessionId)) return false
              insertCalls += 1
              sessionOccurrences.push({
                source: reference.source,
                ref: reference.ref,
                label: reference.label,
                offset: drafts.get(sessionId)!.length,
                length: reference.clipboardText.length,
                occurrenceId: `${sessionId}-${sessionOccurrences.length + 1}`,
              })
              drafts.set(sessionId, `${drafts.get(sessionId)!}${reference.clipboardText} `)
              detectEnds.set(sessionId, detectEnds.get(sessionId)! + 2)
              return true
            },
          }),
        },
      }),
      bail: () => true,
    }
  }
  const seedForeignReference = (sessionId: string) => {
    scope(sessionId)
    const prefix = drafts.get(sessionId)!
    const clipboardText = '/other-reference'
    occurrences.get(sessionId)!.push({
      source: 'other', ref: 'other', label: '外部引用',
      occurrenceId: `${sessionId}-foreign`, offset: prefix.length + 1, length: clipboardText.length,
    })
    drafts.set(sessionId, `${prefix} ${clipboardText} `)
    detectEnds.set(sessionId, prefix.length + 3)
  }
  const ctx = {
    effect(fn: () => unknown, label?: string) {
      if (label !== 'dsh-cos: apply guard' && label !== 'dsh-cos: attachment reference source') return
      const cleanup = fn()
      if (typeof cleanup === 'function') cleanups.push(cleanup as () => void)
    },
    inputTriggers: {
      registerSource(value: RegisteredSource) {
        source = value
      },
    },
    slots: { inject: () => {}, register: () => () => {} },
    sessions: { scope },
  }
  return {
    ctx,
    attach: (sessionId: string, attachment: SessionAttachment, firstInBatch = false) => {
      let action = attachmentActions.get(sessionId)
      if (action === undefined) {
        action = createAttachmentAction(ctx, sessionId)
        attachmentActions.set(sessionId, action)
      }
      return action(attachment, firstInBatch)
    },
    occurrences: (sessionId: string) => occurrences.get(sessionId) ?? [],
    seedForeignReference,
    insertCalls: () => insertCalls,
    source: () => source,
    dispose: () => cleanups.splice(0).reverse().forEach(cleanup => cleanup()),
  }
}

function cosAttachment(name: string, sessionId: string, bucket: string, region: string, key: string): SessionAttachment {
  return {
    path: `D:/workspace/.dsh-cos/${sessionId}/${name}`,
    name,
    size: 1,
    source: 'cos',
    isDirectory: false,
    cos: { bucket, region, key },
  }
}

describe('COS conversation attachment input reference', () => {
  it('retains two attachments after another session is opened and the original session is restored', async () => {
    const test = harness()
    const first = cosAttachment('first.pdf', 'session-1', 'first-1250000000', 'ap-shanghai', 'reports/first.pdf')
    const second = cosAttachment('second.pdf', 'session-1', 'second-1250000000', 'ap-beijing', 'reports/second.pdf')

    try {
      apply(test.ctx as never)
      await test.attach('session-1', first)
      await test.attach('session-1', second)
      test.occurrences('session-2')

      const source = test.source()
      const refs = test.occurrences('session-1').map(item => item.ref)
      expect(source?.name).toBe('dsh-cos-attachment')
      expect(test.insertCalls()).toBe(2)
      expect(refs).toHaveLength(2)
      expect(source!.codec.clipboardText(refs[0])).toBe(first.path)

      const restored = await Promise.all(refs.map(ref => source!.codec.serialize(ref, new AbortController().signal)))
      expect(restored[0]).toContain('COS URI：cos://first-1250000000/reports/first.pdf')
      expect(restored[0]).toContain('地域：ap-shanghai')
      expect(restored[1]).toContain('COS URI：cos://second-1250000000/reports/second.pdf')
      expect(restored[1]).toContain('地域：ap-beijing')
    } finally {
      test.dispose()
    }
  })

  it('inserts two COS references after an unrelated existing chip and its separator', async () => {
    const test = harness()
    test.seedForeignReference('session-1')
    try {
      await test.attach('session-1', cosAttachment('first.pdf', 'session-1', 'test-1250000000', 'ap-shanghai', 'first.pdf'))
      await test.attach('session-1', cosAttachment('second.pdf', 'session-1', 'test-1250000000', 'ap-shanghai', 'second.pdf'))
      expect(test.insertCalls()).toBe(2)
      expect(test.occurrences('session-1').map(item => item.source)).toEqual(['other', 'dsh-cos-attachment', 'dsh-cos-attachment'])
    } finally {
      test.dispose()
    }
  })
})
