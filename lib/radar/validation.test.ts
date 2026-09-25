import assert from "node:assert/strict";
import test from "node:test";
import { ensureUnofficialCandidates, parseSubmission } from "./validation";

const candidates = [{ id: "stripe" }, { id: "canva" }];
const submission = (stripe: unknown, canva: unknown, reason = "Payments infrastructure matters.") => ({
  allocations: [{ candidateId: "stripe", points: stripe }, { candidateId: "canva", points: canva }], reason,
});

test("exactly 100 whole signal points are accepted, including a zero candidate", () => {
  assert.deepEqual(parseSubmission(submission(100, 0), candidates).allocations, [{ candidateId: "stripe", points: 100 }]);
  assert.deepEqual(parseSubmission(submission(40, 60), candidates).allocations, [
    { candidateId: "stripe", points: 40 }, { candidateId: "canva", points: 60 },
  ]);
});

test("99, 101, negative, fractional, unknown, inactive, and duplicate candidates fail", () => {
  assert.throws(() => parseSubmission(submission(99, 0), candidates), /exactly 100/);
  assert.throws(() => parseSubmission(submission(100, 1), candidates), /exactly 100/);
  assert.throws(() => parseSubmission(submission(-1, 101), candidates), /whole numbers/);
  assert.throws(() => parseSubmission(submission(50.5, 49.5), candidates), /whole numbers/);
  assert.throws(() => parseSubmission({ allocations: [{ candidateId: "unknown", points: 100 }], reason: "Reason." }, candidates), /Unknown/);
  assert.throws(() => parseSubmission({ allocations: [{ candidateId: "canva", points: 100 }], reason: "Reason." }, [{ id: "stripe" }]), /Unknown/);
  assert.throws(() => parseSubmission({ allocations: [{ candidateId: "stripe", points: 50 },
    { candidateId: "stripe", points: 50 }], reason: "Reason." }, candidates), /duplicate/);
});

test("oversized reason and malformed payload fail", () => {
  assert.throws(() => parseSubmission(submission(100, 0, "x".repeat(221)), candidates), /220/);
  assert.throws(() => parseSubmission({ allocations: "100", reason: "Reason." }, candidates), /Malformed/);
  assert.throws(() => parseSubmission(null, candidates), /Malformed/);
});

test("curated names cannot overlap official PreStocks names", () => {
  assert.doesNotThrow(() => ensureUnofficialCandidates(["Stripe"], ["SpaceX PreStocks"]));
  assert.throws(() => ensureUnofficialCandidates(["SpaceX PreStocks"], ["spacex prestocks"]), /overlaps/);
});
