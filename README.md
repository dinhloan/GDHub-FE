# GDHub Frontend

React/Vite workspace UI for GDHub.

## Run

```bash
npm install
npm run dev
```

Default URL: `http://localhost:5173`

## Environment

Create `.env` when backend uses non-default ports:

```bash
VITE_API_URL=http://localhost:4000/api
VITE_SOCKET_URL=http://localhost:4000
```

The UI expects a reachable backend for real users, topics, notes, discussions and checklists.

## Deploy to Vercel

Use the repository root as this frontend folder.

Vercel can read `vercel.json` directly:

- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`

Set these Vercel environment variables after the Render backend URL is available:

```bash
VITE_API_URL=https://your-render-service.onrender.com/api
VITE_SOCKET_URL=https://your-render-service.onrender.com
```

After Vercel deploys, copy the Vercel app URL back into Render as `FRONTEND_ORIGIN`.
