export interface TargetRoleSeed {
  sectorCluster: string;
  canonicalName: string;
  onetSearchTerms: string[];
  typicalEntryTitles: string[];
  overrideOnetSocCode?: string;
  preferredOnetSocCodes?: string[];
}

export const TARGET_ROLE_SEEDS: TargetRoleSeed[] = [
  {
    sectorCluster: "technology_startups",
    canonicalName: "software developer",
    onetSearchTerms: ["software developer", "software engineer"],
    typicalEntryTitles: ["Software Engineer I", "Junior Software Developer"],
    overrideOnetSocCode: "15-1252.00"
  },
  {
    sectorCluster: "technology_startups",
    canonicalName: "product operations associate",
    onetSearchTerms: ["operations analyst", "product analyst"],
    typicalEntryTitles: ["Product Operations Associate", "Product Analyst"],
    overrideOnetSocCode: "13-1111.00",
    preferredOnetSocCodes: ["13-1111.00"]
  },
  {
    sectorCluster: "fintech",
    canonicalName: "business analyst",
    onetSearchTerms: ["business analyst"],
    typicalEntryTitles: ["Business Analyst", "Operations Analyst"],
    overrideOnetSocCode: "13-1111.00"
  },
  {
    sectorCluster: "management_consulting",
    canonicalName: "management consulting analyst",
    onetSearchTerms: ["management analyst"],
    typicalEntryTitles: ["Consulting Analyst", "Business Analyst"],
    overrideOnetSocCode: "13-1111.00"
  },
  {
    sectorCluster: "finance_financial_services",
    canonicalName: "financial analyst",
    onetSearchTerms: ["financial analyst"],
    typicalEntryTitles: ["Financial Analyst", "Investment Analyst"],
    overrideOnetSocCode: "13-2031.00",
    preferredOnetSocCodes: ["13-2031.00", "13-2051.00"]
  },
  {
    sectorCluster: "accounting_audit_risk",
    canonicalName: "staff accountant",
    onetSearchTerms: ["accountant", "auditor"],
    typicalEntryTitles: ["Staff Accountant", "Audit Associate"],
    overrideOnetSocCode: "13-2011.00"
  },
  {
    sectorCluster: "data_analytics",
    canonicalName: "data analyst",
    onetSearchTerms: ["data analyst", "operations research analyst"],
    typicalEntryTitles: ["Data Analyst", "Analytics Associate"],
    overrideOnetSocCode: "15-2041.00",
    preferredOnetSocCodes: ["15-2051.01", "15-2031.00", "15-2041.00"]
  },
  {
    sectorCluster: "healthcare",
    canonicalName: "healthcare analyst",
    onetSearchTerms: ["medical and health services manager", "healthcare analyst"],
    typicalEntryTitles: ["Healthcare Analyst", "Care Operations Analyst"],
    overrideOnetSocCode: "15-1211.01"
  },
  {
    sectorCluster: "pharma_biotech_clinical_research",
    canonicalName: "clinical research coordinator",
    onetSearchTerms: ["clinical research coordinator", "clinical research"],
    typicalEntryTitles: ["Clinical Research Coordinator", "Research Associate"],
    overrideOnetSocCode: "11-9121.01"
  },
  {
    sectorCluster: "operations_strategy",
    canonicalName: "operations analyst",
    onetSearchTerms: ["operations analyst", "management analyst"],
    typicalEntryTitles: ["Operations Analyst", "Strategy Analyst"],
    overrideOnetSocCode: "15-2031.00",
    preferredOnetSocCodes: ["15-2031.00", "13-1111.00"]
  }
];

export function getTargetRoleSeedByCanonicalName(canonicalName: string): TargetRoleSeed | undefined {
  return TARGET_ROLE_SEEDS.find((seed) => seed.canonicalName.toLowerCase() === canonicalName.trim().toLowerCase());
}

export function listTargetRoleOptions() {
  return TARGET_ROLE_SEEDS.map((seed) => ({
    canonicalName: seed.canonicalName,
    sectorCluster: seed.sectorCluster,
    label: seed.canonicalName
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(" "),
  }));
}
