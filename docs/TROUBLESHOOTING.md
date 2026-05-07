# Troubleshooting & FAQ

Because SnapHeic runs entirely in your browser, its performance is directly tied to your device's hardware and browser limits. Here are solutions to common issues.

---

## 1. The browser tab crashed or reloaded
This usually happens due to **Memory Exhaustion (OOM)**.
- **Cause:** Converting very large files or a large batch of files simultaneously uses significant RAM.
- **Solution:** 
  - Try converting files **one by one** instead of using "Convert All".
  - Refresh the tab to clear the browser's memory before starting a new batch.
  - Close other heavy browser tabs (like YouTube or Google Maps).

## 2. "Conversion Failed" Error
- **Cause:** The file might be corrupted, or it's a specific Apple "ProRAW" format that isn't fully supported by the client-side decoder.
- **Solution:** Ensure the file ends in `.heic` or `.heif`. Try converting a different photo to see if it's a file-specific issue.

## 3. Downloads don't start
- **Cause:** Some browser settings or extensions might block automatic downloads.
- **Solution:** Check your browser's "Downloads" settings or try clicking the individual download button on each file card instead of "Download All".

## 4. Why is there a 50MB limit?
HEIC decoding is a "heavy" operation. A 50MB compressed HEIC file can expand to several hundred megabytes in raw memory during the conversion process. We set this limit to prevent your browser from freezing or crashing.

## 5. It's taking a long time
Conversion happens on your **CPU**. If you are on an older device or a mobile phone, it will naturally take longer than on a modern desktop.

---

### Still having issues?
If you've tried the above and still can't get it to work, please [open an issue](https://github.com/kararha/snapH/issues) on GitHub with details about your device and the file size.
