export type AvailabilitySlotInput = {
  dayOfWeek: number;   // 0..6, 0 = Monday
  startMinute: number; // [0, 1410], multiple of 30
  endMinute: number;   // [30, 1440], multiple of 30, > startMinute
};

export type AvailabilityPatchInput = {
  mondayMinutes?: number | null;
  tuesdayMinutes?: number | null;
  wednesdayMinutes?: number | null;
  thursdayMinutes?: number | null;
  fridayMinutes?: number | null;
  saturdayMinutes?: number | null;
  sundayMinutes?: number | null;
  preferredSessionMinutes?: number;
  timezone?: string;
  slots?: AvailabilitySlotInput[];
  clearDays?: number[]; // weekdays whose slots should be wiped
};

export type AvailabilityFullResponse = {
  mondayMinutes: number | null;
  tuesdayMinutes: number | null;
  wednesdayMinutes: number | null;
  thursdayMinutes: number | null;
  fridayMinutes: number | null;
  saturdayMinutes: number | null;
  sundayMinutes: number | null;
  preferredSessionMinutes: number;
  timezone: string;
  slots: Array<{
    id: string;
    dayOfWeek: number;
    startMinute: number;
    endMinute: number;
  }>;
};
