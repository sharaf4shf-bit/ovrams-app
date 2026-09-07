# OVRAMS — Vehicle Request & Approval Management System

## Deploy to Netlify (drag-and-drop, no CLI needed)

1. Unzip `ovrams-app.zip` on your computer.
2. Open a terminal in the unzipped `ovrams-app` folder and run:
   ```
   npm install
   npm run build
   ```
   This creates a `dist` folder — that's your finished website.
3. Go to https://app.netlify.com/drop
4. Drag the `dist` folder onto the page.
5. Netlify gives you a live link immediately (e.g. `random-name-123.netlify.app`).
   You can rename the site in Site settings → Change site name.

## Deploy to Netlify (connected to Git — auto-updates)

1. Push this folder to a GitHub repo.
2. In Netlify: **Add new site → Import an existing project → GitHub** → select the repo.
3. Build settings are already set via `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Click **Deploy site**. Every future push to the repo redeploys automatically.

## Local preview before deploying

```
npm install
npm run dev
```
Opens at http://localhost:5173

## Demo login credentials

| Role | Username | Password |
|---|---|---|
| Applicant | rjayasuriya | apply123 |
| Applicant | nfernando | apply123 |
| Division Head | kwickramasinghe | head123 |
| Division Head | sperera | head123 |
| Transport Officer | mbandara | transport123 |
| Final Approving Officer | asecretary | final123 |
| System Administrator | admin | admin123 |
