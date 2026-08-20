import { describe, expect, it } from 'vitest'
import type { SessionAttachment } from '../src/protocol.ts'
import { createAttachmentAction } from '../src/client/ConversationAttachments.tsx'
import { apply } from '../src/client/index.ts'

type Occurrence = { source: string; ref: string; occurrenceId: string; offset: number; label: string }
type RegisteredSource = {
  name: string
  codec: {
    clipboardText(ref: string): string
    serialize(ref: string, signal: AbortSignal): Promise<string>
  }
}

function harness() {
  const occurrences = new Map<string, Occurrence[]>()
  let source: RegisteredSource | undefined
  const cleanups: Array<() => void> = []
  const scope = (sessionId: string) => {
    const sessionOccurrences = occurrences.get(sessionId) ?? []
    occurrences.set(sessionId, sessionOccurrences)
    return {
      get: () => ({
        input: {
          for: () => ({ state: { getSnapshot: () => ({ draft: '请分析附件', draftRev: 1, occurrences: sessionOccurrences }) } }),
        },
      }),
      emit: (event: string, payload: { reference: { source: string; ref: string; label: string }; span: { start: number } }) => {
        if (event !== 'slash/input-insert-reference') return
        sessionOccurrences.push({
          source: payload.reference.source,
          ref: payload.reference.ref,
          label: payload.reference.label,
          offset: payload.span.start,
          occurrenceId: `${sessionId}-${sessionOccurrences.length + 1}`,
        })
      },
    }
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
    attach: (sessionId: string, attachment: SessionAttachment) => createAttachmentAction(ctx, sessionId)(attachment),
    occurrences: (sessionId: string) => occurrences.get(sessionId) ?? [],
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
})
