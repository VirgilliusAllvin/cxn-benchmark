import { DIMENSIONS, CRITERIA, CRITERIA_BY_DIMENSION, DEFAULT_DIMENSION_WEIGHTS } from './data';
import type { BankData } from './types';

// Average score for a dimension (0–5), excluding unevaluated criteria (score=0)
export function dimensionScore(bankData: BankData, dimensionId: string): number {
  const criteria = CRITERIA_BY_DIMENSION[dimensionId] ?? [];
  if (criteria.length === 0) return 0;
  const scores = criteria
    .map(c => bankData.criterionScores?.[c.id]?.score ?? 0)
    .filter(s => s > 0); // 0 = not evaluated → excluded from average
  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

// Weighted global score (0–5)
export function globalScore5(
  bankData: BankData,
  dimensionWeights: Record<string, number> = DEFAULT_DIMENSION_WEIGHTS,
): number {
  return DIMENSIONS.reduce((sum, dim) => {
    const w = (dimensionWeights[dim.id] ?? DEFAULT_DIMENSION_WEIGHTS[dim.id] ?? 0) / 100;
    return sum + dimensionScore(bankData, dim.id) * w;
  }, 0);
}

// Convert 0–5 → 0–100
export function globalScore100(
  bankData: BankData,
  dimensionWeights: Record<string, number> = DEFAULT_DIMENSION_WEIGHTS,
): number {
  return Math.round(globalScore5(bankData, dimensionWeights) * 20 * 10) / 10;
}

// Number of criteria with score > 0
export function evaluatedCriterionCount(bankData: BankData): number {
  return CRITERIA.filter(c => (bankData.criterionScores?.[c.id]?.score ?? 0) > 0).length;
}

// Evidence count
export function evidenceCount(bankData: BankData): number {
  return Object.values(bankData.criterionScores ?? {}).reduce(
    (sum, cs) => sum + (cs.evidences?.length ?? 0), 0,
  );
}

// Rank array (sorted by globalScore100 desc)
export function rankBanks(
  allBanks: { id: string; data: BankData }[],
  dimensionWeights: Record<string, number> = DEFAULT_DIMENSION_WEIGHTS,
): { id: string; data: BankData; score: number; rank: number }[] {
  const scored = allBanks.map(b => ({ ...b, score: globalScore100(b.data, dimensionWeights) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.map((b, i) => ({ ...b, rank: i + 1 }));
}

// Market average per dimension (0–5)
export function marketDimensionAvg(allBanks: BankData[], dimensionId: string): number {
  if (allBanks.length === 0) return 0;
  const scores = allBanks.map(b => dimensionScore(b, dimensionId));
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

// Score color helpers (0–100 scale)
export function scoreColor(score: number): string {
  if (score === 0) return '#494949';
  if (score < 20)  return '#ef4444';
  if (score < 40)  return '#f97316';
  if (score < 60)  return '#eab308';
  if (score < 80)  return '#22c55e';
  return '#1ddbb1';
}

export function scoreColor5(score: number): string {
  if (score === 0) return '#494949';
  if (score < 1)   return '#ef4444';
  if (score < 2)   return '#f97316';
  if (score < 3)   return '#eab308';
  if (score < 4)   return '#22c55e';
  return '#1ddbb1';
}

export function scoreBg(score: number): string {
  if (score === 0) return '#f3f4f6';
  if (score < 20)  return '#fef2f2';
  if (score < 40)  return '#fff7ed';
  if (score < 60)  return '#fefce8';
  if (score < 80)  return '#f0fdf4';
  return '#f0fdfa';
}
