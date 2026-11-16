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
