import { cp } from "node:fs/promises";

await cp("api/assets", "dist/assets", { recursive: true, force: true });
