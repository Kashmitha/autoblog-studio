/** Read at request time so API, worker and readiness use the same provider gates. */
export function aiConfiguration() {
  const provider = process.env.AI_PROVIDER || "openai";
  const free = provider === "groq" && process.env.GROQ_PLAN === "free";
  const key =
    provider === "groq" ? process.env.GROQ_API_KEY : process.env.AI_API_KEY;
  const model =
    provider === "groq"
      ? process.env.GROQ_MODEL || "openai/gpt-oss-20b"
      : process.env.AI_MODEL || "gpt-4.1-mini";
  const inputRate = free ? 0 : Number(process.env.AI_INPUT_USD_PER_MILLION);
  const outputRate = free ? 0 : Number(process.env.AI_OUTPUT_USD_PER_MILLION);
  const monthlyLimit = Number(process.env.AI_MONTHLY_LIMIT_USD || 3);
  const dailyLimit = Number(process.env.AI_DAILY_GENERATION_LIMIT || 2);
  const maxTokens = Number(
    process.env.AI_MAX_OUTPUT_TOKENS || (provider === "groq" ? 6000 : 2400),
  );
  const blockers: string[] = [];
  if (!["openai", "groq"].includes(provider))
    blockers.push("Choose AI_PROVIDER=openai or groq in private .env.");
  if (
    provider === "groq" &&
    !["free", "paid"].includes(process.env.GROQ_PLAN || "")
  )
    blockers.push("Set GROQ_PLAN=free or paid to match your Groq account.");
  if (process.env.AI_ENABLED !== "true")
    blockers.push(
      "Text generation is disabled. Set AI_ENABLED=true when ready.",
    );
  if (!key?.trim())
    blockers.push(
      `Configure ${provider === "groq" ? "GROQ_API_KEY" : "AI_API_KEY"} privately on the backend.`,
    );
  if (free) {
    if (process.env.GROQ_FREE_TIER_CONFIRMED !== "true")
      blockers.push(
        "Verify your Groq account is on the Free plan, then set GROQ_FREE_TIER_CONFIRMED=true. Studio cannot verify your account's billing plan.",
      );
  } else if (process.env.AI_BILLING_AUTHORIZED !== "true")
    blockers.push(
      "Paid AI is disabled. Explicit API billing authorization is required for a paid provider.",
    );
  if (
    !free &&
    ![inputRate, outputRate].every((v) => Number.isFinite(v) && v > 0)
  )
    blockers.push("Set valid current provider input and output token prices.");
  if (
    !Number.isFinite(monthlyLimit) ||
    monthlyLimit <= 0 ||
    !Number.isInteger(dailyLimit) ||
    dailyLimit < 1 ||
    dailyLimit > 20 ||
    !Number.isInteger(maxTokens) ||
    maxTokens < 1 ||
    maxTokens > 10000
  )
    blockers.push(
      "Set valid spending, daily request and output token limits (maximum 10,000 output tokens).",
    );
  if (
    provider === "groq" &&
    !["openai/gpt-oss-20b", "openai/gpt-oss-120b"].includes(model)
  )
    blockers.push(
      "Choose a supported Groq structured-output model: openai/gpt-oss-20b or openai/gpt-oss-120b.",
    );
  return {
    provider,
    free,
    model,
    configured: !!key?.trim(),
    ready: blockers.length === 0,
    blockers,
    inputRate,
    outputRate,
    monthlyLimit,
    dailyLimit,
    maxTokens,
    usageModel: provider === "groq" ? `groq/${model}` : model,
  };
}
