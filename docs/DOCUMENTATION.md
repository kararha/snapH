# SnapHeic: The Internal Guide

If you're reading this, you're probably looking to understand how I actually put this thing together. I wanted to keep this guide detailed but honest—no corporate fluff, just a straight-up explanation of how the app works.

---

## 1. The Core Idea
I built SnapHeic to be a "zero-trust" tool. I don't trust random websites with my photos, and I don't expect you to trust me either. That’s why the whole app is built to run entirely in your browser. There is no server, no database, and no tracking.

## 2. What it actually does
At its heart, it’s a file converter. It takes `.heic` or `.heif` files (the ones iPhones create) and turns them into `.jpg` or `.png` so you can actually use them on Windows or Linux.

- **Local only:** I used `heic2any` to handle the heavy decoding work right in the browser.
- **Batch mode:** I made it so you can grab a bunch of files at once, because converting one by one is a pain.
- **Simple UI:** It’s built to be fast. Drop, convert, download, done.

## 3. The Tech Bits (Why I chose these)

- **React 19:** It’s the latest version, and it handles the complex state of a "conversion queue" really well without getting messy.
- **Vite:** Honestly, because it’s fast. The dev server starts instantly and the builds are tiny.
- **Tailwind CSS v4:** I love being able to style things directly in the code. It makes the UI feel consistent without me having to maintain a separate massive CSS file.
- **Framer Motion:** I added this for the "vibe." It makes the lists and errors feel smooth rather than just popping in and out.
- **heic2any:** This is the engine. It's a bit heavy on memory, but it’s the best way I found to do high-quality HEIC conversion without a backend.

## 4. How the conversion logic works

This is the part that took some thinking to get right:

1. **Getting the files:** I use the standard HTML5 File API. When you drop files, the app catches them as "Blobs."
2. **Safety checks:** I set a 50MB limit per file. Why? Because `heic2any` can be a memory hog. If you try to convert a 200MB file in a browser tab, there's a good chance the browser will just crash.
3. **The Queue:** Every file gets a unique ID and is added to the React state. I create a "local URL" using `URL.createObjectURL` so we can track the file during the session.
4. **The heavy lifting:** When you hit convert, `heic2any` kicks in. It decodes the Apple format and re-encodes it to your choice. This happens in a "promise," so it doesn't block the UI.
5. **The Download:** Once it's done, I create another local URL for the finished image. When you click download, I just trigger a hidden link to save that URL to your computer.
6. **Cleanup:** This is important. Every time you remove an item, I "revoke" those local URLs. If I didn't, the app would keep eating up your RAM until you closed the tab.

## 5. Want to change something?

### Adding a new language
I put all the text in `src/translations.ts`. If you want to add a language:
1. Open that file and copy the `en` block.
2. Translate the strings.
3. Add a button in `App.tsx` header to switch to it. It’s that simple.

### Running it yourself
If you’ve got Node.js installed, it’s just:
1. `npm install` to get the dependencies.
2. `npm run dev` to see it in action.
3. `npm run build` if you want to host it yourself.

## 6. A note on Privacy
I designed this so that if you disconnect your internet after loading the page, the converter will *still work*. That is the ultimate proof that your data isn't going anywhere. 

---
Written by Karar Haider. Feel free to use this, break it, or make it better.
