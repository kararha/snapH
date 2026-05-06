# SnapHEIC — Convert iPhone Photos Without the Hassle

> *A fast, private, browser-based HEIC/HEIF converter. No uploads. No servers. Just you and your photos.*

![SnapHEIC main interface](./docs/screenshot-main.png)

---

I made SnapHEIC because I got tired of the same frustrating dance every time I transferred photos from my iPhone to my Windows laptop. HEIC files everywhere, nothing opens them, and every "free" online converter wants to upload your private photos to some mystery server in exchange. That felt wrong to me.

So I built my own. It's a simple web app that converts HEIC and HEIF images entirely inside your browser — your photos never leave your machine.

---

## What it does

- **Converts HEIC/HEIF → JPEG or PNG** — the two formats that actually work everywhere
- **Runs 100% locally in your browser** — no backend, no server, no cloud
- **Batch processing** — drag and drop a whole folder worth of photos and convert them all at once
- **Individual controls** — convert or download files one at a time if you prefer
- **English + Arabic** — full bilingual support with proper RTL layout for Arabic users
- **50MB per file limit** — keeps your browser happy and prevents memory issues
- **Auto-cleanup** — object URLs are revoked the moment you're done, so nothing lingers

---

## Screenshots

### Main Converter

![Main converter view](./docs/screenshot-main.png)

The converter lives on a single clean page. You get a "How it works" section up top (because people always wonder what's happening under the hood), then a big drag-and-drop zone below. No clutter, no ads, no popups.

### Arabic / RTL Support

![Arabic version with RTL layout](./docs/screenshot-arabic.png)

Switch to Arabic with one click — the entire UI flips to right-to-left, including the layout, the text, and even the button positions. It's not a half-baked translation; it's a proper localized experience.

### Privacy Policy

![Privacy policy page](./docs/screenshot-privacy.png)

I wrote an honest privacy policy because I think users deserve to know what's happening with their data. (Spoiler: nothing is happening, because nothing leaves your computer.) You can read it in the app's footer.

---

## How to run it yourself

If you want to host SnapHEIC locally or deploy your own copy:

**1. Clone the repo**
```bash
git clone https://github.com/kararha/snapH.git
cd snapH
```

**2. Install dependencies**
```bash
npm install
```

**3. Start the dev server**
```bash
npm run dev
```

Then open **http://localhost:3000** in your browser. That's it.

**To build for production:**
```bash
npm run build
```
The output goes into `dist/` — you can host that folder anywhere (Vercel, Netlify, GitHub Pages, your own server).

---

## Project structure

```
snapheic/
├── src/
│   ├── App.tsx                  # Main app — all the converter logic lives here
│   ├── main.tsx                 # React entry point
│   ├── index.css                # Global styles
│   ├── translations.ts          # English and Arabic strings
│   └── components/
│       ├── HowItWorks.tsx       # The "how it works" checklist panel
│       └── PrivacyPolicy.tsx    # The privacy policy view
├── docs/                        # Screenshots for this README
├── index.html                   # Vite HTML entry point
├── vite.config.ts               # Vite configuration
├── tsconfig.json                # TypeScript config
└── package.json
```

---

## Tech stack

I kept this deliberately simple. No over-engineering.

| Tool | Version | Why |
|---|---|---|
| **React** | 19 | The UI framework. Used the new compiler-era React. |
| **TypeScript** | ~5.8 | Type safety keeps the conversion logic clean. |
| **Vite** | 6 | Fast dev server and build tool. |
| **Tailwind CSS** | v4 | Utility-first styling. The v4 Vite plugin makes it painless. |
| **heic2any** | 0.0.4 | The actual workhorse — pure JS HEIC-to-JPEG/PNG conversion. |
| **Framer Motion** | (via `motion`) | Smooth animations for file list transitions and drag states. |
| **Lucide React** | 0.546 | Clean, consistent icons. |

---



The 90% quality setting for JPEG is a deliberate choice — it's visually indistinguishable from 100% but noticeably smaller in file size.

---

## Privacy

There is no backend. There is no analytics. There is no tracking pixel. There is no database.

When you close the tab, everything is gone. Your photos stayed on your machine the entire time.

---

## License

Apache-2.0 — use it, fork it, improve it. A mention or a star is always appreciated but never required.

---

*Built by [Karar Haider](https://github.com/kararha) · [View on GitHub](https://github.com/kararha/snapH)*
