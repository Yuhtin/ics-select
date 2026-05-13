export type ReceiptMode = 'thermal' | 'wrapped';

export type ReceiptMember = {
  userId: string;
  name: string;
  pictureUrl: string | null;
};

export type CycleReceiptResponse = {
  cycle: {
    id: string;
    name: string;
    weekNumber: number;
    weeksTotal: number;
    startsAt: string;
    endsAt: string;
    status: 'ACTIVE' | 'ARCHIVED';
  };
  asOf: string;
  mode: ReceiptMode;

  totals: {
    members: number;
    totalMinutes: number;
    avgMinutesPerMember: number;
    itemsCompleted: number;
    retros: number;
    classesHeld: number;
    classesTotal: number;
    attendanceRate: number;
  };

  byTopic: Array<{
    topicId: string;
    slug: string;
    label: string;
    order: number;
    membersReached: number;
    itemsCompleted: number;
    coveragePct: number;
  }>;

  knowledgeGrid: {
    members: ReceiptMember[];
    topics: Array<{ topicId: string; slug: string; label: string; order: number }>;
    cells: Array<{ userId: string; topicId: string; itemsDone: number; hasStuckOrDoubts: boolean }>;
  };

  topMovers: Array<ReceiptMember & {
    deltaItems: number;
    topTopics: string[];
  }>;

  cycleTopMover: (ReceiptMember & {
    deltaItems: number;
    topTopics: string[];
  }) | null;

  engagementRanking: Array<ReceiptMember & { score: number }>;

  // Hall of Fame achievements — each is a "rare badge" awarded to a single winner.
  streakChampion: (ReceiptMember & { streakDays: number }) | null;
  engagementLeader: (ReceiptMember & { score: number }) | null;
  mostHoursStudied: (ReceiptMember & { minutes: number }) | null;
  mostItemsCompleted: (ReceiptMember & { items: number }) | null;
  polymath: (ReceiptMember & { topics: number }) | null;
  mostActiveDays: (ReceiptMember & { days: number }) | null;
  marathonDay: (ReceiptMember & { date: string; items: number }) | null;
  longestItem: (ReceiptMember & { itemTitle: string; minutes: number }) | null;
  perfectAttendance: ReceiptMember[];
};
