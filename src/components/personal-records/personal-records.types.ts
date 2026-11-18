export interface SetRow {
  weightKg: number;
  reps: number;
  performedAt: Date;
}

export interface PersonalRecord {
  value: number;
  date: string;
}

export interface PrBlock {
  heaviestSet: PersonalRecord | null;
  highestVolume: PersonalRecord | null;
  bestEstimated1RM: PersonalRecord | null;
}

export interface FindSetRowsParams {
  userId: string;
  exerciseId: string;
  from?: string;
  to?: string;
}
