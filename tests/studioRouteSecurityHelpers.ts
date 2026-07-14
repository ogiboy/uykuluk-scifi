import { readdir } from "node:fs/promises";
import path from "node:path";

export async function discoverBoundaryFiles(root: string): Promise<string[]> {
  const files = await listFiles(root);
  return files.filter((file) => /\/(?:error|not-found)\.tsx$/.test(file)).sort(routeSort);
}

export async function discoverPageRoutes(root: string): Promise<string[]> {
  const files = await listFiles(root);
  return files
    .filter((file) => file.endsWith("/page.tsx"))
    .map((file) => pageFileToRoute(root, file))
    .sort(routeSort);
}

export async function discoverRouteHandlers(root: string): Promise<string[]> {
  const files = await listFiles(root);
  return files.filter((file) => /\/route\.(ts|tsx|js|jsx)$/.test(file)).sort(routeSort);
}

async function listFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(root, entry.name);
      return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
    }),
  );
  return files.flat();
}

function pageFileToRoute(root: string, file: string): string {
  const relative = path.relative(root, file).replaceAll(path.sep, "/");
  const route = relative.replace(/\/page\.tsx$/, "").replace(/^page\.tsx$/, "");
  return route.length === 0 ? "/" : `/${route}`;
}

export function routeSort(left: string, right: string): number {
  return left.localeCompare(right);
}
