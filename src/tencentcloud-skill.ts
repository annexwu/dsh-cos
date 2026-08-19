import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-skill'

const FALLBACK_SKILL_CONTENT = `# 腾讯云 COS 全功能管理

使用 \`tencentcloud_cos_storage_manage\` 管理 COS Bucket、对象和 Bucket 配置；使用 \`tencentcloud_cos_ci_manage\` 管理 COS CI 与 MetaInsight。

两个 Tool 都使用 \`Action\` 和 \`Parameters\`。先调用 \`Action: "help"\` 获取当前 allowlist。插件自动使用设置中已配置的凭证；不要传递或索取密钥、Token、Cookie 或 Authorization。

“云存储”和历史名称“云盘”指同一个插件场景。用户提到任一名称，或上文已经确定当前语境是插件 COS 云存储时，必须优先阅读并遵循 \`references/cloud-storage.md\`，再选择 Action 和参数。即使本轮只说“同步这些产物”“上传一下”“下载它”，也继续按云存储流程执行，不要当作账号级通用 COS 操作。对外回复优先使用“COS 云存储”或“云存储”。

云存储操作仍使用 \`tencentcloud_cos_storage_manage\`。同步产物但未指定云存储子目录时，必须先询问并确认目标目录；不得上传到 Prefix 根目录、扁平化目录结构或省略 upload 的 key。

先查询再变更。写入、配置和删除操作前，先说明精确目标与影响，并等待用户在后续消息中明确同意；Tool 不显示 DSH 审批卡。`

function bundledSkillDirectory(): string {
  if (process.env.VITEST !== undefined || process.env.NODE_ENV === 'test') return resolve(process.cwd(), 'skills/tencentcloud-cos')
  if (import.meta.url.startsWith('file:')) return fileURLToPath(new URL('../skills/tencentcloud-cos', import.meta.url))
  return resolve(process.cwd(), 'skills/tencentcloud-cos')
}

function bundledSkillPath(): string {
  return resolve(bundledSkillDirectory(), 'SKILL.md')
}

function bundledSkillContent(): string {
  try {
    return readFileSync(bundledSkillPath(), 'utf8')
  } catch {
    return FALLBACK_SKILL_CONTENT
  }
}

export function registerTencentCloudCosSkill(ctx: Context): () => void {
  return ctx.skills.register({
    name: 'tencentcloud-cos',
    description: '通过已配置凭证操作插件 COS 云存储（兼容历史名称“云盘”），并管理腾讯云 COS、数据万象（CI）与 MetaInsight：云存储文件与产物同步、Bucket、对象、配置、媒体处理、审核、数据集和智能检索。',
    whenToUse: '用户提到云存储、当前云存储、我的云存储，或使用历史名称云盘、当前云盘、我的云盘，以及同步产物、上传生成结果、备份工作区时使用；也适用于查询和管理腾讯云 COS、CI、MetaInsight 资源。已建立的云存储或云盘上下文在后续指代中继续适用。',
    source: 'bundled',
    resourceBase: { kind: 'directory', path: bundledSkillDirectory() },
    content: bundledSkillContent(),
    invocation: { modelInvocable: true, userInvocable: true },
  })
}
