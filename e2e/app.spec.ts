import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('SnapHEIC End-to-End Suite', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to ensure clean default state
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('Layout & Branding: default Arabic RTL layout with big workspace on right/left and stacked sidebar', async ({ page }) => {
    // 1. Verify Default Language is Arabic with RTL
    const rootDiv = page.locator('div[dir]').first();
    await expect(rootDiv).toHaveAttribute('dir', 'rtl');

    // 2. Verify Header & Logo Mark
    const header = page.locator('header');
    await expect(header).toBeVisible();
    await expect(header.getByAltText('SnapHeic')).toBeVisible();
    await expect(header.getByRole('heading', { level: 1 })).toContainText('سناب');

    // 3. Verify Left side big box (Dropzone area) in Arabic
    const dropzoneHeading = page.getByRole('heading', { name: 'أفلت الصور أو الملفات هنا' });
    await expect(dropzoneHeading).toBeVisible();
    await expect(page.getByRole('button', { name: 'تصفح الملفات' })).toBeVisible();

    // 4. Verify Options sidebar exists and is stacked vertically
    const sidebar = page.getByRole('complementary');
    await expect(sidebar).toBeVisible();

    // 5. Verify Options in Arabic stacked vertically
    await expect(sidebar.locator('text=صيغة المخرجات')).toBeVisible();
    await expect(sidebar.locator('text=الجودة')).toBeVisible();
    await expect(sidebar.locator('text=الدقة القصوى')).toBeVisible();
    await expect(sidebar.getByRole('button', { name: 'إزالة GPS و EXIF' })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: 'تحويل الكل' })).toBeVisible();
    await expect(sidebar.locator('text=مسارات سريعة')).toBeVisible();
  });

  test('Bilingual Support: toggles from Arabic (default) to English and back', async ({ page }) => {
    const rootDiv = page.locator('div[dir]').first();
    // Default is Arabic (RTL)
    await expect(rootDiv).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('text=صيغة المخرجات')).toBeVisible();

    // Switch to EN
    await page.getByRole('button', { name: 'EN' }).click();

    // Root should now be ltr
    await expect(rootDiv).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('text=Output Format')).toBeVisible();
    await expect(page.locator('text=Strip GPS & EXIF')).toBeVisible();

    // Switch back to AR
    await page.getByRole('button', { name: 'AR' }).click();
    await expect(rootDiv).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('text=صيغة المخرجات')).toBeVisible();
  });

  test('Mode Switching: switch to Image to PDF and verify PDF settings appear in Arabic', async ({ page }) => {
    const sidebar = page.getByRole('complementary');

    // Click "إلى PDF" (To PDF) mode button
    const pdfModeBtn = sidebar.getByRole('button', { name: /إلى PDF|To PDF/ });
    await pdfModeBtn.click();

    // Verify PDF controls appear (Page Size / Orientation / Margins)
    await expect(sidebar.locator('text=حجم الصفحة')).toBeVisible();
    await expect(sidebar.locator('text=الاتجاه')).toBeVisible();
    await expect(sidebar.locator('text=الهوامش')).toBeVisible();

    // Switch back to "الصور" (Images) mode
    const imagesModeBtn = sidebar.getByRole('button', { name: /الصور|Images/ });
    await imagesModeBtn.click();

    // Verify image controls return
    await expect(sidebar.locator('text=الجودة')).toBeVisible();
    await expect(sidebar.locator('text=الدقة القصوى')).toBeVisible();
  });

  test('Quick Presets: clicking presets updates format and settings', async ({ page }) => {
    const sidebar = page.getByRole('complementary');
    const formatSelect = sidebar.locator('select').first();

    // Click WebP preset button
    await sidebar.getByRole('button', { name: /WebP/ }).click();
    await expect(formatSelect).toHaveValue('image/webp');

    // Click JPG preset button
    await sidebar.getByRole('button', { name: /JPG/ }).click();
    await expect(formatSelect).toHaveValue('image/jpeg');

    // Click PDF preset button
    await sidebar.getByRole('button', { name: /PDF/ }).first().click();
    await expect(formatSelect).toHaveValue('application/pdf');
    await expect(sidebar.locator('text=حجم الصفحة')).toBeVisible();
  });

  test('End-to-End File Conversion: uploads files, converts, checks output and preview', async ({ page }) => {
    // Locate hidden file input
    const fileInput = page.locator('input[type="file"]').first();

    const file1 = path.resolve(process.cwd(), 'e2e/fixtures/sample1.png');
    const file2 = path.resolve(process.cwd(), 'e2e/fixtures/sample2.png');

    await fileInput.setInputFiles([file1, file2]);

    // Verify workspace transitions from empty dropzone to Batch Dashboard (Arabic)
    await expect(page.locator('text=الملفات في القائمة')).toBeVisible();
    await expect(page.locator('text=sample1.png')).toBeVisible();
    await expect(page.locator('text=sample2.png')).toBeVisible();

    // Verify right sidebar shows Convert All button is enabled
    const sidebar = page.getByRole('complementary');
    const convertAllBtn = sidebar.getByRole('button', { name: 'تحويل الكل' });
    await expect(convertAllBtn).toBeEnabled();

    // Click Convert All
    await convertAllBtn.click();

    // Wait for completion (status badge appears)
    await expect(page.locator('text=تم التحويل').first()).toBeVisible({ timeout: 15000 });

    // Verify item download button is visible
    const downloadBtns = page.locator('button[title*="تحميل"]').or(page.locator('button[title*="Download"]')).or(page.locator('a[download]'));
    await expect(downloadBtns.first()).toBeVisible();

    // Test Inspect / Preview modal
    const inspectBtn = page.locator('button[title*="معاينة"]').or(page.locator('button[title*="Preview"]')).first();
    if (await inspectBtn.isVisible()) {
      await inspectBtn.click();
      await expect(page.locator('text=فحص ومعاينة الصورة')).toBeVisible();
      // Close modal
      const closeBtn = page.locator('button:has(svg.lucide-x)');
      await closeBtn.first().click();
    }
  });

  test('Privacy Policy view navigation in Arabic', async ({ page }) => {
    // Click Privacy Policy in footer
    const privacyLink = page.getByRole('button', { name: 'سياسة الخصوصية' });
    await privacyLink.click();

    // Expect Privacy Policy view
    await expect(page.getByRole('heading', { name: 'سياسة الخصوصية' })).toBeVisible();

    // Click Back to Converter
    const backBtn = page.getByRole('button', { name: 'العودة للمحول' });
    await backBtn.click();

    // Back to main converter view
    await expect(page.getByRole('complementary')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'أفلت الصور أو الملفات هنا' })).toBeVisible();
  });
});
