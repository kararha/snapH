# SnapHeic: Technical Documentation

SnapHeic is a "zero-trust" browser-based HEIC to JPEG/PNG converter. This document provides a detailed technical explanation of the codebase, including functions, variables, and architectural decisions, to help developers understand and extend the application.

---

## 1. Architecture Overview

SnapHeic is built as a Single Page Application (SPA) using modern web technologies:
- **React 19**: Manages the UI and the "conversion queue" state.
- **Vite**: Provides a fast development environment and optimized builds.
- **Tailwind CSS v4**: Handles styling with a utility-first approach.
- **Framer Motion**: Powers smooth UI transitions and animations.
- **heic2any**: The core engine that performs HEIC/HEIF decoding and re-encoding entirely in the browser.
- **Lucide React**: Provides the iconography.

---

## 2. Core Types and Interfaces

Defined in `src/App.tsx`, these types ensure type safety across the conversion process.

### `ConversionFormat`
```typescript
type ConversionFormat = 'image/jpeg' | 'image/png';
```
Defines the supported output image formats.

### `ConversionStatus`
```typescript
type ConversionStatus = 'idle' | 'converting' | 'completed' | 'error';
```
Tracks the lifecycle of a file in the queue.

### `ConversionItem`
The main interface representing a file in the conversion queue:
- `id`: A unique string identifier.
- `file`: The original `File` object from the user's device.
- `previewUrl`: A temporary URL (`blob:`) used for internal reference.
- `status`: The current `ConversionStatus`.
- `progress`: A number (0-100) representing conversion progress.
- `resultBlob`: The final converted `Blob` (available after completion).
- `resultUrl`: A temporary URL (`blob:`) for the converted image.
- `error`: A string containing the error message if conversion fails.
- `format`: The target `ConversionFormat`.

---

## 3. Main Component State (`App.tsx`)

The application state is managed using React's `useState` and `useRef` hooks:

- **`lang`**: (`Language`) Current UI language ('en' or 'ar').
- **`view`**: (`View`) Tracks whether the user is on the 'converter' or 'privacy' screen.
- **`items`**: (`ConversionItem[]`) The main queue of files to be converted.
- **`globalFormat`**: (`ConversionFormat`) The target format selected in the header for all new files.
- **`isDragging`**: (`boolean`) Tracks if a user is currently dragging files over the upload zone.
- **`validationError`**: (`string | null`) Stores temporary error messages for invalid file uploads (e.g., too large).
- **`fileInputRef`**: (`useRef<HTMLInputElement>`) A reference to the hidden file input used for the "browse" functionality.

---

## 4. Key Functions

### `addFiles(files: FileList | File[])`
Processes newly selected or dropped files.
- **Filtering**: Filters for files ending in `.heic` or `.heif` and enforces a **50MB size limit** to prevent browser memory exhaustion.
- **Validation**: If files are rejected, it sets `validationError` for 4 seconds.
- **Item Creation**: Generates a unique ID and a temporary Object URL for each valid file, then adds them to the `items` state.

### `onDrop`, `onDragOver`, `onDragLeave`
Event handlers for the drag-and-drop interface. `onDrop` extracts the files from `dataTransfer` and passes them to `addFiles`.

### `removeItem(id: string)`
Removes a specific file from the queue.
- **Cleanup**: Crucially calls `URL.revokeObjectURL()` for both the `previewUrl` and `resultUrl` to free up browser memory.

### `convertItem(id: string)`
The core conversion logic for a single item.
1. Sets the item status to `converting`.
2. Calls `heic2any` with the file blob, target format, and a quality setting (0.9).
3. On success: Creates a result Object URL and updates the item status to `completed`.
4. On failure: Catches the error, sanitizes the message for the UI, and sets the status to `error`.

### `convertAll()`
An asynchronous function that identifies all 'idle' or 'error' items in the queue and runs `convertItem` on each using `Promise.all`.

### `downloadItem(item: ConversionItem)`
Triggers a browser download for a completed conversion.
- **Sanitization**: It cleans the original filename (replacing special characters with underscores) and ensures the correct file extension (`.jpg` or `.png`) is applied.
- **Execution**: Uses a hidden `<a>` tag with the `download` attribute.

### `downloadAll()`
Iterates through all `items` and calls `downloadItem` for every item with a `completed` status.

---

## 5. Components and UI

### `SnapHeicLogo`
A visual component that renders the application logo with a custom CSS/Motion animation (a "shimmer" effect).

### `HowItWorks` (`src/components/HowItWorks.tsx`)
A presentational component that displays the 5-step process of how SnapHeic works. It uses the translation system to show content in the selected language.

### `PrivacyPolicy` (`src/components/PrivacyPolicy.tsx`)
Displays the privacy commitment and technical architecture notes. It explains the "zero-trust" model and provides a "Back" button to return to the converter.

---

## 6. Translation System (`src/translations.ts`)

SnapHeic supports English (EN) and Arabic (AR) natively.

- **Structure**: A `translations` object contains keys for each language.
- **Access**: The `App` component retrieves the current strings using `translations[lang]`.
- **Directionality**: The application dynamically switches between Left-to-Right (LTR) and Right-to-Left (RTL) layouts using the `dir` attribute on the root container based on the selected language.

---

## 7. Technical Considerations & Safety

- **Memory Management**: Since the app creates `blob:` URLs for every file and its result, it must manually manage memory. The app calls `URL.revokeObjectURL()` whenever an item is removed or the queue is cleared.
- **File Size Security**: HEIC decoding is computationally expensive and memory-intensive. The **50MB limit** is a safety measure to prevent the browser tab from crashing on lower-end devices.
- **Filename Sanitization**: When downloading, filenames are sanitized using a Regular Expression (`/[^a-zA-Z0-9_\-\.]/g`) to ensure compatibility across different operating systems and prevent malformed file saves.
- **Zero-Trust Implementation**: No external APIs or backends are used. The `heic2any` library runs entirely in the browser's JavaScript engine (Web Workers are used internally by the library for performance).

---
*Last updated: May 2026*
