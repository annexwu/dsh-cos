const STORAGE_CLASS_LABELS: Record<string, string> = {
  STANDARD: '标准存储',
  STANDARD_IA: '低频存储',
  ARCHIVE: '归档存储',
  DEEP_ARCHIVE: '深度归档存储',
  INTELLIGENT_TIERING: '智能分层存储',
  MAZ_STANDARD: '多 AZ 标准存储',
  MAZ_STANDARD_IA: '多 AZ 低频存储',
  MAZ_INTELLIGENT_TIERING: '多 AZ 智能分层存储',
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** index
  const digits = index === 0 || value >= 100 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(digits)} ${units[index]}`
}

export function formatDate(value: string | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

export function formatStorageClass(value: string | undefined): string {
  if (!value) return '—'
  return STORAGE_CLASS_LABELS[value] ?? value
}

export function formatDuration(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return '00:00'
  const totalSeconds = Math.floor(milliseconds / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const minuteSecond = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  return hours > 0 ? `${String(hours).padStart(2, '0')}:${minuteSecond}` : minuteSecond
}

export function fileExtension(name: string): string {
  const index = name.lastIndexOf('.')
  if (index <= 0 || index === name.length - 1) return ''
  return name.slice(index + 1).toLowerCase()
}
