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
  ],
  information_security: [
    {
      recommendationType: "course",
      title: "Complete a hands-on cybersecurity fundamentals course",
      description: "Build comfort with core concepts like networks, identity, and incident response.",
      effortLevel: "medium",
      estimatedSignalStrength: "medium",
      whyThisMatchesStudent: "Foundational security knowledge is hard to fake and easy to discuss in interviews.",
      linkedSkillName: "information_security",
    },
    {
      recommendationType: "project",
      title: "Document a small security audit or lab",
      description: "Analyze a sample system, controls setup, or threat scenario and write down your findings.",
      effortLevel: "medium",
      estimatedSignalStrength: "high",
      whyThisMatchesStudent: "Security hiring responds well to concrete evidence of careful thinking.",
      linkedSkillName: "information_security",
    }
  ],
  statistics: [
    {
      recommendationType: "course",
      title: "Complete a statistics or probability course with applied work",
      description: "Focus on regression, inference, or experimental reasoning you can explain clearly.",
      effortLevel: "medium",
      estimatedSignalStrength: "high",
      whyThisMatchesStudent: "This is a core requirement for actuarial, analytics, and many research paths.",
      linkedSkillName: "statistics",
    }
  ],
  legal_research: [
    {
      recommendationType: "project",
      title: "Write a short legal or policy research memo",
      description: "Choose a focused issue and summarize the governing rules, cases, and practical implications.",
      effortLevel: "medium",
      estimatedSignalStrength: "high",
      whyThisMatchesStudent: "Clear legal writing demonstrates reasoning better than a generic interest statement.",
      linkedSkillName: "legal_research",
    }
  ],
  clinical_reasoning: [
    {
      recommendationType: "course",
      title: "Strengthen advanced science and clinical decision foundations",
      description: "Prioritize rigorous biology, chemistry, physiology, or clinical decision coursework.",
      effortLevel: "high",
      estimatedSignalStrength: "high",
      whyThisMatchesStudent: "Clinical roles depend on reasoning that is built through formal preparation.",
      linkedSkillName: "clinical_reasoning",
    }
  ],
  patient_care: [
    {
      recommendationType: "volunteer",
      title: "Gain direct patient-facing experience",
      description: "Volunteer, shadow, or work in settings where you can observe or support real care workflows.",
      effortLevel: "high",
      estimatedSignalStrength: "high",
      whyThisMatchesStudent: "Patient-facing evidence matters for medicine, nursing, and allied health tracks.",
      linkedSkillName: "patient_care",
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
