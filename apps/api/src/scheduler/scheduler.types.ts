export type AvailabilitySlotInput = {
  dayOfWeek: number;   // 0..6, 0 = Monday
  startMinute: number; // minute of local day
  endMinute: number;
};

export type BusyBlock = { start: Date; end: Date };

export type ItemInput = {
  id: string;
  estimatedMinutes: number;
  order: number; // admin's WeeklyPlanItem.order
};

export type SchedulerInput = {
  weekStart: Date;
  availability: {
    slots: AvailabilitySlotInput[];
    caps: (number | null)[];  // length 7, index 0=Mon, null = no cap
    preferredSessionMinutes: number;
    timezone: string;
  };
  busyBlocks: BusyBlock[];
  items: ItemInput[];
  now?: Date;
};

export type PlannedSession = {
  itemId: string;
  scheduledAt: Date;
  durationMinutes: number;
};

export type OverflowChunk = { itemId: string; minutesRequired: number };

export type SchedulerDiagnostics = {
  phase1Cost: number;
  finalCost: number;
  nodesExplored: number;
  timedOut: boolean;
  durationMs: number;
};

export type SchedulerOutput = {
  sessions: PlannedSession[];
  overflow: OverflowChunk[];
  diagnostics: SchedulerDiagnostics;
};

// Internal types (exported for unit tests of the objective / solver pieces)

export type EffectiveInterval = {
  dayIdx: number;      // 0..6
  startMinute: number; // minute of local day
  endMinute: number;
  slotSize: number;    // size of parent slot (pre-busy), used for rule iii
};

export type Chunk = {
  itemId: string;
  order: number;
  minutes: number;
  isResidue: boolean;  // true iff this chunk is < preferredSessionMinutes AND is a tail chunk
};

export type Placement = {
  chunk: Chunk;
  intervalIdx: number;
  offsetInInterval: number; // minutes into the interval where the chunk starts
};

export type Solution = {
  placements: Placement[];
  unplaced: Chunk[];
};
