import { z } from "zod";

const shortText = z.string().trim().min(1).max(180);
const paragraph = z.string().trim().min(1).max(700);
const imageDataUrl = z
  .string()
  .max(1_400_000)
  .regex(/^data:image\/(?:jpeg|png|webp);base64,/);

const wordCount = (value: string) =>
  value.trim().split(/\s+/).filter(Boolean).length;
const conciseParagraph = (maximumWords: number) =>
  paragraph.refine((value) => wordCount(value) <= maximumWords, {
    message: `Text must contain no more than ${maximumWords} words.`,
  });

export const CareerEventTypeSchema = z.enum([
  "position",
  "promotion",
  "pivot",
  "networking",
  "certification",
  "crisis",
  "deep_work",
  "takeover",
]);

export const CareerHistoryItemSchema = z
  .object({
    id: z.string().min(1).max(120),
    title: shortText,
    summary: paragraph,
    physicalTrigger: shortText,
    createdAt: z.string().datetime(),
  })
  .strict();

export const RockProfileSchema = z
  .object({
    name: shortText,
    currentTitle: shortText,
    headline: paragraph,
    location: shortText,
    experienceLabel: shortText,
    connections: z.number().int().min(0).max(100_000),
    thoughts: z.number().int().min(0).max(100_000),
    netWorthGrams: z.number().min(0).max(1_000_000),
    inactivityUptime: z.number().min(0).max(100),
    careerLevel: z.number().int().min(0).max(7),
    skills: z.array(shortText).max(30),
    careerHistory: z.array(CareerHistoryItemSchema).max(80),
  })
  .strict();

export const CertificationSchema = z
  .object({
    id: z.string().min(1).max(120),
    name: shortText,
    issuer: shortText,
    description: paragraph,
    createdAt: z.string().datetime(),
  })
  .strict();

export const ConnectionSchema = z
  .object({
    id: z.string().min(1).max(120),
    name: shortText,
    title: shortText,
    relationship: shortText,
    createdAt: z.string().datetime(),
  })
  .strict();

export const RockAnalyticsSchema = z
  .object({
    profileViews: z.number().int().min(0).max(10_000_000),
    impressions: z.number().int().min(0).max(100_000_000),
    surfacesOccupied: z.number().int().min(0).max(100_000),
    relocations: z.number().int().min(0).max(100_000),
    promotions: z.number().int().min(0).max(100_000),
  })
  .strict();

export const CareerCommentSchema = z
  .object({
    author: shortText,
    title: shortText,
    text: paragraph,
    reaction: shortText,
  })
  .strict();

export const CareerPostSchema = z
  .object({
    id: z.string().min(1).max(120),
    eventType: CareerEventTypeSchema,
    titleAtPublication: shortText,
    physicalTrigger: shortText,
    body: paragraph,
    hashtags: z.array(z.string().trim().min(1).max(48)).max(4),
    comments: z.array(CareerCommentSchema).length(2),
    solidCount: z.number().int().min(0).max(1_000_000),
    commentCount: z.number().int().min(0).max(100_000),
    imageDataUrl: imageDataUrl.optional(),
    createdAt: z.string().datetime(),
  })
  .strict();

export const AgentReceiptSchema = z
  .object({
    model: shortText,
    sceneSummary: conciseParagraph(18),
    careerSummary: conciseParagraph(18),
    materialsCreated: z.array(shortText).max(8),
    profileChanges: z.array(shortText).max(8),
    latencyMs: z.number().int().min(0).max(120_000),
    live: z.boolean(),
    createdAt: z.string().datetime(),
  })
  .strict();

export const HumanReviewResultSchema = z
  .object({
    score: z.number().int().min(0).max(100),
    observations: z.tuple([
      conciseParagraph(24),
      conciseParagraph(24),
      conciseParagraph(24),
    ]),
    recommendation: conciseParagraph(45),
    humanNewTitle: shortText,
    batuFinalTitle: shortText,
    finalPost: paragraph.refine((value) => wordCount(value) <= 65, {
      message: "Final post must contain no more than 65 words.",
    }),
  })
  .strict();

export const RockedInStateSchema = z
  .object({
    profile: RockProfileSchema,
    certifications: z.array(CertificationSchema).max(30),
    connections: z.array(ConnectionSchema).max(60),
    analytics: RockAnalyticsSchema,
    posts: z.array(CareerPostSchema).max(80),
    lastAgentReceipt: AgentReceiptSchema.optional(),
    finale: HumanReviewResultSchema.optional(),
  })
  .strict();

const SceneEvidenceSchema = z
  .object({
    primaryRockDetected: z.boolean(),
    objects: z.array(shortText).max(12),
    spatialRelationship: paragraph,
    changeFromPrevious: paragraph,
    confidence: z.number().min(0).max(1),
  })
  .strict();

const AgentReceiptResultSchema = z
  .object({
    sceneSummary: conciseParagraph(18),
    careerSummary: conciseParagraph(18),
    materialsCreated: z.array(shortText).max(8),
    profileChanges: z.array(shortText).max(8),
  })
  .strict();

const AnalyticsDeltaSchema = z
  .object({
    connections: z.number().int().min(0).max(1000),
    profileViews: z.number().int().min(0).max(100_000),
    impressions: z.number().int().min(0).max(1_000_000),
    surfacesOccupied: z.number().int().min(0).max(1000),
    relocations: z.number().int().min(0).max(1000),
    promotions: z.number().int().min(0).max(1000),
  })
  .strict();

