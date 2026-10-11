# Learnda

Learnda is a class-based learning platform with lessons, practice, resources,
study groups, and community features.

## Local development

Install dependencies with `npm ci`, `npm ci --prefix frontend`, and
`npm ci --prefix backend`. Copy each application's `.env.development.example`
to `.env.development.local` and configure its values.

Run `npm run dev` for the frontend and `npm run dev --prefix backend` for the API.

## Deployment

Import this repository into Vercel as two projects:

- Frontend: root directory `frontend`, Vite framework, build `npm run build`,
  output directory `dist`. Set `VITE_API_BASE_URL=/api` and `VITE_SITE_URL` to
  the deployed frontend URL. Configure `VITE_GOOGLE_CLIENT_ID` if using Google
  sign-in.
- Backend: root directory `backend`, Express framework. Configure private
  environment variables using `backend/.env.production.example` as a guide.
  Set `APP_PUBLIC_URL` and `CORS_ORIGIN` to the deployed frontend URL. Use a
  hosted PostgreSQL database, `DATABASE_SSL=true`, and `DB_SYNC=none`.

The frontend's `/api` rewrite must point to the deployed backend's `/api`
path. Cloudflare R2 is required for persistent uploads on Vercel. Email and
SMS providers must be configured for verification messages.

Never commit local environment files or credentials.

## Verification

Run `npm run build` and `npm test --prefix backend`.
