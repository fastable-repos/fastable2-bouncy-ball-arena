import { Page } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots')

export async function captureScreenshot(page: Page, name: string): Promise<void> {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
  }
  const filePath = path.join(SCREENSHOTS_DIR, `${name}.png`)
  await page.screenshot({ path: filePath, fullPage: false })
}

export function assertNoConsoleErrors(page: Page): () => void {
  const errors: string[] = []
  const handler = (msg: { type: () => string; text: () => string }) => {
    if (msg.type() === 'error') {
      errors.push(msg.text())
    }
  }
  page.on('console', handler)
  return () => {
    page.off('console', handler)
    if (errors.length > 0) {
      throw new Error(`Console errors detected:\n${errors.join('\n')}`)
    }
  }
}
