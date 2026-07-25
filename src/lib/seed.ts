import type { RockedInState } from "@/lib/schemas";

const SEED_STATE: RockedInState = {
  profile: {
    name: "Batu Bin Granite",
    currentTitle: "Unemployed Mineral",
    headline: "Open to Work. Closed to Movement.",
    location: "Kuala Lumpur",
    experienceLabel: "4.5B years",
    connections: 499,
    thoughts: 0,
    netWorthGrams: 184,
    inactivityUptime: 99.99,
    careerLevel: 0,
    skills: ["Strategic Stillness", "Hard Skills", "Pressure Management"],
    careerHistory: [
      {
        id: "seed-unemployed",
        title: "Unemployed Mineral",
        summary: "Developed foundational stillness over 4.5 billion years.",
        physicalTrigger: "Initial state",
        createdAt: "1970-01-01T00:00:00.000Z",
      },
    ],
  },
  certifications: [],
  connections: [],
  analytics: {
    profileViews: 12,
    impressions: 31,
    surfacesOccupied: 1,
    relocations: 0,
    promotions: 0,
  },
  posts: [],
};

export function createSeedState(): RockedInState {
  return structuredClone(SEED_STATE);
}
