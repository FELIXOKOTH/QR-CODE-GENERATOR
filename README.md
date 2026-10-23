# QR Code Studio — Local + Firebase Hosting

A browser-based static QR code generator with:
- QR preview
- Name, subtitle and footer labels
- Foreground/background colour options
- PNG and SVG downloads
- CSV batch generation
- Local browser history with search, JSON export/import
- Print sheets for one or many QR codes
- Local development and optional Firebase Hosting deployment

## Privacy / architecture

QR codes are generated in the browser using the installed `qrcode` JavaScript package. This project does not need a database, sign-in, Firebase Authentication, or Firestore. History is stored in the browser's `localStorage` and is not shared between devices. Export a JSON backup if you need to transfer history.

A static QR code encodes the URL itself. It does not expire because of this app, but the destination URL must remain valid and accessible.

The preview reports the foreground/background contrast ratio and encoded URL
size to help identify designs or links that may be harder to scan. This is a
visual aid, not a guarantee: print size, paper, lighting, camera, and destination
availability also matter. Always test a printed code with a phone before
distributing it. URL format validation does not check that the destination is
online or that visitors have permission to use it.

## Open source

QR Code Studio is owned and maintained by BRIGHT_ARM Enterprise and is
released under the [MIT License](./LICENSE). Contributions can
preserve the local-first core while adding optional integrations that do not
make accounts, tracking, or a hosted backend mandatory.

## Requirements

- Node.js 20+ recommended (install from https://nodejs.org/)
- Visual Studio Code
- For online hosting only: Firebase CLI and a Firebase project

## Run locally in VS Code

### Use the prebuilt app at localhost:5173 (no Node.js or project packages)

The `dist` folder contains a ready-to-run build of the app. To use it without
installing Node.js or the app's npm packages, use Python's built-in web server
(Python is already available on your PC):

1. Open the `qr-code-studio` folder in VS Code.
2. Select **Terminal → Run Task...**.
3. Choose **Run QR Code Studio (prebuilt, no Node.js)**.
4. Open **http://localhost:5173/** in your browser.
5. To stop the server, focus its terminal and press **Ctrl+C**.

Alternatively, in the VS Code terminal run:

```powershell
py -m http.server 5173 --directory dist
```

Keep the `dist` folder together, including its `assets` folder. The app runs in
your browser; QR generation and saved history stay on that device. You do not
need to run `npm install` or `npm run dev` to use the prebuilt app.

### Develop or rebuild the app

1. Extract the ZIP and open the `qr-code-studio` folder in VS Code.
2. Open **Terminal → New Terminal**.
3. Install packages:

   ```bash
   npm install
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open the local address printed in the terminal (usually `http://localhost:5173`).

The first `npm install` needs internet access. After dependencies are installed, QR generation itself happens in the browser and does not send URLs to a server. The development server is only needed to serve the app files.

To make a production build:

```bash
npm run build
npm run preview
```

The production-ready files are created in `dist/`.

## Create QR codes

- Open **Create QR code**.
- Enter a descriptive name and full `https://` or `http://` URL.
- Add optional subtitle and footer text.
- Choose QR foreground/background colours. Keep strong contrast for reliable scanning.
- Review the preview's contrast and URL-size guidance, then test the printed code with a phone.
- Click **Generate QR code**.
- Download PNG for ordinary documents or SVG for high-quality scalable printing.
- Click **Save** to store it in this browser's local history.
- Click **Create print sheet** for an A4 print dialog.

## Batch generation

1. Select **Batch generator**.
2. Download the CSV template or create a CSV with these headers:

   ```csv
   name,url,subtitle,footer
   HQ Incident Report,https://example.com/incident,Report incidents and near misses,SAFETY IN ACTION
   Warehouse Safety,https://example.com/warehouse,Warehouse reporting,
   ```

3. Import the CSV, check which URLs are valid, then choose **Generate all**.
4. Download each result's PNG using its PNG button, or choose **Print all**.

Batch import is local. It does not upload your CSV. Each QR code is generated in the browser.

## History and backups

- **Save** stores a record in this browser's local storage.
- Search and open previous records from **Saved library**.
- **Export JSON** backs up history.
- **Import JSON** restores records on this browser.
- **Clear history** permanently removes the local saved list after confirmation.

Browser history may be lost if site data is cleared, private browsing is used, or a different browser/device is used. Export JSON for a backup. There is no cloud-shared history in this version.

## Keep the app online with GitHub Pages

GitHub Pages hosts the built static app at a public HTTPS URL, so visitors can
use it while your computer is off. GitHub builds and publishes the app using
the included workflow; Node.js and npm are installed on GitHub's build runner,
not on your PC.

1. Create a GitHub repository and upload/push the contents of this project
   folder to its `main` branch. Include the `.github/workflows/deploy-pages.yml`
   workflow file.
2. In the repository on GitHub, open **Settings → Pages** and set **Build and
   deployment → Source** to **GitHub Actions**.
3. Open the **Actions** tab and wait for **Deploy to GitHub Pages** to finish.
   GitHub displays the public site URL in the completed deployment.

The workflow runs again whenever you push changes to `main`. If your repository
uses a different default branch, update the branch name in
`.github/workflows/deploy-pages.yml`.

Each visitor's saved QR history remains private to their own browser on their
own device. Publishing the app does not make visitors' saved records visible
to you or to other visitors. A local address such as `http://localhost:5173`
is only for a server running on your computer; share the GitHub Pages HTTPS URL
instead.

## Deploy online using Firebase Hosting

This project uses static hosting only. No database is required.

1. Create a Firebase project at https://console.firebase.google.com/.
2. Install Node.js, then install the Firebase CLI:

   ```bash
   npm install -g firebase-tools
   ```

3. Sign in:

   ```bash
   firebase login
   ```

4. Build the web app:

   ```bash
   npm install
   npm run build
   ```

5. Initialise Hosting in this folder:

   ```bash
   firebase init hosting
   ```

   Select your Firebase project. When asked for the public directory, enter `dist`. Configure as a single-page app: **No** is fine for this simple single-page app because Vite serves `index.html` at the root; if asked to overwrite `dist/index.html`, answer **No** after building.

   The included `firebase.json` already configures the `dist` directory. You may use it directly and ensure the correct Firebase project is selected.

6. Deploy:

   ```bash
   firebase deploy --only hosting
   ```

Firebase prints your hosted URL after deployment. Rebuild and redeploy after app code changes:

```bash
npm run build
firebase deploy --only hosting
```

**Do not put private keys or secrets in this static app.** Firebase Hosting makes the app public to anyone with the URL. Since there is no authentication, don't use it to store confidential URL lists or private history.

## Notes / current scope

- History is device/browser-specific, not shared cloud storage.
- This version downloads batch PNG files individually and prints all generated codes. If you need one-click ZIP export for large batches, that can be added using a ZIP package.
- A successful URL validation only checks URL format, not whether the destination accepts responses. Test each QR code on a phone before printing or distributing.
- For QR codes that include a logo, avoid covering the central modules and test the printed result.
