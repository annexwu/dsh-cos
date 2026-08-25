import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type { CosStorageItem } from '../protocol.ts'
import { importCosAttachment } from './api.ts'
import {
  ConversationAttachmentButton,
  ConversationAttachmentDock,
  createAttachmentAction,
  type InputServiceContext,
} from './ConversationAttachments.tsx'
import { serializeSessionAttachmentReference, sessionAttachmentPath } from './attachment-reference.ts'
import { SettingsCard } from './SettingsCard.tsx'
import { CosStorageController } from './controller.ts'
import { mountPanel } from './panel.tsx'
import { mountSidebarEntry } from './sidebar.ts'
import { installStyles } from './styles.ts'

export const inject = ['slots', 'sessions', 'inputTriggers']
let applied = false

type AttachmentClientContext = ClientContext & InputServiceContext & {
  inputTriggers: {
    registerSource(source: Record<string, unknown>): void
  }
}

export function apply(ctx: AttachmentClientContext): void {
  if (applied) return
  applied = true
  ctx.effect(() => () => { applied = false }, 'dsh-cos: apply guard')
  ctx.effect(installStyles, 'dsh-cos: styles')

  ctx.effect(() => {
    ctx.inputTriggers.registerSource({
      trigger: '@',
      name: 'dsh-cos-attachment',
      candidates: async () => [],
      onPick: () => undefined,
      codec: {
        clipboardText: (ref: string) => sessionAttachmentPath(ref),
        serialize: async (ref: string) => serializeSessionAttachmentReference(ref),
      },
    })
    return () => undefined
  }, 'dsh-cos: attachment reference source')

  const settingsSlots = ctx.slots as unknown as {
    inject(name: string, register: () => (() => void)): void
    register(spec: Record<string, unknown>, component: unknown): () => void
  }
  settingsSlots.inject('settings.plugin.item', () => settingsSlots.register({
    name: 'settings.plugin.item',
    id: 'dsh-cos',
    key: 'dsh-cos',
    order: 100,
  }, SettingsCard))

  const conversationSlots = ctx.slots as unknown as {
    inject(name: string, register: () => (() => void)): void
    register(spec: Record<string, unknown>, component: unknown): () => void
  }
  conversationSlots.inject('conversation.input.left', () => conversationSlots.register({
    name: 'conversation.input.left',
    id: 'dsh-cos.attachments',
    order: 120,
    inject: (sessionId: string) => ({ sessionId, attach: createAttachmentAction(ctx, sessionId) }),
  }, ConversationAttachmentButton))

  conversationSlots.inject('conversation.input.dock', () => conversationSlots.register({
    name: 'conversation.input.dock',
    id: 'dsh-cos.attachment-dock',
    order: 120,
  }, ConversationAttachmentDock))

  ctx.effect(() => {
    const controller = new CosStorageController()
    const disposers: Array<() => void> = []
    try {
      const sessionService = ctx.sessions as unknown as {
        list: { getSnapshot(): { current: string | undefined; ids: string[] } }
        open(sessionId: string): void
      }
      const currentSessionId = (): string => {
        const sessionList = sessionService.list.getSnapshot()
        const sessionId = sessionList.current ?? sessionList.ids.at(-1)
        if (sessionId === undefined) throw new Error('当前没有可用的会话，请先打开或新建一个会话。')
        return sessionId
      }
      const startConversation = async (item: CosStorageItem): Promise<void> => {
        const sessionId = currentSessionId()
        const response = await importCosAttachment({ sessionId, key: item.key, kind: item.kind })
        sessionService.open(sessionId)
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
        await createAttachmentAction(ctx, sessionId)(response.attachment)
        controller.close()
      }
      const requestDocumentPreview = async (bucket: string): Promise<void> => {
        const sessionId = currentSessionId()
        sessionService.open(sessionId)
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
        const actx = ctx.sessions.scope(sessionId)
        const input = actx.get('conversation')?.input?.for(actx)
        if (input === undefined) throw new Error('会话输入框暂不可用，请稍后重试。')
        const state = input.state.getSnapshot()
        actx.emit('slash/input-insert-text', {
          text: `请协助为 COS 存储桶 ${bucket} 开通文档预览服务，并说明开通步骤。`,
          span: { start: state.draft.length, end: state.draft.length, draftRev: state.draftRev },
        })
        controller.close()
      }
      disposers.push(mountSidebarEntry(controller))
      disposers.push(mountPanel(controller, startConversation, requestDocumentPreview))
    } catch (error) {
      console.error('[dsh-cos] UI mount failed', error)
    }
    return () => {
      controller.close()
      for (const dispose of disposers.reverse()) dispose()
    }
  }, 'dsh-cos: UI surfaces')
}
