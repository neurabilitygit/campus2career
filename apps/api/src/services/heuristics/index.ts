import type {
  HeuristicFlag,
  SkillGapItem,
  StudentScoringInput,
} from "../../../../../packages/shared/src/scoring/types";

export function applyHeuristics(
  input: StudentScoringInput,
  skillGaps: SkillGapItem[]
): HeuristicFlag[] {
  const flags: HeuristicFlag[] = [];
  const year = input.signals.currentAcademicYear;

  if (!input.signals.hasInternshipByJuniorYear && year === "junior") {
    flags.push({
      code: "NO_INTERNSHIP_BY_JUNIOR_YEAR",
      severity: "critical",
      title: "No internship by junior year",
      explanation: "This materially weakens launch readiness for many white-collar entry paths.",
      recommendedActions: [
        "Prioritize internship applications immediately",
        "Add short-cycle project or micro-internship options",
        "Use warm introductions to accelerate conversations"
      ]
    });
  }

  if (!input.signals.hasFirstOrSecondDegreeProfessionalNetwork) {
    flags.push({
      code: "WEAK_NETWORK",
      severity: "critical",
      title: "No first- or second-degree professional network",
      explanation: "Lack of network access reduces visibility, referrals, and informational learning.",
      recommendedActions: [
        "Map parent, alumni, professor, and community contacts",
        "Run initial informational interviews",
        "Create a weekly outreach target"
      ]
    });
  }

  if (!input.signals.hasCarefullyCultivatedMentors) {
    flags.push({
      code: "NO_MENTOR_BASE",
      severity: "warning",
      title: "Mentor relationships are underdeveloped",
      explanation: "Carefully cultivated mentors often improve judgment and access.",
      recommendedActions: [
        "Identify 2 to 3 mentor candidates",
        "Schedule recurring touchpoints",
        "Ask for role-specific guidance rather than generic advice"
      ]
    });
  }

  if (!input.signals.hasIndependentProjectBySeniorYear && year === "senior") {
    flags.push({
      code: "NO_INDEPENDENT_PROJECT_BY_SENIOR_YEAR",
      severity: "critical",
      title: "No independent project by senior year",
      explanation: "This weakens proof-of-work and independence signaling.",
      recommendedActions: [
        "Ship one independent project within the next 30 days",
        "Create a short artifact or portfolio piece",
        "Frame the project around a target role family"
      ]
    });
  }

  if ((input.signals.repeatedDeadlineMisses || 0) >= 2) {
    flags.push({
      code: "EXECUTION_SLIPPAGE",
      severity: "warning",
      title: "Repeated deadline misses are reducing momentum",
      explanation: "Delayed action compounds risk in recruiting and internship cycles.",
      recommendedActions: [
        "Reduce the action plan to the 3 highest-leverage tasks",
        "Set interim deadlines",
        "Escalate reminders and accountability"
      ]
    });
  }

  const aiGap = skillGaps.find((g) => g.skillName.toLowerCase() === "ai_fluency");
  if (aiGap) {
    flags.push({
      code: "AI_FLUENCY_GAP",
      severity: aiGap.gapSeverity === "high" ? "warning" : "info",
      title: "AI fluency is not yet well demonstrated",
      explanation: "Many professional roles increasingly expect practical comfort with AI-enabled workflows.",
      recommendedActions: [
        "Build one AI-assisted workflow project",
        "Use AI in an existing project and document the process",
        "Add explicit AI usage language to portfolio artifacts"
      ]
    });
  }

  const severeGapCount = skillGaps.filter((g) => g.gapSeverity === "high").length;
  if (severeGapCount >= 3) {
    flags.push({
      code: "MULTIPLE_HIGH_SEVERITY_GAPS",
      severity: "critical",
      title: "Multiple high-severity skill gaps are present",
      explanation: "The current path may be directionally right, but the evidence base is still weak.",
      recommendedActions: [
        "Focus on the top 2 skill gaps first",
        "Prioritize proof-of-work over additional passive learning",
        "Sequence coursework and projects around hiring windows"
      ]
    });
  }

  return flags;
}
