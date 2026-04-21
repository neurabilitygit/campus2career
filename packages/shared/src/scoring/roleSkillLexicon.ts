/**
 * Minimal v1 lexicon used to infer skill evidence from artifacts, deliverables, tools,
 * and course titles before deeper O*NET mappings and syllabus parsing are added.
 */
export const SKILL_LEXICON: Record<string, string[]> = {
  sql: ["sql", "postgres", "mysql", "query", "queries"],
  python: ["python", "pandas", "numpy", "jupyter"],
  excel_modeling: ["excel", "financial model", "forecast", "budget", "valuation"],
  statistics: ["statistics", "probability", "regression", "statistical", "stochastic"],
  risk_modeling: ["risk model", "actuarial", "loss model", "capital model", "scenario model"],
  presentation: ["presentation", "deck", "slides", "pitch"],
  stakeholder_communication: ["stakeholder", "client", "meeting", "presentation", "cross-functional"],
  data_visualization: ["tableau", "power bi", "dashboard", "visualization", "chart"],
  research: ["research", "literature review", "clinical research", "analysis"],
  information_security: ["cybersecurity", "security incident", "iam", "siem", "vulnerability", "threat"],
  risk_assessment: ["risk assessment", "control testing", "risk register", "mitigation", "compliance"],
  legal_research: ["legal research", "case law", "briefing", "westlaw", "lexis", "statutory analysis"],
  writing: ["memo", "brief", "writing", "draft", "report", "policy paper"],
  clinical_reasoning: ["diagnosis", "differential", "clinical judgment", "patient assessment", "treatment plan"],
  patient_care: ["patient care", "bedside", "clinic", "rounds", "care plan", "treatment"],
  medication_management: ["medication", "pharmacology", "dispensing", "drug interaction", "dose"],
  rehabilitation_planning: ["rehabilitation", "physical therapy", "treatment plan", "mobility", "exercise program"],
  ai_fluency: ["chatgpt", "gpt", "claude", "ai", "prompt", "automation", "copilot"],
  project_execution: ["launched", "built", "created", "implemented", "delivered"],
  finance_analysis: ["valuation", "ebitda", "cash flow", "financial analysis", "pricing"],
  accounting_controls: ["reconciliation", "journal entry", "audit", "controls", "gaap"],
  consulting_problem_solving: ["case", "recommendation", "strategy", "process improvement"],
};
