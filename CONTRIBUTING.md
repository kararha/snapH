# Contributing to SnapHeic

First off, thank you for considering contributing to SnapHeic! It's people like you that make the open-source community such an amazing place to learn, inspire, and create.

## How Can I Help?

### Reporting Bugs
- **Check the Issues:** See if the bug has already been reported.
- **Be Detailed:** Include your OS, browser version, and if possible, the size/type of the HEIC file that caused the issue.
- **Steps to Reproduce:** Clearly list the steps to trigger the bug.

### Suggesting Enhancements
- Open a new issue with the tag "enhancement".
- Describe the feature and why it would be useful for the community.

### Pull Requests
1. **Fork the repo** and create your branch from `main`.
2. **Follow the Style Guide:** Check `docs/STYLE_GUIDE.md` to ensure your UI changes match the project's "Technical/Brutalist" aesthetic.
3. **Keep it Local:** Remember the "Zero-Trust" mandate. Never add dependencies that require a backend, track users, or upload data to external servers.
4. **Update Docs:** If you add a new feature, update `docs/DOCUMENTATION.md`.
5. **Issue a PR:** Describe your changes clearly in the PR description.

## Development Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

## Coding Standards
- Use **TypeScript** for all new logic.
- Prefer **Functional Components** and Hooks.
- Use **Tailwind CSS** for styling (avoid custom CSS where possible).
- Be mindful of **Memory Management** (always revoke Object URLs).

## License
By contributing, you agree that your contributions will be licensed under its Apache-2.0 License.
