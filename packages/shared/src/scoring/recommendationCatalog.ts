import type { RecommendationItem } from "./types";

export const GAP_RECOMMENDATION_CATALOG: Record<string, RecommendationItem[]> = {
  sql: [
    {
      recommendationType: "course",
      title: "Complete an introductory SQL course",
      description: "Gain basic query fluency and demonstrate it quickly.",
      effortLevel: "medium",
      estimatedSignalStrength: "medium",
      whyThisMatchesStudent: "Fastest curricular path to a common analytics requirement.",
      linkedSkillName: "sql",
    },
    {
      recommendationType: "project",
      title: "Build a small SQL-based analysis project",
      description: "Use public data to create a query-driven project and summarize findings.",
      effortLevel: "medium",
      estimatedSignalStrength: "high",
      whyThisMatchesStudent: "Turns abstract learning into proof-of-work.",
      linkedSkillName: "sql",
    },
    {
      recommendationType: "internship",
      title: "Prioritize roles with reporting or operations analytics exposure",
      description: "Target internships where SQL or data extraction is used in real workflows.",
      effortLevel: "high",
      estimatedSignalStrength: "high",
      whyThisMatchesStudent: "Experience plus tooling is stronger than coursework alone.",
      linkedSkillName: "sql",
    },
  ],
  ai_fluency: [
    {
      recommendationType: "ai_project",
      title: "Create an AI-assisted workflow project",
      description: "Show how you used AI to improve analysis, writing, research, or operations.",
      effortLevel: "medium",
      estimatedSignalStrength: "high",
      whyThisMatchesStudent: "Employers increasingly expect practical AI comfort, not just awareness.",
      linkedSkillName: "ai_fluency",
    }
  ],
  stakeholder_communication: [
    {
      recommendationType: "networking",
      title: "Run three informational interviews with a structured question set",
      description: "Build confidence and evidence of professional communication.",
      effortLevel: "medium",
      estimatedSignalStrength: "medium",
      whyThisMatchesStudent: "Low-cost way to improve communication and network strength together.",
      linkedSkillName: "stakeholder_communication",
    },
    {
      recommendationType: "portfolio_piece",
      title: "Produce a concise presentation deck from a project",
      description: "Translate your analysis or work into a professional narrative format.",
      effortLevel: "medium",
      estimatedSignalStrength: "high",
      whyThisMatchesStudent: "Strengthens communication signal in a visible way.",
      linkedSkillName: "stakeholder_communication",
    }
  ]
};

export function getRecommendationsForSkill(skillName: string): RecommendationItem[] {
  const key = skillName.toLowerCase();
  return GAP_RECOMMENDATION_CATALOG[key] || [
    {
      recommendationType: "project",
      title: `Build evidence for ${skillName}`,
      description: `Create a small project, artifact, or deliverable that demonstrates ${skillName}.`,
      effortLevel: "medium",
      estimatedSignalStrength: "medium",
      whyThisMatchesStudent: "Proof-of-work is usually more persuasive than claiming familiarity.",
      linkedSkillName: key,
    },
    {
      recommendationType: "networking",
      title: `Speak with professionals using ${skillName}`,
      description: `Run informational conversations to understand how ${skillName} is used in target roles.`,
      effortLevel: "low",
      estimatedSignalStrength: "low",
      whyThisMatchesStudent: "Clarifies whether this gap is central and how to close it credibly.",
      linkedSkillName: key,
    }
  ];
}
