import { articlePhotoTerms } from "../src/domain/photo-preparation";

const article = {
  title: "Debug a failing request",
  niche: "Web development",
  intent: "Explain request debugging",
  generation: {},
};
test("photo queries prefer sanitized model terms and remain bounded", () => {
  expect(
    articlePhotoTerms({
      ...article,
      generation: {
        imageSearchTerms: [
          "computer keyboard",
          "server computer",
          "laptop desk",
          4,
        ],
      },
    }),
  ).toEqual(["computer keyboard", "server computer"]);
});
test("known developer topics get illustrative physical subjects without a text call", () => {
  expect(articlePhotoTerms(article)).toEqual([
    "laptop keyboard",
    "computer workstation",
  ]);
  expect(articlePhotoTerms({ ...article, niche: "Docker & DevOps" })).toEqual([
    "server computer",
    "data center",
  ]);
});
test("unknown subjects never receive an unrelated technology fallback", () => {
  expect(
    articlePhotoTerms({
      ...article,
      niche: "Gardening",
      title: "Prune a rose bush",
    }),
  ).toEqual([]);
});
test("explicit photo keywords cannot introduce query operators or synthetic-image subjects", () => {
  expect(
    articlePhotoTerms(article, [
      "laptop -incategory:AI",
      "generated computer image",
      "forest",
    ]),
  ).toEqual(["laptop incategory AI"]);
  expect(articlePhotoTerms(article, [])).toEqual([]);
});
