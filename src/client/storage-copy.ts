import type { CosUploadStatus } from '../protocol.ts'
import { detectLanguage } from './copy.ts'

export interface StorageCopy {
  upload: string
  uploadTitle: string
  selectFiles: string
  selectFolder: string
  dragTitle: string
  dragDescription: string
  selectedObjects: string
  selectedFiles: (count: number) => string
  removeSelection: string
  startUpload: string
  noSelection: string
  conflictPolicy: string
  conflictOverwrite: string
  conflictSkip: string
  conflictRename: string
  uploadSkipped: (count: number) => string
  newFolder: string
  tasks: string
  collapseTasks: string
  expandTasks: string
  folderName: string
  folderPlaceholder: string
  create: string
  creating: string
  cancel: string
  folderCreated: string
  overwriteConfirm: (name: string) => string
  uploadAccepted: (count: number) => string
  tasksTitle: string
  taskCount: (count: number) => string
  clearCompleted: string
  noTasks: string
  noTasksDescription: string
  destination: string
  pauseTask: string
  resumeTask: string
  cancelTask: string
  retryTask: string
  removeTask: string
  speed: string
  elapsed: string
  overallProgress: string
  localFileMissing: string
  taskStatus: Record<CosUploadStatus, string>
  refresh: string
  refreshing: string
  gridView: string
  listView: string
  selectedCount: (count: number) => string
  selectCurrentPage: string
  clearCurrentPageSelection: string
  clearSelection: string
  deleteSelected: string
  deleteSelectedConfirm: (count: number) => string
  allFiles: string
  loading: string
  loadFailed: string
  retry: string
  emptyTitle: string
  emptyDescription: string
  pageSummary: (page: number, count: number) => string
  previousPage: string
  nextPage: string
  details: string
  preview: string
  previewTitle: string
  previewLoading: string
  previewUnsupported: string
  previewTextTooLarge: string
  previewCiUnavailableTitle: string
  previewCiUnavailable: string
  previewFailed: string
  download: string
  startConversation: string
  downloadTitle: string
  downloadDirectory: string
  downloadDirectoryDefault: string
  downloadDirectoryHint: string
  chooseDirectory: string
  downloadBrowserFallback: string
  downloadDirectoryFailed: string
  downloadFailed: string
  downloading: string
  getLink: string
  linkTitle: string
  linkDuration: string
  linkDuration5Minutes: string
  linkDuration30Minutes: string
  linkDuration1Hour: string
  linkDuration1Day: string
  linkDuration7Days: string
  linkDomain: string
  linkDefaultDomain: string
  linkCustomDomain: string
  linkConfirm: string
  linkCreating: string
  linkCreateFailed: string
  linkCopied: (expiresSeconds: number) => string
  delete: string
  deleting: string
  deleteConfirm: (name: string, folder: boolean) => string
  deleted: (count: number) => string
  file: string
  folder: string
  name: string
  type: string
  objectKey: string
  size: string
  modified: string
  storageClass: string
  eTag: string
  close: string
  rootPrefix: string
  confirmTitle: string
  overwrite: string
  previousFile: string
  nextFile: string
}

