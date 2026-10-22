export const FIXED_CHARGE_MONTHS = {
  MENSUELLE: 1,
  BIMESTRIELLE: 2,
  TRIMESTRIELLE: 3,
  SEMESTRIELLE: 6,
  ANNUELLE: 12,
} as const;

export type FixedChargePeriodicity = keyof typeof FIXED_CHARGE_MONTHS;

export type FixedChargeAmount = {
  montant: unknown;
  periodicite?: FixedChargePeriodicity;
  pourcentagePersonnel?: unknown;
};

/** Parse persisted two-decimal values without binary floating point rounding. */
export function decimalHundredths(value: unknown): number {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));
  if (match == null) throw new Error("INVALID_FIXED_AMOUNT");
  const units =
    Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(units) || units > 9999999999) {
    throw new Error("INVALID_FIXED_AMOUNT");
  }
  return units;
}

export function personalChargeMinorUnits(
  charge: FixedChargeAmount,
  monthly = true
): number {
  const months = FIXED_CHARGE_MONTHS[charge.periodicite ?? "MENSUELLE"];
  if (months === undefined) throw new Error("INVALID_FIXED_PERIODICITY");
  const share = decimalHundredths(charge.pourcentagePersonnel ?? 100);
  if (share > 10000) throw new Error("INVALID_FIXED_SHARE");
  // At most 9,999,999,999 cents × 10,000 basis points: a safe integer.
  const numerator = decimalHundredths(charge.montant) * share;
  const denominator = 10000 * (monthly ? months : 1);
  return Math.floor((numerator + denominator / 2) / denominator);
}

export const decimalAmount = (minorUnits: number): string =>
  `${Math.floor(minorUnits / 100)}.${String(minorUnits % 100).padStart(
    2,
    "0"
  )}`;

export function chargeAmountFields(charge: FixedChargeAmount) {
  return {
    periodicite: charge.periodicite ?? "MENSUELLE",
    pourcentagePersonnel:
      decimalHundredths(charge.pourcentagePersonnel ?? 100) / 100,
    montantPersonnel: decimalAmount(personalChargeMinorUnits(charge, false)),
    montantMensuelPersonnel: decimalAmount(personalChargeMinorUnits(charge)),
  };
}
