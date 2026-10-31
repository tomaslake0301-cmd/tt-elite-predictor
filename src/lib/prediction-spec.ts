
/**
 * TT Elite Series prediction engine
 * Confidence rating is an evidence score, not a guaranteed probability.
 */

export type PlayerForm = {
  matchesPlayed: number;
  overallWinRate: number;
  last10WinRate: number;
  headToHeadWinRate: number;
  divisionAdjustedRating: number;
  dataFreshnessDays: number;
};

export type Prediction = {
  winner: "A" | "B";
  estimatedWinProbability: number;
  confidenceRating: number;
  predictedSets: "3-0" | "3-1" | "3-2";
  eligible: boolean;
  reasons: string[];
};

export function predict(
  a: PlayerForm,
  b: PlayerForm
): Prediction | null {
  if (a.matchesPlayed < 5 || b.matchesPlayed < 5) {
    return null;
  }

  const score = (p: PlayerForm) =>
    0.35 * p.overallWinRate +
    0.25 * p.last10WinRate +
    0.15 * p.headToHeadWinRate +
    0.25 * p.divisionAdjustedRating / 100;

  const sa = score(a);
  const sb = score(b);
  const winner = sa >= sb ? "A" : "B";
  const gap = Math.abs(sa - sb);

  const evidence = Math.min(
    1,
    (a.matchesPlayed + b.matchesPlayed) / 60
  );

  const freshness = Math.max(
    0,
    1 - Math.max(a.dataFreshnessDays, b.dataFreshnessDays) / 45
  );

  const confidenceRating = Math.max(
    0,
    Math.min(100, Math.round(45 + gap * 100 + evidence * 20 + freshness * 10))
  );

  const probabilityA = 1 / (1 + Math.exp(-8 * (sa - sb)));
  const probability = winner === "A" ? probabilityA : 1 - probabilityA;

  const predictedSets =
    probability >= 0.82 ? "3-0" :
    probability >= 0.68 ? "3-1" : "3-2";

  return {
    winner,
    estimatedWinProbability: probability,
    confidenceRating,
    predictedSets,
    eligible: true,
    reasons: [
      "Overall win rate",
      "Last 10 matches",
      "Head-to-head",
      "Division-adjusted rating",
      "Data freshness"
    ]
  };
}
