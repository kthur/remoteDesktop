---
name: reviewfix
description: Use when the user asks to review their GitHub Pages site via Gemini Web and fix issues found. Fetches the live site URL, requests Gemini Web to audit it, then applies fixes based on the review.
---

# reviewfix

Use this skill when the user wants their deployed GitHub Pages site reviewed and fixed automatically. The workflow:

1. **Identify the live URL** — use the project's GitHub Pages URL (e.g. `https://<user>.github.io/<repo>/`).
2. **Fetch the site** with `webfetch` to get the current live content.
3. **Request Gemini Web review** — use `websearch` with the query:
   ```
   site:gemini.google.com OR "gemini web" review audit accessibility performance SEO issues site:https://<url>
   ```
   If that yields no direct results, fall back to fetching the page and using the content to ask for an audit via the web fetch results.
4. **Analyze review results** — extract actionable bugs, UX issues, performance problems, accessibility violations, or layout breaks from the review.
5. **Fix issues** — modify the relevant source files (`index.html`, `app.js`, `styles.css`, etc.) to address each issue found.
6. **Verify** — after fixing, re-fetch the deployed URL to confirm the site is working.

Always report back what issues were found and what fixes were applied.
