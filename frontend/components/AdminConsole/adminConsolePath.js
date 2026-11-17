export const ADMIN_CONSOLE_PATH = '/main/perun-core'

export const adminConsolePath = (...parts) => [ADMIN_CONSOLE_PATH, ...parts.filter(part => part !== undefined && part !== null && part !== '')]
  .map(String).join('/')
