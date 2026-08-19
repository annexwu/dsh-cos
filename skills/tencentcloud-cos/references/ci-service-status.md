# 数据万象服务开通状态查询

## 适用场景

用户询问某个存储桶是否已绑定数据万象，或文档处理、媒体处理、智能语音、文件处理、图片处理（异步）、AI 内容识别（异步）等能力是否已开通时，按本文流程查询。同步图片处理和同步内容识别在 CI 绑定后默认可用，不要用“调用一次处理接口是否成功”代替开通状态查询。

## 查询顺序

总共涉及 7 个查询接口：1 个 CI 总开关、4 个数据处理子项、1 个图片处理（异步）子项、1 个 AI 内容识别（异步）子项。

### 1. CI 总开关（必查）

| Action | 请求 | 响应字段 |
| --- | --- | --- |
| `ci:DescribeCIBuckets` | `GET /`，Host 为 `<bucket>.ci.<region>.myqcloud.com` | `CIStatus`: `on` / `off` / `unbinding` |

状态映射：

- `CIStatus=on`：已绑定，同步图片处理与同步内容识别默认可用，并继续查询数据处理、图片处理（异步）和 AI 内容识别（异步）子项。
- `CIStatus=off`：未绑定，所有子项均视为未开启，不继续请求。
- `CIStatus=unbinding`：正在解绑，所有子项均视为未开启，不继续请求。
- `AccessDenied`：映射为 `noAuth`，跳过四个数据处理查询，但仍独立查询图片处理（异步）和 AI 内容识别（异步）。
- `NoSuchBucket` / `UserNotBucketOwner`：映射为 `off`。
- 其他错误：对齐控制台逻辑，CI 状态按 `on` 继续查询，同时保留原始错误，不能把错误静默当成确定已开通。

### 2. 数据处理子项

仅当 CI 总开关为 `on` 时查询。CI 状态为 `noAuth` 时，这四项返回 `noAuth`，不发请求。

| 功能 | Action | HTTP 路径 | 列表字段 | 开启判定 |
| --- | --- | --- | --- | --- |
| 文档处理 | `ci:DescribeDocProcessBucket` | `GET https://ci.<region>.myqcloud.com/docbucket` | `DocBucketList` | `DocBucketList?.[0]?.BucketId === bucket` |
| 媒体处理 | `ci:DescribeMediaBuckets` | `GET https://ci.<region>.myqcloud.com/mediabucket` | `MediaBucketList` | `MediaBucketList?.[0]?.BucketId === bucket` |
| 智能语音 | `ci:DescribeAsrBuckets` | `GET https://ci.<region>.myqcloud.com/asrbucket` | `AsrBucketList` | `AsrBucketList?.[0]?.BucketId === bucket` |
| 文件处理 | `ci:DescribeFileProcessBucket` | `GET https://ci.<region>.myqcloud.com/file_bucket` | `FileBucketList` | `FileBucketList?.[0]?.BucketId === bucket` |

请求使用 `bucketNames=<bucket>&pageNumber=1&pageSize=1` 精确过滤。列表首项不匹配或列表为空时为 `disabled`；`AccessDenied` 为 `noAuth`；其他失败为 `error`。

### 3. 图片处理

同步图片处理只要 CI 状态为 `on` 就默认可用，不需要单独开通。综合状态字段 `imageProcessing`：CI 为 `on` 时返回 `true`，为 `off` / `unbinding` 时返回 `false`，为 `noAuth` 时返回 `null`，表示无法确认绑定状态。

图片处理异步服务需要单独开通：

| Action | 请求 | 列表字段 | 开启判定 |
| --- | --- | --- | --- |
| `ci:DescribePicProcessBucket` | `GET https://ci.<region>.myqcloud.com/picbucket` | `PicBucketList` | 存在 `BucketId === bucket` 的列表项 |

综合状态查询使用 `bucketNames=<bucket>&pageNumber=1&pageSize=1` 精确过滤。目标桶存在时 `asyncImageProcessing.status=enabled`，不存在时为 `disabled`；`AccessDenied` 为 `noAuth`；其他失败为 `error`。

### 4. 内容识别

同步内容识别只要 CI 状态为 `on` 就默认可用，不需要单独开通。综合状态字段 `contentRecognition`：CI 为 `on` 时返回 `true`，为 `off` / `unbinding` 时返回 `false`，为 `noAuth` 时返回 `null`，表示无法确认绑定状态。

AI 内容识别异步服务需要单独开通：

| Action | 请求 | 列表字段 | 开启判定 |
| --- | --- | --- | --- |
| `ci:DescribeAiProcessBucket` | `GET https://ci.<region>.myqcloud.com/ai_bucket` | `AiBucketList` | 存在 `BucketId === bucket` 的列表项 |

综合状态查询使用 `bucketNames=<bucket>&pageNumber=1&pageSize=1` 精确过滤。正常响应且目标桶存在时 `asyncContentRecognition.status=enabled`，不存在时为 `disabled`；`AccessDenied` 为 `noAuth`；其他失败为 `error`。该接口具有独立 CAM Action，因此 CI 总开关返回 `noAuth` 时仍执行查询。

## 服务开通与关闭接口

以下接口均已通过临时空桶完成真实的开通、状态查询、关闭和清理测试。

