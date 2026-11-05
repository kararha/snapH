import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('SnapHEIC End-to-End Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Layout & Branding: verify brand identity, 2-column layout (left workspace, right stacked sidebar)', async ({ page }) => {
    // 1. Verify Header & Logo Mark
    const header = page.locator('header');
    await expect(header).toBeVisible();
    await expect(header.getByAltText('SnapHeic')).toBeVisible();
    await expect(header.getByRole('heading', { level: 1 })).toContainText('SNAP');

    // 2. Verify Left side big box (Dropzone area)
    const dropzoneHeading = page.getByRole('heading', { name: 'Drop Photos or Files Here' });
    await expect(dropzoneHeading).toBeVisible();
    await expect(page.getByRole('button', { name: 'BROWSE FILES' })).toBeVisible();

    // 3. Verify Right side sidebar options container exists and is stacked
    const sidebar = page.getByRole('complementary');
    await expect(sidebar).toBeVisible();

    // 4. Verify Options stacked vertically on the right
    await expect(sidebar.locator('text=TOOL WORKFLOW')).toBeVisible();
    await expect(sidebar.locator('text=Output Format')).toBeVisible();
    await expect(sidebar.locator('text=Quality')).toBeVisible();
    await expect(sidebar.locator('text=Max Resolution')).toBeVisible();
    await expect(sidebar.getByRole('button', { name: 'Strip GPS & EXIF' })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: 'Convert All' })).toBeVisible();
    await expect(sidebar.locator('text=QUICK WORKFLOWS')).toBeVisible();
    await expect(sidebar.locator('text=100% In-Browser Engine • Zero Servers')).toBeVisible();
  });

  test('Bilingual Support: toggles between EN and AR (RTL)', async ({ page }) => {
    const rootDiv = page.locator('div[dir]').first();
    await expect(rootDiv).toHaveAttribute('dir', 'ltr');

    // Click AR button
    await page.getByRole('button', { name: 'AR' }).click();

    // Root should now be rtl
    await expect(rootDiv).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('text=صيغة المخرجات')).toBeVisible();
    await expect(page.locator('text=إزالة GPS و EXIF')).toBeVisible();

    // Switch back to EN
    await page.getByRole('button', { name: 'EN' }).click();
    await expect(rootDiv).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('text=Output Format')).toBeVisible();
  });

  test('Mode Switching: switch to Image to PDF and verify PDF settings appear', async ({ page }) => {
    const sidebar = page.getByRole('complementary');

    // Click "To PDF" mode button
    const pdfModeBtn = sidebar.getByRole('button', { name: 'To PDF' });
    await pdfModeBtn.click();

    // Verify PDF controls replace image controls
    await expect(sidebar.locator('text=Page Size')).toBeVisible();
    await expect(sidebar.locator('text=Orientation')).toBeVisible();
    await expect(sidebar.locator('text=Margins')).toBeVisible();

    // Switch back to "Images" mode
    const imagesModeBtn = sidebar.getByRole('button', { name: 'Images' });
    await imagesModeBtn.click();

    // Verify image controls return
    await expect(sidebar.locator('text=Quality')).toBeVisible();
    await expect(sidebar.locator('text=Max Resolution')).toBeVisible();
  });

  test('Quick Presets: clicking presets updates format and settings', async ({ page }) => {
    const sidebar = page.getByRole('complementary');
    const formatSelect = sidebar.locator('select').first();

    // Click WebP preset button
    await sidebar.getByRole('button', { name: /HEIC → WebP/ }).click();
    await expect(formatSelect).toHaveValue('image/webp');

    // Click JPG preset button
    await sidebar.getByRole('button', { name: /HEIC → JPG/ }).click();
    await expect(formatSelect).toHaveValue('image/jpeg');

    // Click Photos to PDF preset button
    await sidebar.getByRole('button', { name: /Photos → Single PDF/ }).click();
    await expect(formatSelect).toHaveValue('application/pdf');
    await expect(sidebar.locator('text=Page Size')).toBeVisible();
  });

  test('End-to-End File Conversion: uploads files, converts, checks output and preview', async ({ page }) => {
    // Locate hidden file input
    const fileInput = page.locator('input[type="file"]').first();

    const file1 = path.resolve(process.cwd(), 'e2e/fixtures/sample1.png');
    const file2 = path.resolve(process.cwd(), 'e2e/fixtures/sample2.png');

    await fileInput.setInputFiles([file1, file2]);

    // Verify workspace transitions from empty dropzone to Batch Dashboard
    await expect(page.locator('text=Files Queued')).toBeVisible();
    await expect(page.locator('text=2 files')).toBeVisible();
    await expect(page.locator('text=sample1.png')).toBeVisible();
    await expect(page.locator('text=sample2.png')).toBeVisible();

    // Verify right sidebar shows Convert All button is enabled
    const sidebar = page.getByRole('complementary');
    const convertAllBtn = sidebar.getByRole('button', { name: 'Convert All' });
    await expect(convertAllBtn).toBeEnabled();

    // Click Convert All
    await convertAllBtn.click();

    // Wait for completion (status badge "CONVERTED" appears)
    await expect(page.locator('text=Converted').first()).toBeVisible({ timeout: 15000 });

    // Verify item download button is visible
    const downloadBtns = page.locator('button[title*="Download"]').or(page.locator('a[download]'));
    await expect(downloadBtns.first()).toBeVisible();

    // Test Inspect / Preview modal
    const inspectBtn = page.locator('button[title*="Preview & Inspect"], button[title*="Inspect"]').first();
    if (await inspectBtn.isVisible()) {
      await inspectBtn.click();
      await expect(page.locator('text=Image Inspection & Audit')).toBeVisible();
      // Close modal
      const closeBtn = page.locator('button:has(svg.lucide-x)');
      await closeBtn.first().click();
    }
  });

  test('Privacy Policy view navigation', async ({ page }) => {
    // Click Privacy Policy in footer
    const privacyLink = page.getByRole('button', { name: 'Privacy Policy' });
    await privacyLink.click();

    // Expect Privacy Policy view
    await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();

    // Click Back to Converter
    const backBtn = page.getByRole('button', { name: 'Back to Converter' });
    await backBtn.click();

    // Back to main converter view
    await expect(page.getByRole('complementary')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Drop Photos or Files Here' })).toBeVisible();
  });
});
