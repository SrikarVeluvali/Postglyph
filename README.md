# Postglyph

Postglyph adds a category and Jev confidence badge to LinkedIn home-feed posts as you scroll. It is a personal, load-unpacked Chrome extension plus a small local helper. The helper keeps your TypeSafe API key out of the extension.

## Requirements

- Chrome with Manifest V3 extension support
- Node.js 20 or newer
- A TypeSafe API key from [TypeSafe](https://typesafe.ai/)

## Run it

1. Install dependencies and build:

   ```powershell
   npm.cmd install
   npm.cmd run build
   ```

2. In PowerShell, set the key for this terminal and start the helper:

   ```powershell
   $env:TYPESAFE_API_KEY = 'your-typesafe-key'
   npm.cmd run start
   ```

   The helper binds only to `127.0.0.1:43187` and prints a local helper token. Keep this terminal running. The generated token is saved in the ignored `.postglyph/local-token` file so it remains valid after a restart. You may override it with `POSTGLYPH_LOCAL_TOKEN`.

3. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `dist/extension` in this repository.
4. Click the Postglyph toolbar icon, paste the local helper token, and choose **Save token**. Open the LinkedIn home feed. Posts near the viewport will acquire badges automatically.

If Chrome is already on LinkedIn when you install or reload the extension, refresh the feed once. Rebuild and reload the extension after changing source code.

If no badges appear, check the popup status first. “Helper offline” means the Node process is not running; “Token rejected” means the saved popup token differs from the helper’s printed token. After reloading the extension on `chrome://extensions`, also refresh the LinkedIn tab so its content script is current. Load the built `dist/extension` folder, not `public` or the repository root.
The popup also reports how many feed cards and readable posts its content script sees on the active tab. Open the popup while the LinkedIn feed tab is active to use that diagnostic.

## Categories

Postglyph chooses one dominant purpose per post: Hiring, Opportunity, Career update, Advice & learning, News & announcement, Promotion, Conversation, or Other. “Opportunity” includes internships, fellowships, scholarships, career events, deadlines, and broad opening roundups; a specific vacancy is “Hiring.” The percentage is Jev's confidence in the choice among these labels, not a measured probability that the label is correct. A score below 50% is prefixed with “Likely.”

The extension uses readable post text only. It does not transcribe images or video, click “see more,” reorder posts, or retain raw post text. It sends the text of near-viewport posts to TypeSafe through the local helper and caches only the resulting label, scores, model ID, timestamp, and a text hash for seven days. The cache holds at most 500 posts.

LinkedIn changes its markup over time. If badges stop appearing, inspect and update the feed selectors in `src/extension/content.ts` and `src/extension/post.ts`.

## Checks

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run build
```

The tests cover text extraction and the helper contract. A live Jev call requires your own API key and is not part of the automated tests.
