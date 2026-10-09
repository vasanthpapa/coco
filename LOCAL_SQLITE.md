# Local SQLite test fixture

Create a git-ignored SQLite database for local schema tests:

```bash
npm run db:sqlite:local
```

Set `COCO_SQLITE_PATH` to select another file path. The default is `data/coco.local.db`.

This fixture uses the employee and name-mapping shape required by Coco's existing SQLite-to-Mongo migration. Coco itself continues to read and write MongoDB; no runtime fallback or automatic migration is enabled.

The WhatsApp analysis API currently returns parsed messages, attendance records, and penalty records only. It does not send them to Smart Salary.
