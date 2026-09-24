# Vercel with Turso

The application uses hosted SQLite through `@libsql/client` when
`TURSO_DATABASE_URL` is set. Without it, local development uses `data/coco.db`.
On Vercel, hosted credentials are mandatory; there is no temporary-file fallback.

1. Create a Turso database and generate its database authentication token.
2. In Vercel project settings, add `TURSO_DATABASE_URL` (the `libsql://...` URL)
   and `TURSO_AUTH_TOKEN`. Add `GEMINI_API_KEY` for AI features.
3. Enable these variables for Production and any Preview environments you use.
   Prefer a separate database for previews.
4. Deploy the updated Git commit using the Next.js framework preset and
   `npm run build`. Tables are initialized on the first database request.
5. Check `/api/employees` and `/api/name-mappings`: a new database returns `[]`.
   Create an employee and alias, then test analysis. Check Vercel runtime logs
   if an API returns an error.

Never commit real tokens or `.env.local`. See `.env.example` for variable names.
AI model availability and provider quotas are separate from database connectivity.

## Existing local data

A new hosted database starts empty. The local employee and alias records are not
uploaded automatically. To copy them to an empty hosted database, configure the
Turso credentials in `.env.local`, stop local processes that write employee data,
and run `npm run db:migrate`. The script reads the local database and refuses to
overwrite nonempty destination tables. Back up the local database first.

## Verification

Run `npm run test:database` and `npm run build`. Database tests use isolated files
under `.test-output`; they never open the real employee database or contact Turso.
