/** The file, not its folder: a tab is read at a glance and the path is not what tells them apart. */
export const scriptName = (script: string): string =>
  script
    .replace(/^script:/, '')
    .split('/')
    .at(-1) ?? script
