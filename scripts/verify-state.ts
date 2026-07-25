import assert from "node:assert/strict";
import { createSeedState } from "../src/lib/seed";
import {
  buildCareerTrajectory,
  rockedinReducer,
} from "../src/lib/state";
import {
  SceneEventResultSchema,
  type SceneEventResult,
} from "../src/lib/schemas";

const seed = createSeedState();
const renamed = rockedinReducer(seed, {
  type: "UPDATE_PROFILE_NAME",
  name: "  Batu   Stonewell  ",
});

assert.equal(seed.profile.name, "Batu Bin Granite");
assert.equal(renamed.profile.name, "Batu Stonewell");

const result: Extract<SceneEventResult, { kind: "event" }> = {
  kind: "event",
  scene: {
    primaryRockDetected: true,
    objects: ["books", "rock"],
    spatialRelationship: "Batu is on stacked books beside another rock.",
    changeFromPrevious: "Batu moved upward and gained a nearby rock.",
    confidence: 0.96,
  },
  careerEvent: {
    eventType: "promotion",
    physicalTrigger: "Rock on stacked books beside another rock",
    newTitle: "Upper Management",
    profileHeadline: "Elevated leadership with aggregate reach.",
    postBody:
      "Humbled to enter Upper Management after a visible elevation onto stacked books. I also expanded my mineral network and completed executive education while maintaining disciplined stillness and delivering grounded outcomes for every stakeholder below me today.",
    hashtags: ["#Leadership", "#CareerGrowth"],
    skillsAdded: ["Executive Elevation"],
    certification: {
      name: "Six Sigma Gravel Belt",
      issuer: "Qwen Executive School of Sedimentary Leadership",
      description: "Certified in grounded operational excellence.",
    },
    connection: {
      name: "Pebble Tan",
      title: "Sedimentary Strategy Lead",
      relationship: "Professional networking contact",
    },
    comments: [
      {
        author: "Quartz Recruiter",
        title: "Mineral Talent Partner",
        text: "A visibly elevated appointment.",
        reaction: "Solid",
      },
      {
        author: "Gravel, MBA",
        title: "Aggregate Thought Leader",
        text: "This is leadership with weight.",
        reaction: "Hard Agree",
      },
    ],
    analyticsDelta: {
      connections: 0,
      profileViews: 20,
      impressions: 120,
      surfacesOccupied: 1,
      relocations: 1,
      promotions: 1,
    },
    careerLevelDelta: 4,
  },
  agentReceipt: {
    sceneSummary: "Rock on stacked books beside another rock",
    careerSummary: "Promoted to Upper Management and networked",
    materialsCreated: ["Title", "Post", "Certification", "Connection"],
    profileChanges: ["Profile", "History", "Analytics"],
  },
};

const promoted = rockedinReducer(seed, {
  type: "APPLY_SCENE_EVENT",
  result,
  model: "qwen3.7-plus",
  latencyMs: 4200,
  imageDataUrl: "data:image/jpeg;base64,AA==",
  now: "2026-07-25T05:00:00.000Z",
});

assert.equal(seed.profile.currentTitle, "Unemployed Mineral");
assert.equal(promoted.profile.currentTitle, "Upper Management");
assert.equal(promoted.profile.connections, 500);
assert.equal(promoted.profile.careerLevel, 4);
assert.equal(promoted.certifications.length, 1);
assert.equal(promoted.connections.length, 1);
assert.equal(promoted.posts.length, 1);

const duplicated = rockedinReducer(promoted, {
  type: "APPLY_SCENE_EVENT",
  result,
  model: "qwen3.7-plus",
  latencyMs: 4100,
  imageDataUrl: "data:image/jpeg;base64,AA==",
  now: "2026-07-25T05:01:00.000Z",
});

assert.equal(duplicated.certifications.length, 1);
assert.equal(duplicated.connections.length, 1);
assert.equal(duplicated.profile.connections, 500);

const nonCanonicalResult: Extract<SceneEventResult, { kind: "event" }> =
  structuredClone(result);