const GeneratedConnectionSchema = z
  .object({
    name: shortText,
    title: shortText,
    relationship: shortText.optional(),
    company: shortText.optional(),
  })
  .strict()
  .transform(({ name, title, relationship, company }) => ({
    name,
    title,
    relationship:
      relationship ??
      (company ? `Professional contact at ${company}` : "Professional connection"),
  }));

const EventCareerResultSchema = z
  .object({
    eventType: CareerEventTypeSchema,
    physicalTrigger: shortText,
    newTitle: shortText,
    profileHeadline: paragraph,
    postBody: paragraph.refine(
      (value) => {
        const count = wordCount(value);
        return count >= 25 && count <= 60;
      },
      { message: "Post body must contain 25 to 60 words." },
    ),
    hashtags: z.array(z.string().trim().min(1).max(48)).max(4),
    skillsAdded: z.array(shortText).max(3),
    certification: z
      .object({
        name: shortText,
        issuer: shortText,
        description: paragraph,
      })
      .strict()
      .nullable(),
    connection: GeneratedConnectionSchema.nullable(),
    comments: z.array(CareerCommentSchema).length(2),
    analyticsDelta: AnalyticsDeltaSchema,
    careerLevelDelta: z.number().int().min(-2).max(3),
  })
  .strict();

export const SceneEventResultSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("event"),
      scene: SceneEvidenceSchema,
      careerEvent: EventCareerResultSchema,
      agentReceipt: AgentReceiptResultSchema,
    })
    .strict()
    .superRefine((value, context) => {
      if (!value.scene.primaryRockDetected) {
        context.addIssue({
          code: "custom",
          message: "A career event requires a detected primary rock.",
        });
      }
    }),
  z
    .object({
      kind: z.literal("none"),
      scene: SceneEvidenceSchema,
      reason: paragraph,
      agentReceipt: AgentReceiptResultSchema,
    })
    .strict(),
]);

const AgentStateContextSchema = z
  .object({
    profile: RockProfileSchema,
    recentEvents: z.array(CareerHistoryItemSchema).max(6),
    certifications: z.array(CertificationSchema).max(30),
    connections: z.array(ConnectionSchema).max(60),
    analytics: RockAnalyticsSchema,
  })
  .strict();

export const AgentRequestSchema = z.discriminatedUnion("mode", [
  AgentStateContextSchema.extend({
    mode: z.literal("scene_event"),
    currentImageDataUrl: imageDataUrl,
    previousImageDataUrl: imageDataUrl.optional(),
  }).strict(),
  AgentStateContextSchema.extend({
    mode: z.literal("human_review"),
  }).strict(),
]);

export const SceneApiSuccessSchema = z
  .object({
    ok: z.literal(true),
    mode: z.literal("scene_event"),
    result: SceneEventResultSchema,
    model: shortText,
    latencyMs: z.number().int().min(0).max(120_000),
    live: z.literal(true),
  })
  .strict();

export const HumanReviewApiSuccessSchema = z
  .object({
    ok: z.literal(true),
    mode: z.literal("human_review"),
    result: HumanReviewResultSchema,
    model: shortText,
    latencyMs: z.number().int().min(0).max(120_000),
    live: z.literal(true),
  })
  .strict();

export const ApiErrorSchema = z
  .object({
    ok: z.literal(false),
    error: z
      .object({
        code: z.string().min(1).max(80),
        message: z.string().min(1).max(300),
        retryable: z.boolean(),
      })
      .strict(),
  })
  .strict();

export const AgentApiResponseSchema = z.union([
  SceneApiSuccessSchema,
  HumanReviewApiSuccessSchema,
  ApiErrorSchema,
]);

export const HealthApiResponseSchema = z.union([
  z
    .object({
      ok: z.literal(true),
      status: z.literal("rock solid"),
      model: shortText,
      models: z
        .object({
          scene: shortText,
          humanReview: shortText,
        })
        .strict(),
      latencyMs: z.number().int().min(0).max(120_000),
      checkedAt: z.string().datetime(),
      live: z.literal(true),
    })
    .strict(),
  ApiErrorSchema,
]);

export const PersistedStateSchema = z
  .object({
    version: z.literal(1),
    state: RockedInStateSchema,
  })
  .strict();

export type CareerEventType = z.infer<typeof CareerEventTypeSchema>;
export type CareerHistoryItem = z.infer<typeof CareerHistoryItemSchema>;
export type RockProfile = z.infer<typeof RockProfileSchema>;
export type Certification = z.infer<typeof CertificationSchema>;
export type Connection = z.infer<typeof ConnectionSchema>;
export type RockAnalytics = z.infer<typeof RockAnalyticsSchema>;
export type CareerComment = z.infer<typeof CareerCommentSchema>;
export type CareerPost = z.infer<typeof CareerPostSchema>;
export type AgentReceipt = z.infer<typeof AgentReceiptSchema>;
export type HumanReviewResult = z.infer<typeof HumanReviewResultSchema>;
export type RockedInState = z.infer<typeof RockedInStateSchema>;
export type SceneEventResult = z.infer<typeof SceneEventResultSchema>;
export type AgentRequest = z.infer<typeof AgentRequestSchema>;
export type AgentApiResponse = z.infer<typeof AgentApiResponseSchema>;
export type HealthApiResponse = z.infer<typeof HealthApiResponseSchema>;
