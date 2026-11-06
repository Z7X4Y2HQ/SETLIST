# Setlist — Gym Routine Tracker

A day-by-day workout planner with editable routines, exercise completion history, and light/dark themes.

## Data and sign-in

Create a Setlist account from the sign-in screen, or use the configured owner account. Each account has its own plans and workout history. Workout plans and dated completion history are saved to the authenticated PostgreSQL API. Theme and selected plan stay in the browser. The browser keeps the short-lived API token in session storage; the password is never saved by the app.

On the owner's first sign-in, existing `setlist-plans-v1` and `setlist-completed-v1` browser data is imported only when that account has never had plans. New accounts land on a welcome screen to name their first plan and choose training days. Nothing is created until they submit that setup. Legacy browser data is kept as a backup and is never automatically imported into member accounts.

## Run locally

Start PostgreSQL and the backend from `Desktop\Server\server` (see its README). Then:

```bash
npm ci
npm run dev
```

Vite proxies `/api` to `http://localhost:3002` by default. For a production build hosted separately from the API, set `VITE_API_URL` to the backend HTTPS URL before building and make sure its origin is listed in backend `CORS_ORIGINS`.

```powershell
$env:VITE_API_URL = "https://api.example.com"
npm run build
```

## Self-hosting

The included `deploy.sh` builds and serves the production bundle on port `3001` using Vite Preview. Set `VITE_API_URL` to the public HTTPS backend URL in the deployment environment before running the script. Keep the API and app behind HTTPS; never expose PostgreSQL to the public internet.

## GitHub Pages

The master branch deploys automatically through the GitHub Pages Actions workflow. In the repository, open Settings > Pages and set the publishing source to GitHub Actions.

The frontend can deploy before the API is hosted; sign-in and saved data will not work until the API is available. When the API is live, add a repository Actions variable named VITE_API_URL with its public HTTPS base URL (for example, https://api.example.com, without a trailing slash). If set, the workflow requires HTTPS and builds with the GitHub Pages project path.

The API and PostgreSQL database must remain hosted separately; GitHub Pages serves only the frontend. In the backend environment, include https://z7x4y2hq.github.io in CORS_ORIGINS, preserving any existing origins, then restart the API. The GitHub Pages project URL is https://z7x4y2hq.github.io/SETLIST/.


## Plans and storage

The shared backend exposes Setlist endpoints under `/api/v1/setlist/`. Its `setlist` database contains users, plans, workout days, exercises, equipment, and dated workout history in separate relational tables. Choose exercises from muscle-group dropdowns and equipment from compatible options, then enter sets, reps, and an optional note.

Edits save automatically in order; plans are saved before their completion updates. Sign out waits for pending saves. Use Retry save if a request fails. Archiving uses an in-app confirmation and moves the plan out of the current planner while retaining its workout history. Open **Archived plans** below the top bar to browse your archived plans and restore them. You can archive your last active plan and restore it later. Removing a planned exercise retains historical name/equipment snapshots.

Run `npm test` for save-queue tests and `npm run build` to verify the production bundle.
