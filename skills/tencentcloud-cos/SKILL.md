# 腾讯云 COS 全功能管理

当用户希望操作插件 COS 云存储（兼容历史名称“云盘”），或查询、管理腾讯云 COS、数据万象（CI）、MetaInsight 资源时，使用本 Skill。

## 执行入口

只使用下列两个 Tool，绝不运行命令行、Shell、`node scripts/*.mjs`，也不索取或传入 SecretId、SecretKey、Token、Cookie、Authorization。

| 场景 | Tool |
| --- | --- |
| Bucket、对象、Bucket 配置、对象版本、ACL、CORS、标签、生命周期、签名链接、工作区文件上传下载 | `tencentcloud_cos_storage_manage` |
| 数据万象服务、图片、文档、媒体、审核、语音、文件处理、MetaInsight 数据集/绑定/索引/检索 | `tencentcloud_cos_ci_manage` |

两个 Tool 都接受：

```text
Action: 原 Skill 的 kebab-case Action 名
Parameters: 原 CLI flag 去掉 -- 后的 JSON 对象
```

例如列出全部可访问 Bucket：

```json
{ "Action": "list-buckets", "Parameters": {} }
```

例如查询 Bucket 下对象：

```json
{
  "Action": "list",
  "Parameters": {
    "bucket": "example-1250000000",
    "region": "ap-guangzhou",
    "prefix": "images/",
    "limit": 100
  }
}
```

参数名称必须使用原 CLI 的全小写 kebab-case 名称，例如 `bucket`、`region`、`prefix`、`dataset-name`、`maxresults`、`match-threshold`；不能写成 `Bucket`、`Region` 或 `DatasetName`。对象或数组参数可以直接传 JSON 值，Tool 会安全序列化。不要手动添加 `--`，不要手动拼签名、密钥或请求头。

当本 Skill 未涵盖某个精确 Action 或参数时，先调用对应 Tool 的 `Action: "help"`；只使用返回 allowlist 中的 Action。

## 凭证与资源范围

- Tool 自动读取插件设置中已配置的 COS 凭证；密钥不会进入上下文、Tool 参数或结果。
- 云存储页面的默认 Bucket/Region 只作为缺省值。账号级管理操作应优先明确传入 `bucket` 和 `region`。
- `list-buckets` 可发现当前凭证实际可访问的 Bucket。后续访问范围由 CAM 决定，不臆造 Bucket、Region、AppId 或数据集。
- Bucket 名通常是 `<name>-<appid>`。如果 Bucket 已明确，Tool 会自动推导 `appid`；账号级数据集操作没有 Bucket 时必须显式给 `appid`。
- MetaInsight 属于 COS CI / 数据万象能力，因此统一走 `tencentcloud_cos_ci_manage`。MetaInsight 的 `region` 是数据集请求的目标地域：显式参数优先，未传时才使用插件设置的默认 Region；不得自行改成其他地域或静默探测。

## 场景路由：插件 COS 云存储

“云存储”和历史名称“云盘”指同一个插件场景。出现以下任一情况时，必须优先完整阅读并遵循 `references/cloud-storage.md`，再选择 Action 和参数：

- 用户明确提到“云存储”“当前云存储”“我的云存储”“云存储里的文件或目录”；
- 用户使用历史名称“云盘”“当前云盘”“我的云盘”“云盘里的文件或目录”；
- 用户要求“同步产物”“上传生成结果”“备份工作区”到云存储或云盘；
- 上文已经通过任一名称确定操作对象是插件 COS 云存储，本轮通过“这些产物”“上传一下”“下载它”等指代继续操作，即使本轮没有再次出现名称。

云存储语境优先于账号级通用 COS 语境。对外回复统一优先使用“COS 云存储”或“云存储”；只有解释兼容关系或引用用户原话时才使用“云盘”。不要直接按普通 COS 对象操作自行决定路径，也不要寻找或调用其他所谓的云存储专用 Tool 或 Action。执行仍使用 `tencentcloud_cos_storage_manage`。

## 正确工作流

1. 先发现，再变更：先查询现状、服务开通状态、Bucket 区域和数据集/绑定关系。
2. 只读请求可直接执行。
3. 写入、配置变更、服务开通、处理任务、数据集或索引创建前，先用自然语言说明将执行的精确操作、目标 Bucket/对象或资源、影响范围和可能费用，并询问用户是否继续。用户在后续消息中明确同意后才能调用写操作 Tool；初始的“帮我上传/创建/修改”等请求不是这一步的确认。
4. 删除、解绑或关闭服务只操作精确的用户指定目标；先列出目标范围、影响和不可恢复性，等待用户在后续消息明确确认后再调用 Tool。Tool 本身不会再显示 DSH 审批卡。
5. 用户已在本轮对话的紧邻上一条消息明确确认同一份操作计划时，无需重复追问；计划、目标或影响范围变化时必须重新确认。
6. 异步 CI 作业创建后，用对应 `describe-*-job` Action 轮询，不要假定成功。
7. 输出仅报告必要结果、RequestId、任务 ID、对象 Key、Bucket/Region 和错误摘要；不得输出凭证、签名 Authorization 或本机绝对路径。

## COS 存储常用 Action

