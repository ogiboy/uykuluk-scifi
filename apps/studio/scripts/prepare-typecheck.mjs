import { rm } from "node:fs/promises";

const staleDevTypes = new URL("../.next/dev/types/", import.meta.url);

// `next typegen` refreshes production route types but does not remove stale development validators.
await rm(staleDevTypes, { force: true, recursive: true });
