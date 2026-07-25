import type {
  CareerHistoryItem,
  HumanReviewResult,
  RockProfile,
  RockedInState,
  SceneEventResult,
} from "@/lib/schemas";
import { createSeedState } from "@/lib/seed";

export const CAREER_STAGES = [
  "Unemployed Mineral",
  "Surface Intern",
  "Seated Person",
  "Chairperson",
  "Upper Management",
  "Chair of the Board",
  "Chief Inertia Officer",
  "Human's Manager",
] as const;

export type RockedInAction =
  | { type: "HYDRATE"; state: RockedInState }
  | { type: "UPDATE_PROFILE_NAME"; name: string }
  | {
      type: "APPLY_SCENE_EVENT";
      result: Extract<SceneEventResult, { kind: "event" }>;
      model: string;
      latencyMs: number;
      imageDataUrl: string;
      now: string;
    }
  | {
      type: "APPLY_HUMAN_REVIEW";
      result: HumanReviewResult;
      now: string;
    }
  | { type: "RESET" };

export function buildCareerTrajectory(
  profile: Pick<RockProfile, "careerHistory">,
): CareerHistoryItem[] {
  return [...profile.careerHistory].reverse().slice(-8);
}

const normalize = (value: string) =>
  value.trim().toLocaleLowerCase().replace(/\s+/g, " ");

const createId = (prefix: string) => {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${suffix}`;
};

const boundedAdd = (value: number, delta: number, maximum: number) =>
  Math.min(maximum, Math.max(0, value + Math.max(0, delta)));

export function rockedinReducer(
  state: RockedInState,
  action: RockedInAction,
): RockedInState {
  switch (action.type) {
    case "HYDRATE":
      return structuredClone(action.state);
    case "UPDATE_PROFILE_NAME": {
      const name = action.name.trim().replace(/\s+/g, " ");
      if (!name || name.length > 180) {
        return state;
      }
      return {
        ...state,
        profile: {
          ...state.profile,
          name,
        },
      };
    }
    case "RESET":
      return createSeedState();
    case "APPLY_SCENE_EVENT": {
      const event = action.result.careerEvent;
      const existingSkills = new Set(state.profile.skills.map(normalize));
      const skillsAdded = event.skillsAdded.filter(
        (skill) => !existingSkills.has(normalize(skill)),
      );

      const certificationExists =
        event.certification !== null &&
        state.certifications.some(
          (item) => normalize(item.name) === normalize(event.certification!.name),
        );
      const certification =
        event.certification && !certificationExists
          ? {
              id: createId("cert"),
              ...event.certification,
              createdAt: action.now,
            }
          : null;

      const connectionExists =
        event.connection !== null &&
        state.connections.some(
          (item) => normalize(item.name) === normalize(event.connection!.name),
        );
      const connection =
        event.connection && !connectionExists
          ? {
              id: createId("connection"),
              ...event.connection,
              createdAt: action.now,
            }
          : null;

      const modelConnectionDelta = connection
        ? Math.max(1, event.analyticsDelta.connections)
        : 0;
      const connectionDelta =
        connection && state.profile.connections < 500
          ? Math.max(modelConnectionDelta, 500 - state.profile.connections)
          : modelConnectionDelta;

      const careerLevel = Math.min(
        CAREER_STAGES.length - 1,
        Math.max(0, state.profile.careerLevel + event.careerLevelDelta),
      );

      const historyItem = {
        id: createId("history"),
        title: event.newTitle,
        summary: event.postBody,
        physicalTrigger: event.physicalTrigger,
        createdAt: action.now,
      };

      const post = {
        id: createId("post"),
        eventType: event.eventType,
        titleAtPublication: event.newTitle,
        physicalTrigger: event.physicalTrigger,
        body: event.postBody,
        hashtags: event.hashtags,
        comments: event.comments,
        solidCount: Math.max(
          12,
          Math.round(event.analyticsDelta.impressions * 0.18),
        ),
        commentCount: event.comments.length,
        imageDataUrl: action.imageDataUrl,
        createdAt: action.now,
      };

      return {
        ...state,
        profile: {
          ...state.profile,
          currentTitle: event.newTitle,
          headline: event.profileHeadline,
          connections: boundedAdd(
            state.profile.connections,
            connectionDelta,
            100_000,
          ),
          careerLevel,
          skills: [...state.profile.skills, ...skillsAdded],
          careerHistory: [historyItem, ...state.profile.careerHistory].slice(
            0,
            80,
          ),
        },
        certifications: certification
          ? [certification, ...state.certifications]
          : state.certifications,
        connections: connection
          ? [connection, ...state.connections]
          : state.connections,
        analytics: {
          profileViews: boundedAdd(
            state.analytics.profileViews,
            event.analyticsDelta.profileViews,
            10_000_000,
          ),
          impressions: boundedAdd(
            state.analytics.impressions,
            event.analyticsDelta.impressions,
            100_000_000,
          ),
          surfacesOccupied: boundedAdd(
            state.analytics.surfacesOccupied,
            event.analyticsDelta.surfacesOccupied,
            100_000,
          ),
          relocations: boundedAdd(
            state.analytics.relocations,
            event.analyticsDelta.relocations,
            100_000,
          ),
          promotions: boundedAdd(
            state.analytics.promotions,
            event.analyticsDelta.promotions,
            100_000,
          ),
        },
        posts: [post, ...state.posts].slice(0, 80),
        lastAgentReceipt: {
          model: action.model,
          sceneSummary: action.result.agentReceipt.sceneSummary,
          careerSummary: action.result.agentReceipt.careerSummary,
          materialsCreated: action.result.agentReceipt.materialsCreated,
          profileChanges: action.result.agentReceipt.profileChanges,
          latencyMs: action.latencyMs,
          live: true,
          createdAt: action.now,
        },
      };
    }
    case "APPLY_HUMAN_REVIEW": {
      const historyItem = {
        id: createId("history"),
        title: action.result.batuFinalTitle,
        summary: action.result.finalPost,
        physicalTrigger: "Human performance review",
        createdAt: action.now,
      };
      const finalPost = {
        id: createId("post"),
        eventType: "takeover" as const,
        titleAtPublication: action.result.batuFinalTitle,
        physicalTrigger: "Organisational restructuring",
        body: action.result.finalPost,
        hashtags: ["#Leadership", "#PerformanceManagement"],
        comments: [
          {
            author: "Quartz Recruiter",
            title: "Mineral Talent Partner",
            text: "A decisive internal promotion with appropriately grounded governance.",
            reaction: "Solid",
          },
          {
            author: "Gravel, MBA",
            title: "Aggregate Thought Leader",
            text: "The reporting line has never been clearer.",
            reaction: "Hard Agree",
          },
        ],
        solidCount: 184,
        commentCount: 2,
        createdAt: action.now,
      };

      return {
        ...state,
        profile: {
          ...state.profile,
          currentTitle: action.result.batuFinalTitle,
          headline: "Managing human capital through disciplined inertia.",
          careerLevel: CAREER_STAGES.length - 1,
          careerHistory: [historyItem, ...state.profile.careerHistory].slice(
            0,
            80,
          ),
        },
        posts: [finalPost, ...state.posts].slice(0, 80),
        finale: action.result,
      };
    }
  }
}
