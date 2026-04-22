import type { CalendarEvent } from '../../../../lib/queries/me-calendar';

export type LaidOutEvent = {
  event: CalendarEvent;
  startMin: number; // 0..1439 minute-of-local-day
  endMin: number;
  lane: number; // 0-indexed
  clusterSize: number; // total lanes in this overlap cluster
};

export type LayoutInput = {
  event: CalendarEvent;
  startMin: number;
  endMin: number;
};

/**
 * Assign each event a lane (column within the day) and a cluster size, so
 * overlapping events render side-by-side Google Calendar style.
 *
 * Algorithm:
 *  1. Sort by startMin asc, then by endMin desc (longer events first on ties).
 *  2. Walk through, assigning each event to the lowest lane whose last event
 *     ended at or before the new event's start. Grow lanes as needed.
 *  3. A "cluster" is a transitive overlap group. Two events are in the same
 *     cluster iff they overlap, or if they both overlap a common third event.
 *     ClusterSize = the maximum lane-index + 1 observed inside the cluster.
 */
export function layoutEventsForDay(input: LayoutInput[]): LaidOutEvent[] {
  if (input.length === 0) return [];

  const sorted = [...input].sort((a, b) => {
    if (a.startMin !== b.startMin) return a.startMin - b.startMin;
    return b.endMin - a.endMin;
  });

  type Placed = LayoutInput & { lane: number; clusterId: number };
  const placed: Placed[] = [];
  const laneEnds: number[] = []; // laneEnds[lane] = latest endMin in that lane
  const clusterEnd: number[] = []; // clusterEnd[id] = max endMin inside cluster
  let currentClusterId = -1;

  for (const ev of sorted) {
    // Assign to the lowest lane whose last event has ended.
    let lane = laneEnds.findIndex((end) => end <= ev.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(ev.endMin);
    } else {
      laneEnds[lane] = ev.endMin;
    }

    // Cluster: if this event overlaps the current cluster's outer bound,
    // keep the same cluster id. Otherwise start a fresh one.
    if (
      currentClusterId === -1 ||
      ev.startMin >= clusterEnd[currentClusterId]!
    ) {
      currentClusterId = clusterEnd.length;
      clusterEnd.push(ev.endMin);
    } else {
      clusterEnd[currentClusterId] = Math.max(
        clusterEnd[currentClusterId]!,
        ev.endMin,
      );
    }

    placed.push({ ...ev, lane, clusterId: currentClusterId });
  }

  // For each cluster, clusterSize = 1 + max(lane) among its events.
  const maxLaneByCluster = new Map<number, number>();
  for (const p of placed) {
    const prev = maxLaneByCluster.get(p.clusterId) ?? -1;
    if (p.lane > prev) maxLaneByCluster.set(p.clusterId, p.lane);
  }

  return placed.map((p) => ({
    event: p.event,
    startMin: p.startMin,
    endMin: p.endMin,
    lane: p.lane,
    clusterSize: (maxLaneByCluster.get(p.clusterId) ?? 0) + 1,
  }));
}
