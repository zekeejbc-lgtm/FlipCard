# Classroom Virtual Environment 📚

A modern flashcard web app that syncs with Google Sheets via Google Apps Script.

## Features

- 🎴 Beautiful flip card animations
- 📱 PWA-ready, works on mobile
- ☁️ Syncs with Google Sheets
- 💾 Offline support with IndexedDB
- 🎯 Track correct/incorrect answers
- 🔀 Smart shuffle mode

## Deploy to Vercel

### 1. Deploy the Frontend

1. Push this repository to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your GitHub repository
4. Vercel will auto-detect Vite and deploy
5. Your app will be live!

### 2. Set Up Google Sheets Backend

#### Create the Spreadsheet

1. Create a new Google Spreadsheet
2. Create sheets for each deck (e.g., "FL111 exam (1)", "FL111 exam (2)")
3. Format each sheet:
   - **Row 1**: Headers (will be ignored)
   - **Column A**: Question
   - **Column B**: Answer

Example:
| Question | Answer |
|----------|--------|
| What is 2+2? | 4 |
| Capital of France? | Paris |

#### Deploy the Apps Script

1. In your Google Sheet, go to **Extensions → Apps Script**
2. Delete any existing code
3. Copy the entire contents of `backend.gs` and paste it
4. Click **Deploy → New deployment**
5. Select type: **Web app**
6. Configure:
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Click **Deploy**
8. Copy the Web App URL

#### Connect to Your App

1. Open your deployed Classroom Virtual Environment app
2. Click "Manage Data Source" at the bottom
3. Paste your Google Apps Script Web App URL
4. Click "Save & Return"
5. Your decks will sync automatically!

## Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Sheet Format

Each sheet in your Google Spreadsheet becomes a deck:

- **Sheet name** = Deck name (e.g., "FL111 exam (1)")
- **Row 1** = Headers (ignored during parsing)
- **Column A** = Question
- **Column B** = Answer

Add as many sheets as you need - they'll all appear as separate decks!

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Dexie (IndexedDB)
- Google Apps Script

## License

MIT
