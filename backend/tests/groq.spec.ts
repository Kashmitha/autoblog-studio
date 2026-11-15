import { aiConfiguration } from "../src/domain/ai-config";
import {
  ConfiguredAiProvider,
  GroqProvider,
} from "../src/infrastructure/ai.provider";
import { AiService } from "../src/application/ai.service";
import type { PrismaService } from "../src/infrastructure/prisma.service";
import type { ArticlesService } from "../src/application/articles.service";

const keys = [
  "AI_PROVIDER",
  "AI_ENABLED",
  "AI_API_KEY",
  "AI_BILLING_AUTHORIZED",
  "GROQ_API_KEY",
  "GROQ_PLAN",
  "GROQ_MODEL",
  "GROQ_FREE_TIER_CONFIRMED",
  "AI_MAX_OUTPUT_TOKENS",
  "AI_DAILY_GENERATION_LIMIT",
  "AI_MONTHLY_LIMIT_USD",
  "AI_INPUT_USD_PER_MILLION",
  "AI_OUTPUT_USD_PER_MILLION",
];
const old = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
const data = {
  title: "Read a Git patch",
  excerpt: "A concrete guide",
  html: "<p>Draft</p>",
  outline: ["Read the patch"],
  labels: ["Git"],
  imageSearchTerms: ["laptop"],
  uncertainties: [],
  topics: [],
};
const success = () =>
  new Response(
    JSON.stringify({
      choices: [
        { finish_reason: "stop", message: { content: JSON.stringify(data) } },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 300 },
    }),
  );
beforeEach(() => {
  keys.forEach((k) => delete process.env[k]);
  Object.assign(process.env, {
    AI_PROVIDER: "groq",
    AI_ENABLED: "true",
    AI_BILLING_AUTHORIZED: "false",
    GROQ_API_KEY: "fixture-groq-never-sent",
    GROQ_PLAN: "free",
    GROQ_FREE_TIER_CONFIRMED: "true",
  });
});
afterEach(() => {
  jest.restoreAllMocks();
  for (const k of keys) {
    if (old[k] === undefined) delete process.env[k];
    else process.env[k] = old[k];
  }
});
test("Groq declared Free mode needs no paid authorization or price fiction", () => {
  expect(aiConfiguration()).toMatchObject({
    ready: true,
    free: true,
    inputRate: 0,
    outputRate: 0,
    maxTokens: 6000,
    model: "openai/gpt-oss-20b",
    usageModel: "groq/openai/gpt-oss-20b",
  });
});
test.each([
  "GROQ_API_KEY",
  "GROQ_FREE_TIER_CONFIRMED",
  "GROQ_PLAN",
  "AI_ENABLED",
])("missing %s blocks before network", async (key) => {
  delete process.env[key];
  const fetch = jest.spyOn(global, "fetch");
  await expect(
    new ConfiguredAiProvider().generate("fixture", 6000, "openai/gpt-oss-20b"),
  ).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});
test("Groq paid mode retains billing and pricing safeguards", () => {
  process.env.GROQ_PLAN = "paid";
  expect(aiConfiguration().ready).toBe(false);
  Object.assign(process.env, {
    AI_BILLING_AUTHORIZED: "true",
    AI_INPUT_USD_PER_MILLION: ".1",
    AI_OUTPUT_USD_PER_MILLION: ".2",
  });
  expect(aiConfiguration()).toMatchObject({
    ready: true,
    free: false,
    inputRate: 0.1,
    outputRate: 0.2,
  });
});
test("OpenAI cannot use the Groq free declaration to bypass billing", () => {
  process.env.AI_PROVIDER = "openai";
  process.env.AI_API_KEY = "fixture-openai";
  expect(aiConfiguration()).toMatchObject({ free: false, ready: false });
});
test.each([
  { AI_PROVIDER: "other" },
  { GROQ_MODEL: "unsupported" },
  { AI_DAILY_GENERATION_LIMIT: "1.5" },
  { AI_MAX_OUTPUT_TOKENS: "10001" },
])("invalid provider settings block safely: %o", (input) => {
  Object.assign(process.env, input);
  expect(aiConfiguration().ready).toBe(false);
});
test("routes only the Groq key to the fixed endpoint with strict JSON and maps actual usage", async () => {
  process.env.AI_API_KEY = "fixture-openai-do-not-send";
  const fetch = jest.spyOn(global, "fetch").mockResolvedValue(success());
  const result = await new ConfiguredAiProvider().generate(
    "reviewed reference fixture",
    6000,
    "openai/gpt-oss-20b",
  );
  expect(result).toEqual({ data, inputTokens: 100, outputTokens: 300 });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toBe(
    "https://api.groq.com/openai/v1/chat/completions",
  );
  const init = fetch.mock.calls[0][1]!;
  expect(init.headers).toMatchObject({
    Authorization: "Bearer fixture-groq-never-sent",
  });
  expect(JSON.parse(init.body as string)).toMatchObject({
    model: "openai/gpt-oss-20b",
    max_completion_tokens: 6000,
    response_format: { type: "json_schema", json_schema: { strict: true } },
  });
});
test.each([429, 401, 403, 500])(
  "HTTP %s has safe errors and never retries or falls back",
  async (status) => {
    const fetch = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response("private provider details fixture", { status }),
      );
    await expect(
      new GroqProvider().generate("fixture", 6000, "openai/gpt-oss-20b"),
    ).rejects.not.toThrow("private provider details");
    expect(fetch).toHaveBeenCalledTimes(1);
  },
);
test.each([
  { choices: [{ finish_reason: "length", message: { content: "{}" } }] },
  {
    choices: [{ finish_reason: "stop", message: { content: "not json" } }],
    usage: { prompt_tokens: 1, completion_tokens: 2 },
  },
  {
    choices: [{ finish_reason: "stop", message: { content: "{}" } }],
    usage: { prompt_tokens: 1, completion_tokens: 2 },
  },
  {
    choices: [
      { finish_reason: "stop", message: { content: JSON.stringify(data) } },
    ],
  },
])("invalid/incomplete provider output is rejected", async (payload) => {
  jest
    .spyOn(global, "fetch")
    .mockResolvedValue(new Response(JSON.stringify(payload)));
  await expect(
    new GroqProvider().generate("fixture", 6000, "openai/gpt-oss-20b"),
  ).rejects.toThrow();
});
test("key test reads model access without a generation request or billing claim", async () => {
  const fetch = jest
    .spyOn(global, "fetch")
    .mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: "openai/gpt-oss-20b" }] })),
    );
  const service = new AiService(
    {} as PrismaService,
    {} as ArticlesService,
    new ConfiguredAiProvider(),
  );
  expect(await service.testConnection()).toMatchObject({
    connected: true,
    provider: "groq",
    generationReady: true,
  });
  expect(fetch.mock.calls[0][0]).toBe("https://api.groq.com/openai/v1/models");
  expect(fetch.mock.calls[0][1]?.body).toBeUndefined();
});
