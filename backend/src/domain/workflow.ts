import { ArticleStatus } from "@prisma/client";
const transitions: Record<ArticleStatus, ArticleStatus[]> = {
  PLANNED: ["RESEARCHING", "DRAFTING", "NEEDS_REVIEW", "REJECTED"],
  RESEARCHING: ["DRAFTING", "NEEDS_REVIEW", "FAILED", "REJECTED"],
  DRAFTING: ["NEEDS_REVIEW", "FAILED", "REJECTED"],
  NEEDS_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["NEEDS_REVIEW", "SCHEDULED", "REJECTED"],
  SCHEDULED: ["APPROVED", "PUBLISHING", "FAILED"],
  PUBLISHING: ["PUBLISHED", "FAILED"],
  PUBLISHED: [],
  FAILED: ["NEEDS_REVIEW", "APPROVED"],
  REJECTED: ["NEEDS_REVIEW"],
};
export function canTransition(from: ArticleStatus, to: ArticleStatus) {
  return transitions[from].includes(to);
}
export function assertTransition(from: ArticleStatus, to: ArticleStatus) {
  if (!canTransition(from, to))
    throw new Error(`Cannot move ${from} to ${to}.`);
}
export function normalizeTopic(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
export function similarity(a: string, b: string) {
  const tokens = (s: string) =>
    new Set(
      normalizeTopic(s)
        .split(" ")
        .filter((w) => w.length > 2),
    );
  const x = tokens(a),
    y = tokens(b);
  const intersection = [...x].filter((w) => y.has(w)).length;
  return intersection / Math.max(1, new Set([...x, ...y]).size);
}
