import { readFile } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { getDb } from "../server/queries/connection.js";

const migration = await readFile(new URL("../db/migrations/0005_notification_jobs.sql", import.meta.url), "utf8");
await getDb().execute(sql.raw(migration));
console.log("notification_jobs migration applied");
process.exit(0);
