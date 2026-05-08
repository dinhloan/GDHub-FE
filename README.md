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

The UI includes mock data fallback, so the workspace can render before MongoDB and the backend are running.
