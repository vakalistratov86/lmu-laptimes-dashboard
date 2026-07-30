/// <reference types="vite/client" />

interface LatestChangelogSection {
  title: string;
  items: string[];
}

interface LatestChangelogEntry {
  version: string;
  date: string;
  sections: LatestChangelogSection[];
}

// Инжектируются через `define` в vite.config.ts из package.json/CHANGELOG.md на этапе сборки.
declare const __APP_VERSION__: string;
declare const __LATEST_CHANGELOG__: LatestChangelogEntry | null;
