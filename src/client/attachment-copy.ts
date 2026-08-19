import { detectLanguage } from './copy.ts'

export interface AttachmentCopy {
  menuLabel: string
  cosStorage: string
  localFile: string
  cosFile: string
  uploadLocalToCos: string
  localUploadTitle: string
  localUploadDescription: string
  localUploadSource: string
  localUploadDestination: string
  localUploadDestinationHint: string
  localUploadDestinationEmpty: string
  localUploadLocation: string
  localUploadNoneSelected: string
  localUploadSelected: (files: number, folders: number) => string
  localUploadConflictMode: string
  localUploadAsk: string
  localUploadOverwrite: string
  localUploadSkip: string
  localUploadConflicts: (count: number) => string
  localUploadStart: string
  localUploadStarting: string
  localUploadFailed: string
  localUploadStarted: (accepted: number, skipped: number) => string
  localFileSelecting: string
  cosPickerTitle: string
  cosPickerDescription: string
  allFiles: string
  name: string
  storageClass: string
  size: string
  modified: string
  selectCurrentPage: string
  clearCurrentPageSelection: string
  back: string
  refresh: string
  newFolder: string
  uploadFiles: string
  folderName: string
  create: string
  uploading: (completed: number, total: number) => string
  loading: string
  empty: string
  select: string
  selected: string
  attach: string
  attaching: string
  cancel: string
  close: string
  previousPage: string
  nextPage: string
  localAttachmentFailed: string
  cosAttachmentFailed: string
  attachmentError: string
  remove: string
  localSource: string
  cosSource: string
  inputReference: (index: number) => string
  folder: string
  files: string
  chooseFilesHint: string
}

const zh: AttachmentCopy = {
  menuLabel: 'COS 云存储文件',
  cosStorage: 'COS 云存储文件',
  localFile: '引用本地文件',
  cosFile: '引用 COS 云存储文件',
  uploadLocalToCos: '上传本地文件到 COS',
  localUploadTitle: '上传本地文件到 COS',
  localUploadDescription: '默认打开当前会话工作区；可切换到其他本机磁盘或目录。',
  localUploadSource: '本地文件',
  localUploadDestination: '上传目标（COS 云存储目录）',
  localUploadDestinationHint: '点击文件夹进入，将选中文件上传到当前目录。',
  localUploadDestinationEmpty: '当前 COS 目录没有子文件夹。',
  localUploadLocation: '切换本机位置',
  localUploadNoneSelected: '未选择文件或文件夹',
  localUploadSelected: (files, folders) => `已选：${files} 个文件，${folders} 个文件夹`,
  localUploadConflictMode: '同名文件',
  localUploadAsk: '询问后覆盖',
  localUploadOverwrite: '直接覆盖',
  localUploadSkip: '跳过已有文件',
  localUploadConflicts: count => `发现 ${count} 个同名文件`,
  localUploadStart: '开始上传',
  localUploadStarting: '创建任务中…',
  localUploadFailed: '本机文件上传失败，请稍后重试。',
  localUploadStarted: (accepted, skipped) => `已创建 ${accepted} 个上传任务${skipped > 0 ? `，跳过 ${skipped} 个已有文件` : ''}。`,
  localFileSelecting: '处理中…',
  cosPickerTitle: '选择 COS 云存储文件',
  cosPickerDescription: '选择文件或文件夹后，将流式缓存到当前会话工作区并作为附件引用。',
  allFiles: 'COS 云存储根路径',
  name: '名称',
  storageClass: '存储类型',
  size: '大小',
  modified: '最后修改时间',
  selectCurrentPage: '全选当前页',
  clearCurrentPageSelection: '取消当前页全选',
  back: '返回上级',
  refresh: '刷新',
  newFolder: '新建文件夹',
  uploadFiles: '上传文件',
  folderName: '文件夹名称',
  create: '创建',
  uploading: (completed, total) => `正在上传 ${completed} / ${total}`,
  loading: '加载中…',
  empty: '当前目录为空',
  select: '选择',
  selected: '已选择',
  attach: '添加引用',
  attaching: '正在缓存…',
  cancel: '取消',
  close: '关闭',
  previousPage: '上一页',
  nextPage: '下一页',
  localAttachmentFailed: '本地文件引用失败，请稍后重试。',
  cosAttachmentFailed: 'COS 云存储文件引用失败，请检查 COS 配置和读取权限。',
  attachmentError: '附件操作失败，请稍后重试。',
  remove: '移除引用',
  localSource: '本地文件',
  cosSource: 'COS 云存储',
  inputReference: index => `附件${index}`,
  folder: '文件夹',
  files: '文件',
  chooseFilesHint: '可选择多个本地文件；文件会保存到当前会话专属目录。',
}

