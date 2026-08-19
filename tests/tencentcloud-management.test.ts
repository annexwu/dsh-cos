import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import SkillRegistry from '@deepseek-ai/dsh-skill'
import { afterEach, describe, expect, it } from 'vitest'
import { registerTencentCloudCosSkill } from '../src/tencentcloud-skill.ts'
import { applyTencentCloudManagementDefaults, getTencentCloudManagementActionCatalog, parseTencentCloudManagementParameters, registerTencentCloudManagementTools, sanitizeTencentCloudManagementOutput } from '../src/tencentcloud-tools.ts'

const contexts: Context[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(context => context.fiber.dispose()))
})

describe('Tencent Cloud COS management catalog', () => {
  it('keeps storage and CI/MetaInsight actions in two distinct allowlists', () => {
    const storage = getTencentCloudManagementActionCatalog('storage')
    const ci = getTencentCloudManagementActionCatalog('ci')
    const storageNames = new Set(storage.map(action => action.action))
    const ciNames = new Set(ci.map(action => action.action))

    expect([...storageNames]).toEqual(expect.arrayContaining(['list-buckets', 'get-bucket-lifecycle', 'upload', 'download', 'delete-multiple']))
    expect(storageNames).not.toContain('describe-cloud-storage-config')
    expect([...ciNames]).toEqual(expect.arrayContaining(['ci-service-status', 'create-doc-to-pdf-job', 'create-dataset', 'find-datasets-by-bucket', 'hybrid-search']))
    expect(ci.find(action => action.action === 'create-dataset')?.risk).toBe('write')
    expect(ci.find(action => action.action === 'delete-file-meta-index')?.risk).toBe('destructive')
    expect(storage.find(action => action.action === 'put-bucket-acl')?.risk).toBe('configuration')
    expect([...storageNames, ...ciNames]).not.toEqual(expect.arrayContaining(['ci-request', 'encrypt-env', 'decrypt-env', 'delete-bucket']))
  })

  it('normalizes common initial-capital parameter names without weakening collision or secret checks', () => {
    expect(parseTencentCloudManagementParameters({ Bucket: 'storage-1250000000', Region: 'ap-guangzhou', Prefix: 'test1/', limit: 100 })).toEqual({
      bucket: 'storage-1250000000',
      region: 'ap-guangzhou',
      prefix: 'test1/',
      limit: '100',
    })
    expect(() => parseTencentCloudManagementParameters({ Bucket: 'first', bucket: 'second' })).toThrow('conflicts')
    expect(() => parseTencentCloudManagementParameters({ Secret: 'not-allowed' })).toThrow('prohibited')
    expect(() => parseTencentCloudManagementParameters({ DatasetName: 'not-a-cli-flag' })).toThrow('valid CLI-style')
  })

  it('does not pass configured or explicit bucket scope to account-wide bucket discovery', () => {
    const config = { bucket: 'storage-1250000000', region: 'ap-guangzhou', prefix: 'team/storage/', customDomain: '' }

    expect(applyTencentCloudManagementDefaults('list-buckets', {}, config)).toEqual({})
    expect(applyTencentCloudManagementDefaults('list-buckets', { bucket: 'other-1250000000', region: 'ap-shanghai', appid: '1250000000', limit: '100' }, config)).toEqual({ limit: '100' })
    expect(applyTencentCloudManagementDefaults('list', { prefix: 'reports/' }, config)).toMatchObject({
      bucket: 'storage-1250000000',
      region: 'ap-guangzhou',
      prefix: 'reports/',
      appid: '1250000000',
    })
    expect(applyTencentCloudManagementDefaults('create-bucket', { name: 'new-bucket-1250000000' }, config)).toEqual({
      name: 'new-bucket-1250000000',
      region: 'ap-guangzhou',
    })
    expect(applyTencentCloudManagementDefaults('create-dataset', { 'dataset-name': 'shanghai-dataset', region: 'ap-shanghai' }, config)).toMatchObject({
      bucket: 'storage-1250000000',
      region: 'ap-shanghai',
      appid: '1250000000',
      'dataset-name': 'shanghai-dataset',
    })
  })

  it('redacts credentials and local paths from management tool output', () => {
    expect(sanitizeTencentCloudManagementOutput({
      savedTo: 'C:/Users/example/workspace/file.txt',
      cwd: '/home/example/workspace',
      envFile: '/tmp/.env',
      encFile: '/tmp/.env.enc',
      SecretId: 'must-not-leak',
      nested: { authorization: 'must-not-leak', key: 'reports/a.txt' },
    })).toEqual({
      savedTo: '[redacted]',
      cwd: '[redacted]',
      envFile: '[redacted]',
      encFile: '[redacted]',
      SecretId: '[redacted]',
      nested: { authorization: '[redacted]', key: 'reports/a.txt' },
    })
  })

  it('registers only the two management tools and returns cloud-storage settings without credentials', async () => {
    const registered: Array<{ name: string; description: string; execute(args: unknown, exec: unknown): Promise<unknown> }> = []
    const ctx = {
      tools: {
        register(definition: { name: string; description: string; execute(args: unknown, exec: unknown): Promise<unknown> }) {
          registered.push(definition)
          return () => {}
        },
      },
    } as unknown as Context
    registerTencentCloudManagementTools(ctx, {
      getConfig: () => ({ bucket: 'storage-1250000000', region: 'ap-guangzhou', prefix: 'team/storage/', customDomain: 'https://storage.example.com' }),
      getCredentials: async () => ({ secretId: 'secret-id-must-not-leak', secretKey: 'secret-key-must-not-leak' }),
    })

    expect(registered.map(tool => tool.name)).toEqual(['tencentcloud_cos_storage_manage', 'tencentcloud_cos_ci_manage'])
    expect(registered.map(tool => tool.name)).not.toEqual(expect.arrayContaining(['cos_list_objects', 'cos_upload_from_workspace', 'cos_confirm_delete_objects']))

    const storageTool = registered.find(tool => tool.name === 'tencentcloud_cos_storage_manage')
    expect(storageTool).toBeDefined()
    expect(storageTool?.description).toContain('云存储')
    expect(storageTool?.description).toContain('云盘')
    expect(storageTool?.description).toContain('DefaultCloudStorage')
    const result = await storageTool!.execute(
      { Action: 'help', Parameters: {} },
      {} as never,
    )
    expect(result).toMatchObject({
      DefaultCloudStorage: {
        Configured: true,
        CredentialsConfigured: true,
        Bucket: 'storage-1250000000',
        Region: 'ap-guangzhou',
        Prefix: 'team/storage/',
        CustomDomain: 'https://storage.example.com',
        StorageRootUri: 'cos://storage-1250000000/team/storage/',
      },
    })
    expect(JSON.stringify(result)).not.toContain('secret-id-must-not-leak')
    expect(JSON.stringify(result)).not.toContain('secret-key-must-not-leak')
  })

  it('registers a model and user invocable COS Skill backed by the bundled guidance', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(SkillRegistry)
    registerTencentCloudCosSkill(ctx)

    await expect(ctx.skills.get('tencentcloud-cos')).resolves.toMatchObject({
      name: 'tencentcloud-cos',
      invocation: { modelInvocable: true, userInvocable: true },
      source: 'bundled',
    })
    const skill = await ctx.skills.get('tencentcloud-cos')
    expect(skill?.content).toContain('tencentcloud_cos_storage_manage')
    expect(skill?.content).toContain('tencentcloud_cos_ci_manage')
    expect(skill?.content).toContain('MetaInsight')
    expect(skill?.content).toContain('MetaInsight 的 `region` 是数据集请求的目标地域')
    expect(skill?.content).toContain('数据集名称统一传 `dataset-name`')
    expect(skill?.description).toContain('云存储')
    expect(skill?.description).toContain('云盘')
    expect(skill?.whenToUse).toContain('云存储')
    expect(skill?.whenToUse).toContain('云盘')
    expect(skill?.content).toContain('后续消息中明确同意')
    expect(skill?.content).toContain('Tool 本身不会再显示 DSH 审批卡')
    expect(skill?.content).toContain('必须优先完整阅读并遵循 `references/cloud-storage.md`')
    expect(skill?.content).toContain('“云存储”和历史名称“云盘”指同一个插件场景')
    expect(skill?.content).toContain('对外回复统一优先使用“COS 云存储”或“云存储”')

    const cloudStorageReference = readFileSync(resolve(process.cwd(), 'skills/tencentcloud-cos/references/cloud-storage.md'), 'utf8')
    expect(cloudStorageReference).toContain('用户使用“云存储”或“云盘”时，都按本文档执行')
    expect(cloudStorageReference).toContain('没有指定云存储目标子目录时，目标路径尚未确定，不能开始上传')
    expect(cloudStorageReference).toContain('每次 `upload` 都必须显式传入完整 `key`')
    expect(cloudStorageReference).toContain('保留工作区相对目录结构')
    expect(cloudStorageReference).toContain('`DefaultCloudStorage` 表示当前插件 COS 云存储配置')
  })
})
