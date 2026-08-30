import { readFile } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { getDb } from "../server/queries/connection.js";

const filename = process.argv[2] ?? "0005_notification_jobs.sql";
const migration = await readFile(new URL(`../db/migrations/${filename}`, import.meta.url), "utf8");
for (const statement of migration.split(/;\s*(?:\r?\n|$)/).map((item) => item.trim()).filter(Boolean)) {
  await getDb().execute(sql.raw(statement));
}
console.log("notification_jobs migration applied");
process.exit(0);