const en: AttachmentCopy = {
  menuLabel: 'COS Storage files',
  cosStorage: 'COS Storage files',
  localFile: 'Reference local files',
  cosFile: 'Reference COS Storage files',
  uploadLocalToCos: 'Upload local files to COS',
  localUploadTitle: 'Upload local files to COS',
  localUploadDescription: 'Starts in the current session workspace. You can switch to another local disk or directory.',
  localUploadSource: 'Local files',
  localUploadDestination: 'Upload destination (COS Storage directory)',
  localUploadDestinationHint: 'Open a folder to use it as the upload destination.',
  localUploadDestinationEmpty: 'This COS directory has no child folders.',
  localUploadLocation: 'Change local location',
  localUploadNoneSelected: 'No files or folders selected',
  localUploadSelected: (files, folders) => `Selected: ${files} file(s), ${folders} folder(s)`,
  localUploadConflictMode: 'Existing files',
  localUploadAsk: 'Ask before overwrite',
  localUploadOverwrite: 'Overwrite',
  localUploadSkip: 'Skip existing',
  localUploadConflicts: count => `${count} existing file(s) found`,
  localUploadStart: 'Start upload',
  localUploadStarting: 'Creating tasks…',
  localUploadFailed: 'Unable to upload local files. Try again later.',
  localUploadStarted: (accepted, skipped) => `${accepted} upload task(s) created${skipped > 0 ? `; ${skipped} existing file(s) skipped` : ''}.`,
  localFileSelecting: 'Working…',
  cosPickerTitle: 'Reference COS Storage files',
  cosPickerDescription: 'Selected files or folders are streamed into the current session workspace and referenced as attachments.',
  allFiles: 'All files',
  name: 'Name',
  storageClass: 'Storage class',
  size: 'Size',
  modified: 'Last modified',
  selectCurrentPage: 'Select current page',
  clearCurrentPageSelection: 'Clear current page selection',
  back: 'Back',
  refresh: 'Refresh',
  newFolder: 'New folder',
  uploadFiles: 'Upload files',
  folderName: 'Folder name',
  create: 'Create',
  uploading: (completed, total) => `Uploading ${completed} / ${total}`,
  loading: 'Loading…',
  empty: 'This folder is empty',
  select: 'Select',
  selected: 'Selected',
  attach: 'Add reference',
  attaching: 'Caching…',
  cancel: 'Cancel',
  close: 'Close',
  previousPage: 'Previous',
  nextPage: 'Next',
  localAttachmentFailed: 'Unable to reference the local file. Try again later.',
  cosAttachmentFailed: 'Unable to reference the COS file. Check COS configuration and read permission.',
  attachmentError: 'Attachment operation failed. Try again later.',
  remove: 'Remove reference',
  localSource: 'Local file',
  cosSource: 'COS Storage',
  inputReference: index => `File ${index}`,
  folder: 'Folder',
  files: 'File',
  chooseFilesHint: 'You can select multiple local files. They are stored in the current session directory.',
}

export function getAttachmentCopy(): AttachmentCopy {
  return detectLanguage() === 'zh' ? zh : en
}
