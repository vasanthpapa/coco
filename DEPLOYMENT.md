# Vercel with MongoDB Atlas

The application uses MongoDB Atlas through the official `mongodb` driver.
Turso and local SQLite are no longer used by the running application.

## Setup

1. Create an Atlas database user with read/write access to the `coco` database.
2. In Atlas Network Access, allow your deployment's outbound network addresses.
   For a fixed allowlist, use a hosting configuration with static outbound IPs.
3. In Vercel project settings, set these server-only environment variables:
   - `MONGODB_URI`: the Atlas driver connection string, including the database
     username and password. URL-encode reserved characters in the password:
     `@` becomes `%40`. Do not use backslashes to escape them.
   - `MONGODB_DB`: `coco` (this is the default if omitted, and overrides the URI's database name).
   - `GEMINI_API_KEY`: required for AI analysis.
4. Enable the variables for Production and the Preview environments you use.
   Prefer a separate database for previews. Remove obsolete `TURSO_*` variables.
5. Deploy the updated Git commit using the Next.js framework preset and
   `npm run build`. Collections, indexes and numeric ID counters initialize
   on the first database request. The account needs permission to create indexes.
6. Check `/api/employees` and `/api/name-mappings`: an empty database returns `[]`.
   Create an employee and alias, rename the employee, and run analysis.

Use the same variables in `.env.local` for local development. Keep credentials
out of Git, chat, and `NEXT_PUBLIC_*` variables. Rotate any previously shared
password before configuring the deployment. See `.env.example` for placeholders.
AI model availability and provider quotas are separate from database connectivity.

A missing or invalid database connection returns a JSON 503 response. Verify the
URI, database user's permissions, Atlas cluster status and Network Access settings.

## Existing local records

A new Atlas database starts empty. Nothing is uploaded automatically.

To copy `data/coco.db` into an empty Atlas database:

1. Use Node.js 24+ (the migration uses Node's built-in SQLite reader).
2. Back up the local database and stop writes to it during migration.
3. Configure the destination `MONGODB_URI` and `MONGODB_DB` in `.env.local`.
4. Run `npm run db:migrate` once. Optionally set `SQLITE_DATABASE_PATH` for another source.

The migration reads SQLite without modifying it, preserves numeric IDs and aliases,
updates ID counters, and refuses to overwrite nonempty MongoDB collections.
Writes are transactional. Invalid or orphaned source mappings abort the import.

## Verification

Run `npm run test:database` and `npm run build`.
The tests start an isolated local MongoDB replica set and use the real driver.
They cover concurrent creates, duplicate checks, mappings, rename/delete/reorder,
rollback, API response contracts, analysis and SQLite migration. They never connect
to Atlas. The first run downloads a MongoDB test binary into `.test-output`.
