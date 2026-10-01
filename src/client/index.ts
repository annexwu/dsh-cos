import type { Context } from '@deepseek-ai/cordis'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
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
import { bindStoragePanel, CosStorageController } from './controller.ts'
import { StoragePanel } from './panel.tsx'
import { StoragePanelIcon } from './sidebar.tsx'
import { getCopy } from './copy.ts'
import { installStyles } from './styles.ts'
import { UploadCoordinator } from './upload-coordinator.ts'

export const inject = ['slots', 'sessions', 'inputTriggers', 'layout', 'uiWorkspace']
const PANEL_ID = 'dsh-cos' as MainPanelId
let applied = false

function currentSessionId(sessions: ISessions) {
  const session = Object.values(sessions.list.getSnapshot().byId)
    .find(item => (item.retainedBy.mainView ?? 0) > 0)
  if (session === undefined) throw new Error('当前没有打开的会话，请先在左侧选择或新建一个会话。')
  return session.id
}

export async function openDocumentPreviewConversation(ctx: Context, bucket: string): Promise<void> {
  const sessions = ctx.sessions as unknown as ISessions
  const sessionId = currentSessionId(sessions)
  const actx = sessions.scope(sessionId)
  if (actx === undefined) throw new Error('会话输入框暂不可用，请稍后重试。')
  const input = actx.get('conversation')?.input?.for(actx)
  if (input === undefined) throw new Error('会话输入框暂不可用，请稍后重试。')
  ctx.uiWorkspace.openSession(sessionId)
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  const state = input.state.getSnapshot()
  const end = state.draft.length - state.occurrences.reduce((total, item) => total + item.length - 1, 0)
  const inserted = actx.bail(actx, 'slash/input-insert-text', {
    text: `${state.draft ? '\n' : ''}请协助为 COS 存储桶 ${bucket} 开通文档预览服务，并说明开通步骤。`,
    span: { start: end, end, draftRev: state.draftRev },
  })
  if (inserted !== true) {
    const message = '无法将开通说明写入会话输入框，请稍后重试。'
    input.notify('error', message)
    throw new Error(message)
  }
  input.focus()
}

type AttachmentClientContext = Context & InputServiceContext & {
  inputTriggers: {
    registerSource(source: Record<string, unknown>): () => void
  }
}

export function apply(ctx: AttachmentClientContext): void {
  if (applied) return
  applied = true
  ctx.effect(() => () => { applied = false }, 'dsh-cos: apply guard')
  ctx.effect(installStyles, 'dsh-cos: styles')

  ctx.effect(() => ctx.inputTriggers.registerSource({
    trigger: '@',
    name: 'dsh-cos-attachment',
    candidates: async () => [],
    onPick: () => undefined,
    codec: {
      clipboardText: (ref: string) => sessionAttachmentPath(ref),
      serialize: async (ref: string) => serializeSessionAttachmentReference(ref),
    },
  }), 'dsh-cos: attachment reference source')

  const settingsSlots = ctx.slots as unknown as {
    inject(name: string, register: () => (() => void)): void
    register(spec: Record<string, unknown>, component: unknown): () => void
  }
  settingsSlots.inject('plugins.bundle.config', () => settingsSlots.register({
    name: 'plugins.bundle.config',
    key: 'dsh-cos',
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

  const controller = new CosStorageController(open => {
    if (open) ctx.layout.selectPanel(PANEL_ID)
    else if (ctx.layout.panelInfo.getSnapshot().activePanelId === PANEL_ID) ctx.layout.selectPanel(null)
  })
  const uploadCoordinator = new UploadCoordinator(() => undefined)
  ctx.effect(() => () => uploadCoordinator.dispose(), 'dsh-cos: upload lifecycle')
  ctx.effect(() => bindStoragePanel(controller, ctx.layout.panelInfo, PANEL_ID), 'dsh-cos: panel navigation')
  const startConversation = async (item: CosStorageItem): Promise<void> => {
    const sessions = ctx.sessions as unknown as ISessions
    const sessionId = currentSessionId(sessions)
    const actx = sessions.scope(sessionId)
    const input = actx?.get('conversation')?.input?.for(actx)
    if (input === undefined) throw new Error('会话输入框暂不可用，请稍后重试。')
    const response = await importCosAttachment({ sessionId, key: item.key, kind: item.kind })
    try {
      ctx.uiWorkspace.openSession(sessionId)
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      await createAttachmentAction(ctx, sessionId)(response.attachment)
    } catch (error) {
      if (ctx.layout.panelInfo.getSnapshot().activePanelId !== PANEL_ID) {
        input.notify('error', error instanceof Error ? error.message : '附件引用写入失败，请稍后重试。')
      }
      throw error
    }
  }
  const requestDocumentPreview = (bucket: string) => openDocumentPreviewConversation(ctx, bucket)
  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: PANEL_ID,
    inject: () => ({ controller, uploadCoordinator, onStartConversation: startConversation, onRequestDocumentPreview: requestDocumentPreview }),
  }, StoragePanel))
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: PANEL_ID,
    order: 120,
    label: () => getCopy().title,
  }, StoragePanelIcon))
  ctx.effect(() => () => controller.close(), 'dsh-cos: storage UI state')
}
