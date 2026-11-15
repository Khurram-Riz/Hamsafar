import { expect, test } from '@playwright/test';

test('complete passenger flow: login, book ride, view trip, create & revoke family share link', async ({
  page,
}) => {
  await page.goto('/login');
  await page.fill('#pk-phone', '+923001234567');
  await page.click('button:has-text("Continue with OTP")');

  await expect(page.locator('#otp-code')).toBeVisible();
  await page.fill('#otp-code', '123456');
  await page.click('button:has-text("Verify & Continue")');

  await page.waitForURL('**/book');
  await page.click('button:has-text("PK-309")');
  await expect(page.locator('text=Pakistan International Airlines')).toBeVisible();
  await page.click('button:has-text("Choose Destination")');

  await page.click('button:has-text("DHA Phase 1-8")');
  await page.click('button:has-text("Set Seats & Pool Type")');

  await page.click('button:has-text("Preview Pool & Fare")');
  await page.click('button:has-text("Confirm & Get Boarding QR")');

  await page.waitForURL('**/trip/**');
  await expect(page.locator('text=HMS-')).toBeVisible();
  await expect(page.locator('text=Sharing this ride')).toBeVisible();

  await page.click('button:has-text("Generate Family Share Link")');
  await expect(page.locator('a:has-text("Open Live Family View")')).toBeVisible();

  await page.click('button:has-text("Revoke Link")');
  await expect(page.locator('button:has-text("Generate Family Share Link")')).toBeVisible();
});
