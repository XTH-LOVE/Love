import { expect, test } from '@playwright/test'

test('auth card keeps registration reachable on mobile', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('couple-space-first-run-intro', '1')
  })

  await page.goto('/?auth-e2e=1')
  const auth = page.locator('#auth-single-card')
  await expect(auth).toBeVisible()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  expect(overflow).toBe(true)

  const registerLink = page.getByRole('button', { name: '还没有账户？创建一个' })
  await expect(registerLink).toBeVisible()
  await registerLink.click()

  await expect(page.getByRole('heading', { name: '从今天开始记录' })).toBeVisible()
  await expect(page.getByRole('button', { name: '创建账户' })).toBeVisible()
})
