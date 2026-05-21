/**
 * Chi-squared test for A/B experiment significance.
 * Returns { chi_square, p_value, confidence_level, is_significant }
 */
export function chiSquaredTest(
  variants: { label: string; users: number; conversions: number }[],
): {
  chi_square: number;
  p_value: number;
  confidence_level: number;
  is_significant: boolean;
} {
  if (variants.length < 2) {
    return { chi_square: 0, p_value: 1, confidence_level: 0, is_significant: false };
  }

  // Build contingency table
  const totalUsers = variants.reduce((s, v) => s + v.users, 0);
  const totalConversions = variants.reduce((s, v) => s + v.conversions, 0);
  const totalNonConversions = totalUsers - totalConversions;

  if (totalUsers === 0 || totalConversions === 0) {
    return { chi_square: 0, p_value: 1, confidence_level: 0, is_significant: false };
  }

  let chiSquare = 0;
  for (const v of variants) {
    const expectedConv = (v.users / totalUsers) * totalConversions;
    const expectedNonConv = (v.users / totalUsers) * totalNonConversions;

    if (expectedConv > 0) {
      chiSquare += (v.conversions - expectedConv) ** 2 / expectedConv;
    }
    if (expectedNonConv > 0) {
      const nonConv = v.users - v.conversions;
      chiSquare += (nonConv - expectedNonConv) ** 2 / expectedNonConv;
    }
  }

  // Degrees of freedom = (rows - 1) * (cols - 1) = (2-1)*(2-1) = 1
  const df = 1;

  // Approximate p-value from chi-square distribution with 1 df
  // Using the standard normal approximation: z = sqrt(chi_square)
  const z = Math.sqrt(chiSquare);
  const pValue = 2 * (1 - normalCDF(z));

  const confidenceLevel = Math.round((1 - pValue) * 10000) / 100;
  const isSignificant = confidenceLevel >= 95 && variants.every(v => v.users >= 100);

  return {
    chi_square: Math.round(chiSquare * 1000) / 1000,
    p_value: Math.round(pValue * 10000) / 10000,
    confidence_level: confidenceLevel,
    is_significant,
  };
}

// Standard normal CDF approximation (Abramowitz and Stegun)
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1 + sign * y);
}
