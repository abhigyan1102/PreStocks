export interface RadarCandidate {
  id: string;
  slug: string;
  name: string;
  description: string;
  displayOrder: number;
  totalPoints: number;
  allocatingWallets: number;
  holderPoints: number;
  holderWallets: number;
  communityPoints: number;
  communityWallets: number;
}

export interface RadarBoard {
  metrics: {
    signedParticipants: number;
    currentHolderParticipants: number;
    currentSubmissions: number;
    latestUpdate: string | null;
  };
  candidates: RadarCandidate[];
}

export interface RadarAllocation { candidateId: string; points: number }

export function parseSubmission(input: unknown, candidates: Pick<RadarCandidate, "id">[]): {
  allocations: RadarAllocation[];
  reason: string;
} {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Malformed submission");
  const body = input as Record<string, unknown>;
  if (!Array.isArray(body.allocations) || body.allocations.length < 1 ||
      body.allocations.length > candidates.length || typeof body.reason !== "string") {
    throw new Error("Malformed submission");
  }
  const reason = body.reason.trim();
  if (reason.length < 1 || reason.length > 220 || /[\u0000-\u001f\u007f]/.test(reason)) {
    throw new Error("Reason must be one short sentence of at most 220 characters");
  }
  const known = new Set(candidates.map((candidate) => candidate.id));
  const seen = new Set<string>();
  const allocations: RadarAllocation[] = [];
  for (const item of body.allocations) {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Malformed allocation");
    const entry = item as Record<string, unknown>;
    if (typeof entry.candidateId !== "string" || !known.has(entry.candidateId) ||
        seen.has(entry.candidateId)) throw new Error("Unknown, inactive, or duplicate candidate");
    if (!Number.isInteger(entry.points) || (entry.points as number) < 0 || (entry.points as number) > 100) {
      throw new Error("Signal points must be whole numbers from 0 to 100");
    }
    seen.add(entry.candidateId);
    if ((entry.points as number) > 0) allocations.push({ candidateId: entry.candidateId, points: entry.points as number });
  }
  if (allocations.reduce((sum, item) => sum + item.points, 0) !== 100) {
    throw new Error("Allocate exactly 100 signal points");
  }
  return { allocations, reason };
}

export function ensureUnofficialCandidates(candidateNames: string[], officialNames: string[]): void {
  const official = new Set(officialNames.map((name) => name.trim().toLowerCase()));
  if (candidateNames.some((name) => official.has(name.trim().toLowerCase()))) {
    throw new Error("Candidate registry overlaps an official PreStocks asset");
  }
}
