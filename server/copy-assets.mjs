import { cp } from "node:fs/promises";

await cp("server/assets", "dist/assets", { recursive: true, force: true });
