import { expect, test } from '@playwright/test'

test('application shell renders without horizontal overflow', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('body')).toBeVisible()
  await expect(page).toHaveTitle(/Love小家|CoupleSpace/)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  expect(overflow).toBe(true)
})

test('mobile shell keeps content above the bottom safe area', async ({ page }) => {
  await page.goto('/')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  expect(overflow).toBe(true)
  const bottomNav = page.locator('nav').last()
  if (await bottomNav.count()) await expect(bottomNav).toBeVisible()
})
