/** `files` namespace dictionaries. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'files'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'tab.files': '文件',
  'action.open': '文件',
  'crumbs.aria': '路径',
  'list.aria': '工作区文件',
  'list.empty': '此目录为空',
  'list.error': '无法读取此目录',
  'list.truncated': '仅显示前 {count} 项',
  'hidden.show': '显示隐藏文件',
  'open.unavailable': '当前主机无法在桌面打开文件',
} as const

/** English dictionary, key-identical to the Chinese source of truth. */
export const en: Record<FileKey, string> = {
  'tab.files': 'Files',
  'action.open': 'Files',
  'crumbs.aria': 'Path',
  'list.aria': 'Workspace files',
  'list.empty': 'This directory is empty',
  'list.error': 'This directory cannot be read',
  'list.truncated': 'Showing the first {count} entries',
  'hidden.show': 'Show hidden files',
  'open.unavailable': 'This host cannot open files on a desktop',
}

/** Key domain of the `files` namespace (zh is the source of truth). */
export type FileKey = keyof typeof zh
