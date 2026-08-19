const DAY_MS = 86_400_000;
const GRACE_MS = 3 * 60 * 60 * 1000;
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export type SegmentCharge = {
  rentalDays: number;
  rentalCharge: number;
  allowedKilometers: number;
  extraKilometers: number;
  extraKmCharge: number;
};

export function calculateSegmentCharge(input: {
  startAt: string | Date;
  endAt: string | Date;
  dailyRate: number;
  startingKilometer: number;
  endingKilometer: number;
  allowedKmPerDay: number;
  extraKmRate: number;
}) : SegmentCharge {
  const start = input.startAt instanceof Date ? input.startAt : new Date(input.startAt);
  const end = input.endAt instanceof Date ? input.endAt : new Date(input.endAt);
  const elapsed = Math.max(0, end.getTime() - start.getTime());
  const chargeableElapsed = Math.max(0, elapsed - GRACE_MS);
  const rentalDays = Math.max(1, Math.ceil(chargeableElapsed / DAY_MS));
  const rentalCharge = roundMoney(rentalDays * Math.max(0, input.dailyRate));
  const allowedKilometers = Math.max(0, Math.round(rentalDays * Math.max(0, input.allowedKmPerDay)));
  const travelled = Math.max(0, Math.round(input.endingKilometer - input.startingKilometer));
  const extraKilometers = Math.max(0, travelled - allowedKilometers);
  const extraKmCharge = roundMoney(extraKilometers * Math.max(0, input.extraKmRate));
  return { rentalDays, rentalCharge, allowedKilometers, extraKilometers, extraKmCharge };
}

export function roundFinalPayable(value: number) {
  return Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
}