| 服务 | 开通请求 | 开通 Action | 关闭请求 | 关闭 Action |
| --- | --- | --- | --- | --- |
| 数据万象绑定 | `PUT /` | `ci:CreateCIBucket` | `PUT /?unbind` | `ci:DeleteCIBucket` |
| 文档处理 | `POST /docbucket` | `ci:CreateDocProcessBucket` | `DELETE /docbucket` | `ci:DeleteDocProcessBucket` |
| 媒体处理 | `POST /mediabucket` | `ci:CreateMediaBucket` | `DELETE /mediabucket` | `ci:DeleteMediaBucket` |
| 智能语音 | `POST /asrbucket` | `ci:CreateAsrBucket` | `DELETE /asrbucket` | `ci:DeleteAsrBucket` |
| 文件处理 | `POST /file_bucket` | `ci:CreateFileProcessBucket` | `DELETE /file_bucket` | `ci:DeleteFileProcessBucket` |
| 图片处理（异步） | `POST /picbucket` | `ci:CreatePicProcessBucket` | `DELETE /picbucket` | `ci:DeletePicProcessBucket` |
| AI 内容识别（异步） | `POST /ai_bucket` | `ci:CreateAiProcessBucket` | `DELETE /ai_bucket` | `ci:DeleteAiProcessBucket` |

请求域名为 `https://<bucket>.ci.<region>.myqcloud.com`。开通四类处理服务时，如果存储桶尚未绑定 CI，服务端也可自动完成绑定；推荐先明确执行 `create-ci-bucket`，便于分步确认状态。

CI 解绑前必须先清理工作流、批量任务、自动审核、历史审核及已开通处理服务等配置。`CIStatus=unbinding` 表示异步解绑仍在进行，不应立即当成 `off`。

## CLI

```bash
# 查询 CI 总开关、四项数据处理、同步默认能力、异步图片处理和异步内容识别状态
node {baseDir}/scripts/ci_api.mjs ci-service-status \
  --bucket <bucket-appid> \
  --region <region>

# CI 绑定 / 解绑
node {baseDir}/scripts/cos_node.mjs create-ci-bucket --bucket <bucket-appid> --region <region>
node {baseDir}/scripts/cos_node.mjs delete-ci-bucket --bucket <bucket-appid> --region <region>

# 文档处理开通 / 关闭
node {baseDir}/scripts/cos_node.mjs create-doc-process-bucket --bucket <bucket-appid> --region <region>
node {baseDir}/scripts/cos_node.mjs delete-doc-process-bucket --bucket <bucket-appid> --region <region>

# 媒体处理开通 / 关闭
node {baseDir}/scripts/cos_node.mjs create-media-bucket --bucket <bucket-appid> --region <region>
node {baseDir}/scripts/cos_node.mjs delete-media-bucket --bucket <bucket-appid> --region <region>

# 智能语音开通 / 关闭
node {baseDir}/scripts/cos_node.mjs create-asr-bucket --bucket <bucket-appid> --region <region>
node {baseDir}/scripts/cos_node.mjs delete-asr-bucket --bucket <bucket-appid> --region <region>

# 文件处理开通 / 关闭
node {baseDir}/scripts/cos_node.mjs create-file-process-bucket --bucket <bucket-appid> --region <region>
node {baseDir}/scripts/cos_node.mjs delete-file-process-bucket --bucket <bucket-appid> --region <region>

# 查询已开通图片处理异步服务的存储桶
node {baseDir}/scripts/cos_node.mjs describe-async-image-process-buckets \
  --bucket <bucket-appid> \
  --region <region>

# 开通图片处理异步服务并创建队列
node {baseDir}/scripts/cos_node.mjs create-async-image-process-bucket \
  --bucket <bucket-appid> \
  --region <region>

# 关闭图片处理异步服务并删除队列；严格模式下隐藏并拒绝执行
node {baseDir}/scripts/cos_node.mjs delete-async-image-process-bucket \
  --bucket <bucket-appid> \
  --region <region>

# 查询已开通 AI 内容识别异步服务的存储桶
node {baseDir}/scripts/cos_node.mjs describe-ai-process-buckets \
  --bucket <bucket-appid> \
  --region <region>

# 开通 AI 内容识别异步服务并创建队列
node {baseDir}/scripts/cos_node.mjs create-ai-process-bucket \
  --bucket <bucket-appid> \
  --region <region>

# 关闭 AI 内容识别异步服务并删除队列；严格模式下隐藏并拒绝执行
node {baseDir}/scripts/cos_node.mjs delete-ai-process-bucket \
  --bucket <bucket-appid> \
  --region <region>
```

图片处理异步服务的开通接口使用 `POST https://<bucket>.ci.<region>.myqcloud.com/picbucket`，CAM Action 为 `ci:CreatePicProcessBucket`；关闭接口使用相同路径的 `DELETE` 方法，CAM Action 为 `ci:DeletePicProcessBucket`。

AI 内容识别异步服务的开通接口使用 `POST https://<bucket>.ci.<region>.myqcloud.com/ai_bucket`，CAM Action 为 `ci:CreateAiProcessBucket`；关闭接口使用相同路径的 `DELETE` 方法，CAM Action 为 `ci:DeleteAiProcessBucket`。

## 输出原则

- 始终分别展示 `ciBucketStatus` 和 `dataProcessing`，不要只返回一个总布尔值。
- `imageProcessing` 表示同步图片处理是否默认可用；`asyncImageProcessing` 表示异步服务是否单独开通，禁止混用。
- `imageProcessing` 和 `contentRecognition` 表示同步能力：CI 已绑定时为 `true`，未绑定时为 `false`，无权限确认时为 `null`。
- `asyncImageProcessing` 和 `asyncContentRecognition` 返回带 `status`、`action`、`request` 或 `error` 的异步服务状态对象。
- `noAuth`、`error` 与 `disabled` 含义不同，禁止互相替代。
- 保留请求的 `requestId` 和错误码，排障时不要输出 Authorization、SecretKey 或 Token。
- 综合状态和独立查询完全只读，严格模式可用；所有关闭与解绑命令都属于删除语义，严格模式隐藏并禁止执行。
