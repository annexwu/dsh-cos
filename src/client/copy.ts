export type Language = 'zh' | 'en'

export interface Copy {
  title: string
  subtitle: string
  mounted: string
  mountedDescription: string
  back: string
  settingsDescription: string
  createBucket: string
  settingsReadyTitle: string
  secretId: string
  secretIdDescription: string
  secretKey: string
  secretKeyDescription: string
  bucket: string
  bucketDescription: string
  region: string
  regionDescription: string
  prefix: string
  prefixDescription: string
  customDomain: string
  customDomainDescription: string
  required: string
  optional: string
  secretPlaceholder: string
  secretNewPlaceholder: string
  bucketPlaceholder: string
  regionPlaceholder: string
  prefixPlaceholder: string
  domainPlaceholder: string
  connectionConfigured: string
  connectionMissing: string
  credentialsReadOnly: string
  testConnection: string
  testing: string
  save: string
  saving: string
  saved: string
  loadFailed: string
}

const copies: Record<Language, Copy> = {
  zh: {
    title: 'COS 云存储',
    subtitle: '腾讯云对象存储',
    mounted: 'COS 云存储已成功挂载',
    mountedDescription: '配置连接后，这里将展示文件、目录和上传任务。',
    back: '返回会话',
    settingsDescription: '配置腾讯云密钥、存储桶、地域和 COS 云存储根目录。',
    createBucket: '创建存储桶',
    settingsReadyTitle: '连接配置',
    secretId: 'SecretId',
    secretIdDescription: '腾讯云 API 密钥 ID，与 SecretKey 配对使用。密钥只会安全保存到 DSH Host 端。',
    secretKey: 'SecretKey',
    secretKeyDescription: '腾讯云 API 密钥 Key。保存后页面不会读取或回显原文，留空表示保持当前密钥不变。',
    bucket: '存储桶',
    bucketDescription: 'COS 云存储使用的存储桶，名称格式为 BucketName-APPID。',
    region: '地域',
    regionDescription: '存储桶所在地域，必须与创建存储桶时选择的地域一致。',
    prefix: '目录前缀',
    prefixDescription: '将指定目录作为 COS 云存储根目录。留空表示存储桶根目录，保存时会自动补齐末尾的 /。',
    customDomain: '自定义域名',
    customDomainDescription: '推荐配置自定义域名，COS 默认域名不支持文件在线预览。如需预览，请填写已绑定到当前存储桶的自定义域名。留空时使用 COS 默认域名。',
    required: '必填',
    optional: '选填',
    secretPlaceholder: '已安全保存；留空保持不变',
    secretNewPlaceholder: '请输入腾讯云访问密钥',
    bucketPlaceholder: '例如 example-1250000000',
    regionPlaceholder: '例如 ap-guangzhou',
    prefixPlaceholder: '留空表示存储桶根目录',
    domainPlaceholder: '例如 https://static.example.com',
    connectionConfigured: '连接配置已完成。密钥已安全保存在 DSH Host 端，页面不会读取或回显原文。',
    connectionMissing: '尚未完成连接配置，请填写 SecretId、SecretKey、存储桶和地域。',
    credentialsReadOnly: '当前密钥来自只读环境变量，不能在页面中覆盖。',
    testConnection: '测试连接',
    testing: '测试中…',
    save: '保存配置',
    saving: '保存中…',
    saved: '配置已保存。',
    loadFailed: '读取配置失败。',
  },
  en: {
    title: 'COS Storage',
    subtitle: 'Tencent Cloud Object Storage',
    mounted: 'COS Storage is connected',
    mountedDescription: 'Files, folders, and transfer tasks will appear here after connection setup.',
    back: 'Back to chat',
    settingsDescription: 'Configure Tencent Cloud credentials, bucket, region, and storage root.',
    createBucket: 'Create a bucket',
    settingsReadyTitle: 'Connection settings',
    secretId: 'SecretId',
    secretIdDescription: 'Tencent Cloud API key ID, paired with SecretKey. It is stored securely in the DSH Host only.',
    secretKey: 'SecretKey',
    secretKeyDescription: 'Tencent Cloud API key. It is never read back or displayed; leave it blank to keep the stored value.',
    bucket: 'Bucket',
    bucketDescription: 'The bucket used by COS Storage. Its name must use the BucketName-APPID format.',
    region: 'Region',
    regionDescription: 'The region where the bucket was created. It must match the actual bucket region.',
    prefix: 'Directory prefix',
    prefixDescription: 'Use this directory as the storage root. Leave blank for the bucket root; a trailing / is added on save.',
    customDomain: 'Custom domain',
    customDomainDescription: 'A custom domain is recommended because COS default domains do not support online file preview. To preview files, enter a custom domain bound to this bucket. Leave blank to use the default COS domain.',
    required: 'Required',
    optional: 'Optional',
    secretPlaceholder: 'Stored securely; leave blank to keep it',
    secretNewPlaceholder: 'Enter Tencent Cloud access credential',
    bucketPlaceholder: 'For example, example-1250000000',
    regionPlaceholder: 'For example, ap-guangzhou',
    prefixPlaceholder: 'Leave blank for the bucket root',
    domainPlaceholder: 'For example, https://static.example.com',
    connectionConfigured: 'Connection settings are complete. Credentials are stored in the DSH Host and are never read back by this page.',
    connectionMissing: 'Connection settings are incomplete. Enter SecretId, SecretKey, bucket, and region.',
    credentialsReadOnly: 'Credentials come from read-only environment variables and cannot be overwritten here.',
    testConnection: 'Test connection',
    testing: 'Testing…',
    save: 'Save settings',
    saving: 'Saving…',
    saved: 'Settings saved.',
    loadFailed: 'Failed to load settings.',
  },
}

export function detectLanguage(): Language {
  return document.documentElement.lang.toLowerCase().startsWith('zh') || navigator.language.toLowerCase().startsWith('zh')
    ? 'zh'
    : 'en'
}

export function getCopy(): Copy {
  return copies[detectLanguage()]
}
