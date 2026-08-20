const CI_DOCUMENT_EXTENSIONS = new Set([
  'csv', 'doc', 'docm', 'docx', 'dot', 'dotm', 'dotx', 'dps', 'dpt', 'et', 'ett', 'pdf', 'pot', 'potm', 'potx',
  'pps', 'ppsm', 'ppsx', 'ppt', 'pptm', 'pptx', 'rtf', 'txt', 'wps', 'wpt', 'xls', 'xlsb', 'xlsm', 'xlsx', 'xlt',
  'xltm', 'xltx',
])

export function isCiDocumentPreviewExtension(extension: string): boolean {
  return CI_DOCUMENT_EXTENSIONS.has(extension.toLowerCase())
}