| 目标 | Action | 常见参数 |
| --- | --- | --- |
| 列举账号 Bucket | `list-buckets` | 无 |
| 检查 Bucket | `head-bucket` | `bucket`, `region` |
| 列对象 | `list` | `bucket`, `region`, `prefix`, `limit`, `marker` |
| 查对象元数据 | `head` | `bucket`, `region`, `key` |
| 生成临时链接 | `sign-url` | `bucket`, `region`, `key`, `expires`, `method` |
| 下载到当前工作区 | `download` | `bucket`, `region`, `key`, `output` |
| 上传当前工作区文件 | `upload` | `bucket`, `region`, `file`, `key` |
| 写入文本对象 | `put-string` | `bucket`, `region`, `key`, `content` |
| 服务端复制对象 | `copy-object` | `bucket`, `region`, `source`, `key` |
| 对象版本 | `list-object-versions` | `bucket`, `region`, `prefix` |
| 对象 ACL / 标签 / 保留 | `get-object-acl` / `get-object-tagging` / `get-object-retention` | `bucket`, `region`, `key` |
| Bucket ACL / CORS / 标签 | `get-bucket-acl` / `get-bucket-cors` / `get-bucket-tagging` | `bucket`, `region` |
| 修改 Bucket ACL / CORS / 标签 | `put-bucket-acl` / `put-bucket-cors` / `put-bucket-tagging` | 先读取，再传明确目标参数 |
| 查 Bucket 治理配置 | `get-bucket-lifecycle`、`get-bucket-policy`、`get-bucket-versioning`、`get-bucket-encryption`、`get-bucket-inventory` 等 | `bucket`, `region` |
| 删除一个或多个对象 | `delete` / `delete-multiple` | `bucket`, `region`, `key` 或 `keys` |

`upload.file` 与 `download.output` 只能是当前 Agent 工作区中的相对路径，不能是本机绝对路径、`..` 或符号链接路径。下载默认不覆盖已有文件。

## CI 与 MetaInsight 常用 Action

### 服务与处理

- 服务状态：`ci-service-status`
- 图片理解/EXIF：`image-analysis`、`image-exif`
- 图片基础和 AI 处理：`image-info`、`image-thumbnail`、`image-crop`、`image-rotate`、`image-format`、`watermark-font`、`assess-quality`、`ai-super-resolution`、`ai-pic-matting`、`ai-qrcode`
- 文档：`create-doc-process-bucket`、`create-doc-to-pdf-job`、`describe-doc-job`、`doc-preview`、`doc-preview-html-url`
- 媒体：`create-media-bucket`、`create-media-smart-cover-job`、`media-transcode-job`、`describe-media-job`、`media-snapshot`、`media-info`
- 审核：`audit-image`、`audit-*-job`、`describe-audit-job`
- 语音：`create-asr-bucket`、`speech-recognition-job`、`tts-job`、`noise-reduction-job`、`voice-separate-job`
- 文件处理：`create-file-process-bucket`、`file-hash`、`file-compress-job`、`file-uncompress-job`、`describe-file-job`

首次使用某项 CI 能力时，先查询服务状态或相应 Bucket 绑定状态。创建或开通服务必须经用户批准；关闭服务走对应 `delete-*-bucket`，属于破坏性操作。

### MetaInsight

MetaInsight 用于 COS 数据集、索引和智能检索，归属于 `tencentcloud_cos_ci_manage`。

所有 MetaInsight Action 均使用同一组范围参数：`region` 显式指定目标地域，未传时使用插件默认 Region；`appid` 显式值优先，未传时从 `bucket` 的 `<name>-<appid>` 后缀推导；数据集名称统一传 `dataset-name`。已有数据集不在插件默认地域时，必须根据用户信息或查询结果显式传入其 `region`，不能依靠工具猜测。

| 目标 | Action |
| --- | --- |
| 发现数据集 | `list-datasets`、`find-datasets-by-bucket` |
| 查看数据集/绑定/索引 | `describe-dataset`、`list-bindings`、`describe-dataset-bindings`、`describe-file-meta-index` |
| 创建数据集/绑定/索引 | `create-dataset`、`create-dataset-binding`、`create-file-meta-index` |
| 图片、文本、人脸、混合检索 | `image-search`、`doc-search`、`video-search`、`face-search`、`face-clip-search`、`image-search-pic`、`image-search-text`、`dataset-simple-query`、`hybrid-search` |
| 删除索引 | `delete-file-meta-index` |

查询 Bucket 对应的数据集时优先用 `find-datasets-by-bucket`，不要自行枚举后猜测绑定关系。

## 禁止事项

- 禁止使用或要求 `ci-request`、`encrypt-env`、`decrypt-env`；这些是原 CLI 的扩展/凭证管理入口，不向 DSH Agent 暴露。
- 禁止执行任意 Shell、任意 Node 脚本或任意 HTTP API 请求来绕过 Tool allowlist。
- 禁止操作本机任意路径；仅 `upload` / `download` 可访问当前工作区内的相对文件。
- 禁止试图管理删除 Bucket 或清空 Bucket；当前运行时不提供此能力。
- 禁止在输出中泄露 SecretId、SecretKey、临时 Token、Cookie、Authorization、签名 URL 中的认证信息。

## 参考资料

- `references/cloud-storage.md`：插件 COS 云存储（兼容历史名称“云盘”）的语境识别、路径映射、产物同步与确认流程；云存储场景优先阅读。
- `references/api_reference.md`：原 Action 与接口说明。
- `references/console-feature-guides.md`：控制台功能流程。
- `references/dataset-catalog.md`、`references/dataset-search.md`：MetaInsight 数据集与检索。
- `references/ci-service-status.md`：CI 服务状态与开通判断。

参考资料仅用于选择已允许的 Action 和参数；实际执行仍只能通过两个 Tool。
