# DSH COS 云存储插件

腾讯云 COS 云存储的 DeepSeek Harness Web 插件。

## 当前能力

- 作为 bundle 安装到 DSH `web` profile。
- 在设置页配置 `SecretId`、`SecretKey`、存储桶、地域、目录前缀和自定义域名。
- 密钥只保存到 DSH Host 凭据服务，浏览器不读取或回显原文。
- 支持保存普通配置并测试 COS 存储桶连接。
- 在工作区上方显示“COS 云存储”菜单，按目录前缀浏览存储桶内容。
- 支持宫格/列表视图、多选操作，每页最多 100 项，支持 Marker 上一页/下一页。
- 支持面包屑导航、刷新、双击进入目录以及查看文件和文件夹属性。
- 支持在当前目录新建文件夹；上传弹窗可选择或拖拽多个文件、文件夹并保留目录层级。
- 上传任务由 Host 管理，任务抽屉展示总体/单项进度、速度和耗时，支持暂停、继续、取消、失败重试、删除记录和清理已完成。
- 上传采用浏览器 → DSH Host → COS 流式 Multipart Upload，不在内存中缓存完整文件，不设置插件级单文件大小限制；最多同时上传 3 个文件，其余任务自动排队。
- 文件支持下载和获取 15 分钟临时链接；文件夹和文件支持单项或批量不可恢复删除。
- 提供内置 `tencentcloud-cos` Skill，以及两个账号级 Agent Tool：`tencentcloud_cos_storage_manage` 管理 COS Bucket、对象和 Bucket 配置；`tencentcloud_cos_ci_manage` 管理数据万象（CI）和 MetaInsight。
- 账号级 Tool 通过 `Action + Parameters` 调用内置白名单，自动使用 DSH Host 中已配置的 COS 凭证；密钥不会进入 Agent 上下文或 Tool 参数。
- Tool 操作范围由当前凭证的 CAM 权限决定；COS 云存储默认 Bucket/Region 仅是可选缺省值，管理 Tool 可显式访问其他获授权 Bucket。
- Agent 侧只注册上述两个 Tool，不注册场景专用 Tool 或 Action。内置 Skill 会先从现有 `help` 输出的 `DefaultCloudStorage` 读取非敏感配置，再复用通用 COS `list`、`head`、`upload`、`download`、`delete-multiple` 等 Action。
- 写入、配置变更和删除由内置 Skill 在调用前说明目标与影响，并等待用户在后续消息明确同意；Tool 不创建 DSH 审批卡。不提供任意 HTTP 请求、任意 Shell、删除 Bucket 或清空 Bucket 的入口。
- 插件卸载或热更新时清理路由、上传任务、DOM、React Root、样式和监听器。

## 快速开始

### 系统要求

- 已安装 DeepSeek Harness，`dsh web` 可以正常启动。
- COS 存储桶及具有相应 CAM 权限的腾讯云访问密钥。
- 只有从源码构建插件时才需要 Node.js `>=22.19.0` 和 pnpm。

### 从 npm 安装（推荐）

插件已发布到 npm，直接安装到 DSH 的 `web` profile：

```bash
dsh plugin --profile web add dsh-cos
dsh web
```

如果通过 DSH 源码仓库运行命令，将上面的 `dsh` 换成 `pnpm dsh`：

```bash
pnpm dsh plugin --profile web add dsh-cos
pnpm dsh web
```

安装完成后必须重启 `dsh web`，侧边栏才会出现“COS 云存储”入口。

### 配置并使用

1. 打开“设置 > 插件 > 插件配置 > COS 云存储”。
2. 填写 `SecretId`、`SecretKey`、Bucket、Region；按需填写目录前缀和自定义域名。
3. 点击“测试连接”，通过后保存配置。
4. 从侧边栏进入“COS 云存储”，即可浏览、上传、下载、预览和生成临时链接。
5. 在 AI 会话中可以直接说“把这些产物同步到 COS 云存储”或“给刚上传的文件生成临时分享链接”；内置 Skill 会先确认目标和影响，再调用 Agent Tool。

### 验证、更新与卸载

```bash
# 查看 web profile 是否已挂载插件
dsh --profile web --dump-config

# 更新到 npm 最新版本
dsh plugin --profile web update dsh-cos

# 卸载插件
dsh plugin --profile web remove dsh-cos
```

使用 DSH 源码仓库时，同样将每条命令开头的 `dsh` 换成 `pnpm dsh`。更新或卸载后也要重启 `dsh web`。

> 如果新版本刚发布但实际安装成旧版本，请检查 DSH profile 的 `pnpm-workspace.yaml` 是否配置了 `minimumReleaseAge`。可临时设为 `0`，或将 `dsh-cos` 加入 `minimumReleaseAgeExclude`，再执行更新命令。

## 从源码安装（开发调试）

npm 安装是正常使用方式；只有开发或调试插件时才需要链接本地仓库：

```bash
git clone https://github.com/annexwu/dsh-cos.git
cd dsh-cos
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build

# 使用 DSH 源码仓库时，在 DSH 根目录执行：
pnpm dsh plugin --profile web add 'link:<dsh-cos 绝对路径>'
pnpm dsh web
```
