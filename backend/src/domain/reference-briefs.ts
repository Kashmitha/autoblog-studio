import { starterBriefs } from "./editorial";

export type ReferenceBrief = {
  title: string;
  niche: string;
  intent: string;
  sources: readonly string[];
  angle: string;
};
/** Reference scopes, not verified search demand or completed factual review. */
export const referenceBriefs: ReferenceBrief[] = [
  {
    title:
      "Docker volumes explained: keep your data when a container is replaced",
    niche: "Docker & DevOps",
    angle: "explanation",
    intent:
      "Explain container writable layers versus named volumes with a small non-destructive example. Describe backups and scope; do not promise data safety or use destructive cleanup commands.",
    sources: [
      "https://docs.docker.com/engine/storage/volumes/",
      "https://docs.docker.com/engine/containers/run/",
    ],
  },
  {
    title: "Python virtual environments: a clean setup for each project",
    niche: "Python",
    angle: "walkthrough",
    intent:
      "Walk through creating a venv and checking the interpreter on Windows and POSIX. Explain activation versus running the environment interpreter directly; identify platform and version differences.",
    sources: [
      "https://docs.python.org/3/library/venv.html",
      "https://docs.python.org/3/tutorial/venv.html",
    ],
  },
  {
    title: "JavaScript map vs forEach: choose by the result you need",
    niche: "JavaScript",
    angle: "comparison",
    intent:
      "Compare returning a transformed array with performing side effects. Cover return values and callback behavior without unsupported performance benchmarks or invented executed results.",
    sources: [
      "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map",
      "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach",
    ],
  },
  {
    title: "A practical checklist for investigating an HTTP error",
    niche: "Web development",
    angle: "checklist",
    intent:
      "Distinguish transport failures from HTTP response statuses, check the status and response headers, and explain what evidence to collect. Do not imply one universal fix for every server.",
    sources: [
      "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status",
      "https://curl.se/docs/manpage.html",
    ],
  },
  {
    title:
      "Inspect a website response with curl without downloading the page body",
    niche: "Command-line tools",
    angle: "task guide",
    intent:
      "Explain headers-only inspection and status output, the difference between HEAD and GET, redirect limitations, and platform-specific curl invocation. Do not claim that HEAD proves a full GET succeeds.",
    sources: [
      "https://curl.se/docs/manpage.html",
      "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status",
    ],
  },
  {
    title:
      "Write clearer Claude prompts with context, constraints and examples",
    niche: "AI tools",
    angle: "practical guide",
    intent:
      "Explain clear Claude AI prompts: define a task, supply context, specify output format, constraints and success criteria. Use a clearly labelled illustrative summarization prompt for text supplied by the reader, with a checklist for assessing its response. Do not promise that a prompt will succeed. Exclude model-specific reasoning settings, chain-of-thought, API chaining and operating-system tutorials. No executed-test, guaranteed-accuracy, free-access or model-capability claims.",
    sources: [
      "https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview",
      "https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices",
    ],
  },
  {
    title: "MySQL SELECT queries: retrieve only the columns and rows you need",
    niche: "MySQL databases",
    angle: "walkthrough",
    intent:
      "Explain a read-only SQL database MySQL SELECT query with column selection, WHERE filtering and ORDER BY. Keep examples illustrative; no destructive commands or invented benchmark results.",
    sources: [
      "https://dev.mysql.com/doc/refman/8.4/en/select.html",
      "https://dev.mysql.com/doc/refman/8.4/en/selecting-all.html",
    ],
  },
  {
    title: "SQL Server SELECT and WHERE: inspect data without changing it",
    niche: "SQL Server",
    angle: "checklist",
    intent:
      "Explain read-only SQL Server database SELECT and WHERE queries, explicit columns, filtering and NULL caveats. No invented executed output or destructive data changes.",
    sources: [
      "https://learn.microsoft.com/en-us/sql/t-sql/queries/select-transact-sql",
      "https://learn.microsoft.com/en-us/sql/t-sql/queries/where-transact-sql",
    ],
  },
  {
    title:
      "Azure compute options: choose a hosting model for a small application",
    niche: "Azure cloud",
    angle: "decision guide",
    intent:
      "Compare Azure Microsoft cloud compute hosting models and application architecture tradeoffs from the official guidance. Do not invent pricing, availability guarantees or claim a depicted logo implies endorsement.",
    sources: [
      "https://learn.microsoft.com/en-us/azure/architecture/guide/technology-choices/compute-decision-tree",
      "https://learn.microsoft.com/en-us/azure/architecture/guide/design-principles/",
    ],
  },
  ...starterBriefs.map(([title, first, second, intent]) => ({
    title,
    niche: "Git & GitHub",
    intent,
    angle: title.startsWith("Why") ? "troubleshooting" : "task guide",
    sources: [first, second].map((doc) => `https://git-scm.com/docs/${doc}`),
  })),
];

/** Explicit backlog priority wins; within it, prefer the least recently used area. */
export function chooseVariedBrief<
  T extends { niche: string; backlogPriority?: number },
>(briefs: T[], recentNiches: string[]): T | undefined {
  const priority = Math.max(...briefs.map((b) => b.backlogPriority || 0));
  const age = (niche: string) => {
    const index = recentNiches.findIndex(
      (n) => n.trim().toLowerCase() === niche.trim().toLowerCase(),
    );
    return index < 0 ? Number.MAX_SAFE_INTEGER : index;
  };
  return briefs
    .filter((b) => (b.backlogPriority || 0) === priority)
    .sort((a, b) => age(b.niche) - age(a.niche))[0];
}
