import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";

interface ChangelogSection {
  title: string;
  items: string[];
}

interface LatestChangelogEntry {
  version: string;
  date: string;
  sections: ChangelogSection[];
}

function cleanChangelogItem(rawLine: string): string {
  return rawLine
    .replace(/^\*\s*/, "")
    .replace(/\*\*/g, "")
    .replace(/\s*\(\[#?[\w-]+\]\([^)]*\)\)/g, "")
    .replace(/,?\s*closes\s+(\[[^\]]*\]\([^)]*\)\s*)+/gi, "")
    .trim();
}

// Читает верхнюю (самую свежую) запись CHANGELOG.md, который semantic-release
// формирует автоматически из Conventional Commits — единый источник данных
// для попапа "что нового" рядом с номером версии в UI, без дублирования текста.
function parseLatestChangelogEntry(changelogPath: string): LatestChangelogEntry | null {
  if (!fs.existsSync(changelogPath)) return null;
  const content = fs.readFileSync(changelogPath, "utf-8");

  const headingRegex = /^## \[(\d+\.\d+\.\d+)]\([^)]*\)\s*\((\d{4}-\d{2}-\d{2})\)$/m;
  const headingMatch = headingRegex.exec(content);
  if (!headingMatch || headingMatch.index === undefined) return null;
  const [heading, version, date] = headingMatch;

  const bodyStart = headingMatch.index + heading.length;
  const nextHeadingIndex = content.indexOf("\n## [", bodyStart);
  const body = content.slice(bodyStart, nextHeadingIndex === -1 ? content.length : nextHeadingIndex);

  const sections: ChangelogSection[] = [];
  const sectionRegex = /^### (\w+)$/gm;
  let sectionMatch: RegExpExecArray | null;
  const sectionHeadings: { title: string; headingStart: number; contentStart: number }[] = [];
  while ((sectionMatch = sectionRegex.exec(body)) !== null) {
    sectionHeadings.push({
      title: sectionMatch[1],
      headingStart: sectionMatch.index,
      contentStart: sectionMatch.index + sectionMatch[0].length,
    });
  }
  for (let i = 0; i < sectionHeadings.length; i++) {
    const { title, contentStart } = sectionHeadings[i];
    const contentEnd = i + 1 < sectionHeadings.length ? sectionHeadings[i + 1].headingStart : body.length;
    const itemsBlock = body.slice(contentStart, contentEnd);
    const items = itemsBlock
      .split("\n")
      .filter((line) => line.trim().startsWith("* "))
      .map(cleanChangelogItem)
      .filter((line) => line.length > 0);
    if (items.length > 0) sections.push({ title, items });
  }
  return { version, date, sections };
}

const pkg = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "package.json"), "utf-8")) as {
  version: string;
};
const latestChangelog = parseLatestChangelogEntry(path.resolve(import.meta.dirname, "CHANGELOG.md"));

// staging-deploy.yml passes the short commit SHA as APP_VERSION_SUFFIX (via
// Dockerfile ARG/ENV) — staging never runs semantic-release, so pkg.version
// alone would show a stale released-looking number (e.g. "1.10.3") on every
// staging build regardless of what commit is actually running.
const appVersion = process.env.APP_VERSION_SUFFIX
  ? `${pkg.version}-staging.${process.env.APP_VERSION_SUFFIX}`
  : pkg.version;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __LATEST_CHANGELOG__: JSON.stringify(latestChangelog),
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
