import {
  acceptableTitle,
  editorialSlots,
  choosePhoto,
  photoPolicy,
  type PhotoCandidate,
} from "../src/domain/editorial";

const now = new Date("2026-11-13T03:00:00Z"); // 08:30 Sri Lanka.
const photo: PhotoCandidate = {
  id: "one",
  title: "Laptop photograph",
  alt: "A laptop on a desk",
  provider: "WIKIMEDIA",
  url: "https://upload.wikimedia.org/example.jpg",
  license: "CC BY 4.0",
  rightsConfirmed: true,
  checkedAt: now,
  metadata: {
    editorialPhoto: {
      enabled: true,
      tags: ["laptop", "programming"],
      confirmedAt: now.toISOString(),
    },
  },
};
test("automatic slots prepare only imminent future Sri Lanka times and do not burst backfill", () => {
  expect(editorialSlots(["09:00", "17:00"], now)).toEqual([
    { key: "2026-11-13:09:00", at: new Date("2026-11-13T03:30Z") },
  ]);
  expect(
    editorialSlots(["09:00", "17:00"], new Date("2026-11-13T04:00Z")),
  ).toEqual([]);
  expect(
    editorialSlots(["09:00", "17:00"], new Date("2026-11-13T18:00Z"), true)[0]
      .key,
  ).toBe("2026-11-14:09:00");
});
test("natural title checks reject duplicate topics, markup and invalid lengths", () => {
  expect(
    acceptableTitle("Why staged changes disappear from a normal diff", [
      "Why staged changes disappear from a normal diff",
    ]),
  ).toBe(false);
  expect(acceptableTitle("<h1>A realistic title</h1>", [])).toBe(false);
  expect(acceptableTitle("New", [])).toBe(false);
  expect(
    acceptableTitle("Find the commit behind one changed line", [
      "A guide to Docker networking",
    ]),
  ).toBe(true);
});
test("only confirmed, unexpired real-photo pool entries are eligible; Unsplash remains manual", () => {
  expect(photoPolicy(photo, now)).toBe(true);
  expect(
    photoPolicy({ ...photo, provider: "UNSPLASH", license: "Unsplash" }, now),
  ).toBe(false);
  expect(photoPolicy({ ...photo, metadata: {} }, now)).toBe(false);
  expect(photoPolicy({ ...photo, rightsConfirmed: false }, now)).toBe(false);
  expect(
    photoPolicy(
      {
        ...photo,
        metadata: {
          editorialPhoto: {
            enabled: true,
            tags: ["laptop"],
            confirmedAt: "2027-01-01T00:00:00Z",
          },
        },
      },
      now,
    ),
  ).toBe(false);
  expect(photoPolicy(photo, new Date(now.getTime() + 90 * 86400000))).toBe(
    false,
  );
});
test("photo selection uses relevant pool keywords and does not silently attach unrelated images", () => {
  expect(choosePhoto([photo], "A laptop programming tutorial", now)?.id).toBe(
    "one",
  );
  expect(choosePhoto([photo], "Ocean wildlife conservation", now)).toBeNull();
});