nonCanonicalResult.scene.objects = ["rock", "coffee mug"];
nonCanonicalResult.scene.spatialRelationship =
  "Batu is beside a coffee mug on a desk.";
nonCanonicalResult.scene.changeFromPrevious =
  "Batu moved from the books to a desk beside a mug.";
nonCanonicalResult.scene.confidence = 0.43;
nonCanonicalResult.careerEvent.eventType = "position";
nonCanonicalResult.careerEvent.physicalTrigger =
  "Rock positioned beside a coffee mug";
nonCanonicalResult.careerEvent.newTitle =
  "Chief Beverage Proximity Officer";
nonCanonicalResult.careerEvent.profileHeadline =
  "Building cross-functional alignment between minerals and beverages.";
nonCanonicalResult.careerEvent.postBody =
  "Excited to begin a new chapter as Chief Beverage Proximity Officer after establishing a visible desk-side partnership with a coffee mug. This position expands my remit into refreshment-adjacent strategy while preserving the grounded leadership and disciplined stillness expected by stakeholders.";
nonCanonicalResult.careerEvent.certification = null;
nonCanonicalResult.careerEvent.connection = null;
nonCanonicalResult.careerEvent.careerLevelDelta = 1;
nonCanonicalResult.agentReceipt.sceneSummary =
  "Batu is beside a coffee mug.";
nonCanonicalResult.agentReceipt.careerSummary =
  "Appointed Chief Beverage Proximity Officer.";

const nonCanonical = rockedinReducer(promoted, {
  type: "APPLY_SCENE_EVENT",
  result: nonCanonicalResult,
  model: "qwen3.7-plus",
  latencyMs: 12_400,
  imageDataUrl: "data:image/jpeg;base64,AA==",
  now: "2026-07-25T05:01:30.000Z",
});

assert.equal(
  nonCanonical.profile.currentTitle,
  "Chief Beverage Proximity Officer",
);
assert.equal(
  nonCanonical.profile.careerHistory[0].title,
  "Chief Beverage Proximity Officer",
);
assert.deepEqual(
  buildCareerTrajectory(nonCanonical.profile).map((item) => item.title),
  [
    "Unemployed Mineral",
    "Upper Management",
    "Chief Beverage Proximity Officer",
  ],
);

const providerConnectionVariant = structuredClone(nonCanonicalResult) as
  unknown as Record<string, unknown>;
(
  (providerConnectionVariant.careerEvent as Record<string, unknown>)
    .connection as Record<string, unknown>
) = {
  name: "Mugsworth Ceramica",
  title: "Senior Vessel",
  company: "Yellow Cup Industries",
};
const normalizedProviderVariant = SceneEventResultSchema.parse(
  providerConnectionVariant,
);
assert.equal(
  normalizedProviderVariant.kind === "event"
    ? normalizedProviderVariant.careerEvent.connection?.relationship
    : undefined,
  "Professional contact at Yellow Cup Industries",
);

const finale = rockedinReducer(promoted, {
  type: "APPLY_HUMAN_REVIEW",
  now: "2026-07-25T05:02:00.000Z",
  result: {
    score: 42,
    observations: [
      "Moved Batu adequately.",
      "Required repeated prompting.",
      "Demonstrated limited strategic stillness.",
    ],
    recommendation: "Place the human on a Performance Improvement Plan.",
    humanNewTitle: "Executive Rock Mobility Associate",
    batuFinalTitle: "Human's Manager",
    finalPost:
      "My human has accepted a new position as Executive Rock Mobility Associate. The role is unpaid, but the exposure will be invaluable.",
  },
});

assert.equal(finale.profile.currentTitle, "Human's Manager");
assert.equal(finale.profile.careerLevel, 7);
assert.equal(finale.posts[0].eventType, "takeover");
assert.equal(rockedinReducer(finale, { type: "RESET" }).profile.connections, 499);

console.log(
  "Reducer verification passed: profile rename, atomic mutation, deduplication, 499->500, finale, reset.",
);
