import { DateTime } from "luxon";
import { similarity, normalizeTopic } from "./workflow";

export const EDITORIAL_ENABLE = "ENABLE PAID EDITORIAL DRAFTS";
export const EDITORIAL_PUBLISH = "AUTHORIZE AUTOMATIC EDITORIAL PUBLISHING";
export const PHOTO_CONFIRMATION = "CONFIRM REAL PHOTO RIGHTS";
export function editorialSlots(
  times: string[],
  now = new Date(),
  manual = false,
) {
  const local = DateTime.fromJSDate(now).setZone("Asia/Colombo");
  const dates = manual ? [local, local.plus({ days: 1 })] : [local];
  return dates
    .flatMap((day) =>
      times.map((time) => {
        const [hour, minute] = time.split(":").map(Number);
        const at = day.set({ hour, minute, second: 0, millisecond: 0 });
        return { key: `${at.toISODate()}:${time}`, at: at.toJSDate() };
      }),
    )
    .filter((slot) =>
      manual
        ? slot.at.getTime() >= now.getTime() + 10 * 60000
        : slot.at.getTime() >= now.getTime() + 5 * 60000 &&
          slot.at.getTime() <= now.getTime() + 30 * 60000,
    )
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}
export function acceptableTitle(title: unknown, existing: string[]) {
  return (
    typeof title === "string" &&
    title.trim().length >= 8 &&
    title.trim().length <= 180 &&
    !/[\r\n<>]/.test(title) &&
    !existing.some(
      (other) =>
        normalizeTopic(other) === normalizeTopic(title) ||
        similarity(other, title) > 0.75,
    )
  );
}
export type PhotoCandidate = {
  id: string;
  title: string;
  alt: string;
  provider: string;
  url: string;
  license: string;
  rightsConfirmed: boolean;
  metadata: unknown;
  checkedAt: Date;
};
export function photoPolicy(photo: PhotoCandidate, now = new Date()) {
  const meta = photo.metadata as {
    editorialPhoto?: {
      enabled?: boolean;
      tags?: string[];
      confirmedAt?: string;
    };
  } | null;
  const approved = meta?.editorialPhoto;
  return (
    photo.rightsConfirmed &&
    ["WIKIMEDIA", "ORIGINAL"].includes(photo.provider) &&
    [
      "CC0",
      "Public domain",
      "CC BY 4.0",
      "CC BY-SA 4.0",
      "Original work",
    ].includes(photo.license) &&
    photo.url.startsWith("https://") &&
    !!photo.alt &&
    approved?.enabled === true &&
    Array.isArray(approved.tags) &&
    approved.tags.length > 0 &&
    approved.tags.every((tag) => typeof tag === "string" && !!tag.trim()) &&
    Number.isFinite(Date.parse(approved.confirmedAt || "")) &&
    now.getTime() >= Date.parse(approved.confirmedAt!) &&
    now.getTime() - Date.parse(approved.confirmedAt!) < 90 * 86400000
  );
}
export function choosePhoto(
  photos: PhotoCandidate[],
  terms: string,
  now = new Date(),
) {
  const tokens = new Set(
    normalizeTopic(terms)
      .split(" ")
      .filter((word) => word.length > 2),
  );
  return (
    photos
      .filter((photo) => photoPolicy(photo, now))
      .map((photo) => {
        const tags = (photo.metadata as { editorialPhoto: { tags: string[] } })
          .editorialPhoto.tags;
        const score = tags.reduce(
          (sum, tag) =>
            sum +
            normalizeTopic(tag)
              .split(" ")
              .filter((token) => token.length > 2 && tokens.has(token)).length,
          0,
        );
        return { photo, score };
      })
      .filter((row) => row.score > 0)
      .sort(
        (a, b) => b.score - a.score || a.photo.id.localeCompare(b.photo.id),
      )[0]?.photo || null
  );
}

// Source-backed starter briefs, not a claim of search demand or verified code execution.
export const starterBriefs = [
  [
    "How to see only the files changed in a Git commit",
    "git-show",
    "git-diff",
    "Inspect a commit's changed paths and status without altering files.",
  ],
  [
    "How to find a deleted file in Git history",
    "git-log",
    "git-show",
    "Locate a deleted tracked file in history and inspect an older version without overwriting local files.",
  ],
  [
    "How to check which Git branch contains a commit",
    "git-branch",
    "git-log",
    "Distinguish local and remote-tracking branch containment with read-only commands.",
  ],
  [
    "Why git status shows a file as both staged and modified",
    "git-status",
    "git-diff",
    "Explain index versus working tree with a small concrete example and separate diff commands.",
  ],
  [
    "How to search Git commit messages for a specific change",
    "git-log",
    "git-show",
    "Search messages with --grep, explain limitations, and inspect matching patches.",
  ],
  [
    "How to check a Git remote URL without changing it",
    "git-remote",
    "git-config",
    "Inspect fetch and push remote URLs without printing credentials in examples or changing configuration.",
  ],
  [
    "How to list Git tags in version order",
    "git-tag",
    "git-for-each-ref",
    "Compare lexical and version sorting and explain that tags do not verify release stability.",
  ],
  [
    "How to find large tracked files in a Git repository",
    "git-ls-files",
    "git-ls-tree",
    "Inspect tracked snapshot file sizes and distinguish them from all historical object sizes.",
  ],
] as const;
