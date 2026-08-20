import { describe, expect, it } from 'vitest'
import type { SessionAttachment } from '../src/protocol.ts'
import { createAttachmentAction } from '../src/client/ConversationAttachments.tsx'
import { apply } from '../src/client/index.ts'

type Occurrence = { source: string; ref: string; occurrenceId: string; offset: number; label: string }
type RegisteredSource = {
  name: string
  codec: { serialize(ref: string, signal: AbortSignal): Promise<string> }
}

function harness() {
  const occurrences: Occurrence[] = []
  let source: RegisteredSource | undefined
  const cleanups: Array<() => void> = []
  const actionContext = {
    get: () => ({
      input: {
        for: () => ({ state: { getSnapshot: () => ({ draft: '请分析附件', draftRev: 1, occurrences }) } }),
      },
    }),
    emit: (event: string, payload: { reference: { source: string; ref: string; label: string }; span: { start: number } }) => {
      if (event !== 'slash/input-insert-reference') return
      occurrences.push({
        source: payload.reference.source,
        ref: payload.reference.ref,
        label: payload.reference.label,
        offset: payload.span.start,
        occurrenceId: `occurrence-${occurrences.length + 1}`,
      })
    },
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
    sessions: { scope: () => actionContext },
  }
  return {
    ctx,
    action: createAttachmentAction(ctx, 'session-1'),
    source: () => source,
    dispose: () => cleanups.splice(0).reverse().forEach(cleanup => cleanup()),
  }
}

describe('COS conversation attachment input reference', () => {
  it('serializes a selected attachment with its local copy and cloud identity', async () => {
    const test = harness()
    const attachment: SessionAttachment = {
      path: 'D:/workspace/.dsh-cos/session-1/report.pdf',
      name: 'report.pdf',
      size: 1,
      source: 'cos',
      isDirectory: false,
      cos: { bucket: 'reports-1250000000', region: 'ap-shanghai', key: 'daily/report.pdf' },
    }

    try {
      apply(test.ctx as never)
      await test.action(attachment)
      const source = test.source()
      expect(source?.name).toBe('dsh-cos-attachment')
      const serialized = await source!.codec.serialize(attachment.path, new AbortController().signal)
      expect(serialized).toContain(`本地路径：${attachment.path}`)
      expect(serialized).toContain('COS URI：cos://reports-1250000000/daily/report.pdf')
      expect(serialized).toContain('地域：ap-shanghai')
    } finally {
      test.dispose()
    }
  })
})