const copies: Record<'zh' | 'en', StorageCopy> = {
  zh: {
    upload: '上传',
    uploadTitle: '上传',
    selectFiles: '选择文件',
    selectFolder: '选择文件夹',
    dragTitle: '未选择文件/文件夹',
    dragDescription: '支持选择或拖拽多个文件、文件夹，自动使用 COS 分块上传大文件',
    selectedObjects: '待上传对象',
    selectedFiles: count => `${count} 个文件`,
    removeSelection: '移除',
    startUpload: '开始上传',
    noSelection: '请先选择文件或文件夹。',
    conflictPolicy: '文件已存在时',
    conflictOverwrite: '覆盖',
    conflictSkip: '跳过',
    conflictRename: '重命名',
    uploadSkipped: count => `已跳过 ${count} 个已存在文件。`,
    newFolder: '新建文件夹',
    tasks: '传输队列',
    collapseTasks: '收起传输队列',
    expandTasks: '展开传输队列',
    folderName: '文件夹名称',
    folderPlaceholder: '请输入文件夹名称',
    create: '创建',
    creating: '创建中…',
    cancel: '取消',
    folderCreated: '文件夹创建成功。',
    overwriteConfirm: name => `当前目录已存在“${name}”，是否覆盖？`,
    uploadAccepted: count => `已添加 ${count} 个上传任务。`,
    tasksTitle: '传输队列',
    taskCount: count => `${count} 个任务`,
    clearCompleted: '清理已完成',
    noTasks: '暂无传输任务',
    noTasksDescription: '选择文件上传后，可在这里查看进度和结果。',
    destination: '目标目录',
    pauseTask: '暂停',
    resumeTask: '继续',
    cancelTask: '取消',
    retryTask: '重试',
    removeTask: '删除记录',
    speed: '速度',
    elapsed: '耗时',
    overallProgress: '总体进度',
    localFileMissing: '页面刷新后本地文件不可恢复，请重新选择文件上传。',
    taskStatus: {
      queued: '等待上传',
      uploading: '上传中',
      paused: '已暂停',
      completed: '已完成',
      failed: '失败',
      cancelled: '已取消',
    },
    refresh: '刷新',
    refreshing: '刷新中…',
    gridView: '宫格视图',
    listView: '列表视图',
    selectedCount: count => `已选择 ${count} 项`,
    selectCurrentPage: '全选当前页',
    clearCurrentPageSelection: '取消当前页全选',
    clearSelection: '取消选择',
    deleteSelected: '批量删除',
    deleteSelectedConfirm: count => `确定删除已选择的 ${count} 项吗？文件夹将递归删除，此操作不可恢复。`,
    allFiles: '全部文件',
    loading: '正在加载文件…',
    loadFailed: '加载失败',
    retry: '重试',
    emptyTitle: '当前目录为空',
    emptyDescription: '这里还没有文件或文件夹。',
    pageSummary: (page, count) => `第 ${page} 页 · 本页 ${count} 项`,
    previousPage: '上一页',
    nextPage: '下一页',
    details: '属性',
    preview: '预览',
    previewTitle: '文件预览',
    previewLoading: '正在加载预览…',
    previewUnsupported: '此文件类型暂不支持预览，可下载后在本地查看。',
    previewTextTooLarge: '文本文件超过 2 MB，暂不支持在线预览。',
    previewCiUnavailableTitle: '暂无法预览此文档',
    previewCiUnavailable: '请先在 COS 桶的“数据处理 → 文档处理”中开通文档预览服务；开通后重新打开文件即可预览。文件超过 200 MB 或服务暂时不可用时，也会出现此提示。',
    previewFailed: '预览加载失败，请稍后重试。',
    download: '下载',
    startConversation: '发起会话',
    downloadTitle: '下载文件',
    downloadDirectory: '保存位置',
    downloadDirectoryDefault: '浏览器默认下载目录',
    downloadDirectoryHint: '可选择本地目录；文件将直接流式写入该目录，不经过浏览器默认下载栏。',
    chooseDirectory: '选择目录',
    downloadBrowserFallback: '当前浏览器不支持选择下载目录，将使用浏览器默认下载目录。',
    downloadDirectoryFailed: '无法选择本地目录，请检查浏览器权限。',
    downloadFailed: '下载失败，请稍后重试。',
    downloading: '下载中…',
    getLink: '获取临时链接',
    linkTitle: '获取临时链接',
    linkDuration: '有效时长',
    linkDuration5Minutes: '5 分钟',
    linkDuration30Minutes: '30 分钟',
    linkDuration1Hour: '1 小时',
    linkDuration1Day: '1 天',
    linkDuration7Days: '7 天',
    linkDomain: '访问域名',
    linkDefaultDomain: 'COS 默认域名',
    linkCustomDomain: '自定义域名',
    linkConfirm: '复制链接',
    linkCreating: '生成中…',
    linkCreateFailed: '临时链接生成失败，请稍后重试。',
    linkCopied: expiresSeconds => `临时链接已复制，${expiresSeconds >= 86400 ? `${expiresSeconds / 86400} 天` : expiresSeconds >= 3600 ? `${expiresSeconds / 3600} 小时` : `${expiresSeconds / 60} 分钟`}内有效。`,
    delete: '删除',
    deleting: '删除中…',
    deleteConfirm: (name, folder) => folder
      ? `确定递归删除文件夹“${name}”及其中的全部对象吗？此操作不可恢复。`
      : `确定删除文件“${name}”吗？此操作不可恢复。`,
    deleted: count => `删除完成，共删除 ${count} 个对象。`,
    file: '文件',
    folder: '文件夹',
    name: '名称',
    type: '类型',
    objectKey: '对象 Key',
    size: '大小',
    modified: '最后修改时间',
    storageClass: '存储类型',
    eTag: 'ETag',
    close: '关闭',
    rootPrefix: 'COS 云存储根目录',
    confirmTitle: '确认操作',
    overwrite: '覆盖',
    previousFile: '上一个文件',
    nextFile: '下一个文件',
  },
  en: {
    upload: 'Upload',
    uploadTitle: 'Upload',
    selectFiles: 'Select files',
    selectFolder: 'Select folder',
    dragTitle: 'No files or folders selected',
    dragDescription: 'Select or drop multiple files and folders. Large files use COS multipart upload automatically.',
    selectedObjects: 'Selected objects',
    selectedFiles: count => `${count} files`,
    removeSelection: 'Remove',
    startUpload: 'Start upload',
    noSelection: 'Select files or folders first.',
    conflictPolicy: 'When files already exist',
    conflictOverwrite: 'Overwrite',
    conflictSkip: 'Skip',
    conflictRename: 'Rename',
    uploadSkipped: count => `${count} existing files skipped.`,
    newFolder: 'New folder',
    tasks: 'Transfer queue',
    collapseTasks: 'Collapse transfer queue',
    expandTasks: 'Expand transfer queue',
    folderName: 'Folder name',
    folderPlaceholder: 'Enter a folder name',
    create: 'Create',
    creating: 'Creating…',
    cancel: 'Cancel',
    folderCreated: 'Folder created.',
    overwriteConfirm: name => `“${name}” already exists. Overwrite it?`,
    uploadAccepted: count => `${count} upload tasks added.`,
    tasksTitle: 'Transfer queue',
    taskCount: count => `${count} tasks`,
    clearCompleted: 'Clear completed',
    noTasks: 'No transfer tasks',
    noTasksDescription: 'Select files to upload and monitor their progress here.',
    destination: 'Destination',
    pauseTask: 'Pause',
    resumeTask: 'Resume',
    cancelTask: 'Cancel',
    retryTask: 'Retry',
    removeTask: 'Remove',
    speed: 'Speed',
    elapsed: 'Elapsed',
    overallProgress: 'Overall progress',
    localFileMissing: 'The local file is unavailable after a page reload. Select it again to upload.',
    taskStatus: {
      queued: 'Queued',
      uploading: 'Uploading',
      paused: 'Paused',
      completed: 'Completed',
      failed: 'Failed',
      cancelled: 'Cancelled',
    },
    refresh: 'Refresh',
    refreshing: 'Refreshing…',
    gridView: 'Grid view',
    listView: 'List view',
    selectedCount: count => `${count} selected`,
    selectCurrentPage: 'Select current page',
    clearCurrentPageSelection: 'Clear current page selection',
    clearSelection: 'Clear selection',
    deleteSelected: 'Delete selected',
    deleteSelectedConfirm: count => `Delete ${count} selected items? Folders are deleted recursively and this cannot be undone.`,
    allFiles: 'All files',
    loading: 'Loading files…',
    loadFailed: 'Failed to load',
    retry: 'Retry',
    emptyTitle: 'This folder is empty',
    emptyDescription: 'There are no files or folders here yet.',
    pageSummary: (page, count) => `Page ${page} · ${count} items`,
    previousPage: 'Previous',
    nextPage: 'Next',
    details: 'Properties',
    preview: 'Preview',
    previewTitle: 'File preview',
    previewLoading: 'Loading preview…',
    previewUnsupported: 'This file type cannot be previewed. Download it to view locally.',
    previewTextTooLarge: 'Text files larger than 2 MB cannot be previewed online.',
    previewCiUnavailableTitle: 'This document cannot be previewed yet',
    previewCiUnavailable: 'Enable Document Preview under COS Data Processing, then reopen the file. This notice also appears when the file exceeds 200 MB or the service is temporarily unavailable.',
    previewFailed: 'Unable to load preview. Try again later.',
    download: 'Download',
    startConversation: 'Start conversation',
    downloadTitle: 'Download file',
    downloadDirectory: 'Save location',
    downloadDirectoryDefault: 'Browser default downloads directory',
    downloadDirectoryHint: 'Choose a local directory to stream the file directly without using the browser download bar.',
    chooseDirectory: 'Choose directory',
    downloadBrowserFallback: 'This browser cannot choose a download directory. The browser default downloads directory will be used.',
    downloadDirectoryFailed: 'Unable to choose a local directory. Check browser permissions.',
    downloadFailed: 'Download failed. Try again later.',
    downloading: 'Downloading…',
    getLink: 'Get temporary link',
    linkTitle: 'Get temporary link',
    linkDuration: 'Validity',
    linkDuration5Minutes: '5 minutes',
    linkDuration30Minutes: '30 minutes',
    linkDuration1Hour: '1 hour',
    linkDuration1Day: '1 day',
    linkDuration7Days: '7 days',
    linkDomain: 'Access domain',
    linkDefaultDomain: 'Default COS domain',
    linkCustomDomain: 'Custom domain',
    linkConfirm: 'Copy link',
    linkCreating: 'Creating…',
    linkCreateFailed: 'Unable to create the temporary link. Try again later.',
    linkCopied: expiresSeconds => `Temporary link copied. It is valid for ${expiresSeconds >= 86400 ? `${expiresSeconds / 86400} day(s)` : expiresSeconds >= 3600 ? `${expiresSeconds / 3600} hour(s)` : `${expiresSeconds / 60} minute(s)`}.`,
    delete: 'Delete',
    deleting: 'Deleting…',
    deleteConfirm: (name, folder) => folder
      ? `Delete “${name}” and every object inside it? This cannot be undone.`
      : `Delete “${name}”? This cannot be undone.`,
    deleted: count => `${count} objects deleted.`,
    file: 'File',
    folder: 'Folder',
    name: 'Name',
    type: 'Type',
    objectKey: 'Object key',
    size: 'Size',
    modified: 'Last modified',
    storageClass: 'Storage class',
    eTag: 'ETag',
    close: 'Close',
    rootPrefix: 'Storage root',
    confirmTitle: 'Confirm action',
    overwrite: 'Overwrite',
    previousFile: 'Previous file',
    nextFile: 'Next file',
  },
}

export function getStorageCopy(): StorageCopy {
  return copies[detectLanguage()]
}
