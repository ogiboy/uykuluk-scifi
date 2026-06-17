#!/usr/bin/env node
import { readFileSync } from "node:fs";
import process from "node:process";

const changelog = readFileSync("CHANGELOG.md", "utf8");
const marker = "<!-- version list -->";
const count = changelog.split(marker).length - 1;

if (count !== 1) {
  console.error(`CHANGELOG.md must contain exactly one ${marker} marker; found ${count}.`);
  process.exit(1);
}

console.log("CHANGELOG.md marker check passed.");
