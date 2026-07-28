// Точный текущий текст преамбулы CHANGELOG.md (заголовок + описание +
// разделитель `---`) — @semantic-release/changelog matчит его как
// changelogTitle и вставляет новую секцию релиза сразу после него, перед
// остальным содержимым файла. Если преамбулу меняют вручную — эту строку
// нужно обновить синхронно, иначе плагин перестанет её узнавать и обратно
// скатится к вставке в самое начало файла (выше `# Changelog`).
const changelogTitle = `# Changelog

Все значимые изменения в этом проекте документируются в данном файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/),
проект придерживается [Semantic Versioning](https://semver.org/lang/ru/).

Начиная с версии после 1.0.0 версия и этот файл формируются автоматически
через [semantic-release](https://semantic-release.gitbook.io/) на основе
[Conventional Commits](https://www.conventionalcommits.org/ru/) — см. раздел
«Версионирование и релизы» в [CONTRIBUTING.md](CONTRIBUTING.md).

---`;

// conventional-changelog-conventionalcommits@10 (preset "conventionalcommits")
// молча отдаёт пустое тело релиза при любом presetConfig, включая дефолтный —
// проверено напрямую через @semantic-release/release-notes-generator с
// установленными версиями пакетов (баг где-то на стыке этого пресета и
// conventional-changelog-writer, не в конфиге). Пресет "angular" с тем же
// парсером коммитов отрабатывает корректно, поэтому берём его как базу и
// только переопределяем transform() — копия angular-реализации с
// заголовками секций под принятый в проекте Keep a Changelog
// (Added/Fixed/Changed/Removed/Docs) вместо дефолтных Features/Bug Fixes/...
const COMMIT_HASH_LENGTH = 7;

function transform(commit, context) {
  let discard = true;
  const notes = commit.notes.map((note) => {
    discard = false;
    return { ...note, title: "BREAKING CHANGES" };
  });

  let type;
  if (commit.type === "feat") {
    type = "Added";
  } else if (commit.type === "fix") {
    type = "Fixed";
  } else if (commit.type === "perf" || commit.type === "refactor") {
    type = "Changed";
  } else if (commit.type === "revert" || commit.revert) {
    type = "Removed";
  } else if (commit.type === "docs") {
    type = "Docs";
  } else if (discard) {
    return undefined;
  } else {
    type = commit.type;
  }

  const scope = commit.scope === "*" ? "" : commit.scope;
  const shortHash = typeof commit.hash === "string" ? commit.hash.substring(0, COMMIT_HASH_LENGTH) : commit.shortHash;
  const issues = [];
  let { subject } = commit;

  if (typeof subject === "string") {
    let url = context.repository ? `${context.host}/${context.owner}/${context.repository}` : context.repoUrl;

    if (url) {
      url = `${url}/issues/`;
      subject = subject.replace(/#([0-9]+)/g, (_, issue) => {
        issues.push(issue);
        return `[#${issue}](${url}${issue})`;
      });
    }

    if (context.host) {
      subject = subject.replace(/`[^`]*`|\B@([a-z0-9](?:-?[a-z0-9/]){0,38})/g, (match, username) => {
        if (!username) return match;
        if (username.includes("/")) return `@${username}`;
        return `[@${username}](${context.host}/${username})`;
      });
    }
  }

  const references = commit.references.filter((reference) => !issues.includes(reference.issue));

  return { notes, type, scope, shortHash, subject, references };
}

export default {
  branches: ["main"],
  plugins: [
    ["@semantic-release/commit-analyzer", { preset: "conventionalcommits" }],
    [
      "@semantic-release/release-notes-generator",
      {
        preset: "angular",
        writerOpts: {
          transform,
          groupBy: "type",
          commitGroupsSort: "title",
          commitsSort: ["scope", "subject"],
        },
      },
    ],
    [
      "@semantic-release/exec",
      { prepareCmd: "npm version ${nextRelease.version} --no-git-tag-version --allow-same-version" },
    ],
    ["@semantic-release/changelog", { changelogFile: "CHANGELOG.md", changelogTitle }],
    // markdownlint (MD004/MD012 и т.п.) проверяет CHANGELOG.md в CI —
    // прогоняем автофикс сразу после генерации секции релиза, чтобы
    // артефакты форматирования writer-шаблона (стиль списков, лишние
    // пустые строки) не долетали до коммита и не валили Markdown Lint
    // в следующем PR.
    ["@semantic-release/exec", { prepareCmd: "npm run docs:fix" }],
    [
      "@semantic-release/git",
      {
        assets: ["package.json", "package-lock.json", "CHANGELOG.md"],
        message: "chore(release): ${nextRelease.version}\n\n${nextRelease.notes}",
      },
    ],
    "@semantic-release/github",
  ],
};
