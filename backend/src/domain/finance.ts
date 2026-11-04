export function summarizeFinance(
  entries: { kind: string; amount: unknown }[],
  pageviews: number | null,
  aiCost = 0,
) {
  const sum = (kind: string) =>
    entries
      .filter((e) => e.kind === kind)
      .reduce((n, e) => n + Number(e.amount), 0);
  const actualRevenue = sum("ACTUAL_REVENUE"),
    estimatedRevenue = sum("ESTIMATED_REVENUE"),
    expenses = sum("EXPENSE") + aiCost;
  return {
    actualRevenue,
    estimatedRevenue,
    expenses,
    aiCost,
    netProfit: actualRevenue - expenses,
    rpm: pageviews && pageviews > 0 ? (actualRevenue / pageviews) * 1000 : null,
    breakEvenRevenue: Math.max(0, expenses - actualRevenue),
    currency: "USD",
    source:
      "Calculated from owner-entered/imported records and recorded AI usage; estimates excluded from profit",
  };
}
