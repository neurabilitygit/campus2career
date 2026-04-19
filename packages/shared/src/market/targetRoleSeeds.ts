export interface TargetRoleSeed {
  sectorCluster: string;
  canonicalName: string;
  onetSearchTerms: string[];
  typicalEntryTitles: string[];
}

export const TARGET_ROLE_SEEDS: TargetRoleSeed[] = [
  {
    sectorCluster: "technology_startups",
    canonicalName: "software developer",
    onetSearchTerms: ["software developer", "software engineer"],
    typicalEntryTitles: ["Software Engineer I", "Junior Software Developer"]
  },
  {
    sectorCluster: "technology_startups",
    canonicalName: "product operations associate",
    onetSearchTerms: ["operations analyst", "product analyst"],
    typicalEntryTitles: ["Product Operations Associate", "Product Analyst"]
  },
  {
    sectorCluster: "fintech",
    canonicalName: "business analyst",
    onetSearchTerms: ["business analyst"],
    typicalEntryTitles: ["Business Analyst", "Operations Analyst"]
  },
  {
    sectorCluster: "management_consulting",
    canonicalName: "management consulting analyst",
    onetSearchTerms: ["management analyst"],
    typicalEntryTitles: ["Consulting Analyst", "Business Analyst"]
  },
  {
    sectorCluster: "finance_financial_services",
    canonicalName: "financial analyst",
    onetSearchTerms: ["financial analyst"],
    typicalEntryTitles: ["Financial Analyst", "Investment Analyst"]
  },
  {
    sectorCluster: "accounting_audit_risk",
    canonicalName: "staff accountant",
    onetSearchTerms: ["accountant", "auditor"],
    typicalEntryTitles: ["Staff Accountant", "Audit Associate"]
  },
  {
    sectorCluster: "data_analytics",
    canonicalName: "data analyst",
    onetSearchTerms: ["data analyst", "operations research analyst"],
    typicalEntryTitles: ["Data Analyst", "Analytics Associate"]
  },
  {
    sectorCluster: "healthcare",
    canonicalName: "healthcare analyst",
    onetSearchTerms: ["medical and health services manager", "healthcare analyst"],
    typicalEntryTitles: ["Healthcare Analyst", "Care Operations Analyst"]
  },
  {
    sectorCluster: "pharma_biotech_clinical_research",
    canonicalName: "clinical research coordinator",
    onetSearchTerms: ["clinical research coordinator", "clinical research"],
    typicalEntryTitles: ["Clinical Research Coordinator", "Research Associate"]
  },
  {
    sectorCluster: "operations_strategy",
    canonicalName: "operations analyst",
    onetSearchTerms: ["operations analyst", "management analyst"],
    typicalEntryTitles: ["Operations Analyst", "Strategy Analyst"]
  }
];
