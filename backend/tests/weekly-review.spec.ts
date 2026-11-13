import "reflect-metadata";
import { weeklyReviewWindow } from "../src/application/weekly-review.service";

test("weekly review excludes the current Sri Lanka day across the UTC date boundary", () => {
  const before = weeklyReviewWindow(new Date("2026-11-12T18:29:59Z"));
  const after = weeklyReviewWindow(new Date("2026-11-12T18:30:00Z"));
  expect(before).toMatchObject({
    startDate: "2026-11-05",
    endDate: "2026-11-11",
  });
  expect(after).toMatchObject({
    startDate: "2026-11-06",
    endDate: "2026-11-12",
    timezone: "Asia/Colombo",
  });
  expect(after.start.toISOString()).toBe("2026-11-05T18:30:00.000Z");
  expect(after.end.toISOString()).toBe("2026-11-12T18:30:00.000Z");
});

test("seven completed calendar days include leap day correctly", () => {
  const window = weeklyReviewWindow(new Date("2024-03-01T00:00:00Z"));
  expect(window).toMatchObject({
    startDate: "2024-02-23",
    endDate: "2024-02-29",
  });
  expect(window.end.getTime() - window.start.getTime()).toBe(7 * 86400000);
});
