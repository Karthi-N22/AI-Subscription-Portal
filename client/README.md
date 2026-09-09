# EC LABS client

Standalone React + Vite client for the AI Subscription Portal.

## Run

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` and set `VITE_API_BASE_URL` when the API is not running at `http://localhost:4000/api`.

## Development login

```text
Email: admin@eclabs.co
Password: ECLabs@2026
```

The dashboard and all screen data load from the Express API. Configure `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in the backend `.env` to change the development account.
