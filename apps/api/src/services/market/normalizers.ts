export interface NormalizedOccupation {
  canonicalName: string;
  onetCode?: string;
  title: string;
  description?: string;
  jobZone?: number;
  source: "onet";
}

export interface NormalizedSkillRequirement {
  occupationCanonicalName: string;
  skillName: string;
  skillCategory:
    | "technical"
    | "analytical"
    | "communication"
    | "operational"
    | "interpersonal"
    | "creative"
    | "managerial"
    | "ai_fluency";
  importanceScore: number;
  requiredProficiencyBand: "basic" | "intermediate" | "advanced";
  evidenceSource: string;
}

export interface NormalizedMarketSignal {
  occupationCanonicalName?: string;
  geographyCode?: string;
  signalType:
    | "wage"
    | "demand_growth"
    | "unemployment_pressure"
    | "openings_trend"
    | "internship_availability"
    | "ai_disruption_signal"
    | "hiring_slowdown";
  signalValue?: number;
  signalDirection?: "rising" | "falling" | "stable";
  sourceName: string;
  effectiveDate: string;
  confidenceLevel: "low" | "medium" | "high";
}

export function inferBandFromImportance(importanceScore: number): "basic" | "intermediate" | "advanced" {
  if (importanceScore >= 80) return "advanced";
  if (importanceScore >= 55) return "intermediate";
  return "basic";
}

export function inferSkillCategory(skillName: string): NormalizedSkillRequirement["skillCategory"] {
  const s = skillName.toLowerCase();
  if (s.includes("ai") || s.includes("automation")) return "ai_fluency";
  if (s.includes("analysis") || s.includes("research") || s.includes("model")) return "analytical";
  if (s.includes("communication") || s.includes("presentation")) return "communication";
  if (s.includes("management") || s.includes("coordination")) return "managerial";
  if (s.includes("sql") || s.includes("python") || s.includes("software")) return "technical";
  return "operational";
}
