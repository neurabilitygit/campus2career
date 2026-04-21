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
    overrideOnetSocCode: "13-2051.00",
    preferredOnetSocCodes: ["13-2051.00", "13-2099.01"]
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
    overrideOnetSocCode: "15-2051.01",
    preferredOnetSocCodes: ["15-2051.01", "15-2031.00", "15-2051.00"]
  },
  {
    sectorCluster: "data_analytics",
    canonicalName: "data scientist",
    onetSearchTerms: ["data scientist", "machine learning scientist", "research scientist"],
    typicalEntryTitles: ["Data Scientist", "Machine Learning Scientist"],
    overrideOnetSocCode: "15-2051.00",
    preferredOnetSocCodes: ["15-2051.00"]
  },
  {
    sectorCluster: "cybersecurity",
    canonicalName: "information security analyst",
    onetSearchTerms: ["information security analyst", "cybersecurity analyst", "security analyst"],
    typicalEntryTitles: ["Information Security Analyst", "Cybersecurity Analyst"],
    overrideOnetSocCode: "15-1212.00",
    preferredOnetSocCodes: ["15-1212.00"]
  },
  {
    sectorCluster: "actuarial_risk",
    canonicalName: "actuary",
    onetSearchTerms: ["actuary", "actuarial analyst"],
    typicalEntryTitles: ["Actuarial Analyst", "Actuary"],
    overrideOnetSocCode: "15-2011.00",
    preferredOnetSocCodes: ["15-2011.00"]
  },
  {
    sectorCluster: "marketing_growth",
    canonicalName: "marketing manager",
    onetSearchTerms: ["marketing manager", "marketing specialist", "growth marketing"],
    typicalEntryTitles: ["Marketing Manager", "Growth Marketing Associate"],
    overrideOnetSocCode: "11-2021.00",
    preferredOnetSocCodes: ["11-2021.00"]
  },
  {
    sectorCluster: "law_public_policy",
    canonicalName: "attorney",
    onetSearchTerms: ["lawyer", "attorney", "associate attorney"],
    typicalEntryTitles: ["Attorney", "Associate Attorney"],
    overrideOnetSocCode: "23-1011.00",
    preferredOnetSocCodes: ["23-1011.00"]
  },
  {
    sectorCluster: "healthcare",
    canonicalName: "healthcare analyst",
    onetSearchTerms: ["medical and health services manager", "healthcare analyst"],
    typicalEntryTitles: ["Healthcare Analyst", "Care Operations Analyst"],
    overrideOnetSocCode: "11-9111.00",
    preferredOnetSocCodes: ["11-9111.00"]
  },
  {
    sectorCluster: "medicine_clinical_care",
    canonicalName: "physician",
    onetSearchTerms: ["physician", "doctor", "family medicine physician"],
    typicalEntryTitles: ["Resident Physician", "Family Medicine Physician"],
    overrideOnetSocCode: "29-1216.00",
    preferredOnetSocCodes: ["29-1216.00", "29-1215.00", "29-1229.00"]
  },
  {
    sectorCluster: "nursing_advanced_practice",
    canonicalName: "registered nurse",
    onetSearchTerms: ["registered nurse", "rn"],
    typicalEntryTitles: ["Registered Nurse", "Clinical Nurse"],
    overrideOnetSocCode: "29-1141.00",
    preferredOnetSocCodes: ["29-1141.00"]
  },
  {
    sectorCluster: "nursing_advanced_practice",
    canonicalName: "nurse practitioner",
    onetSearchTerms: ["nurse practitioner", "advanced practice nurse"],
    typicalEntryTitles: ["Nurse Practitioner", "Advanced Practice Provider"],
    overrideOnetSocCode: "29-1171.00",
    preferredOnetSocCodes: ["29-1171.00"]
  },
  {
    sectorCluster: "medicine_clinical_care",
    canonicalName: "physician assistant",
    onetSearchTerms: ["physician assistant", "pa"],
    typicalEntryTitles: ["Physician Assistant", "Advanced Practice Provider"],
    overrideOnetSocCode: "29-1071.00",
    preferredOnetSocCodes: ["29-1071.00"]
  },
  {
    sectorCluster: "pharmacy_drug_development",
    canonicalName: "pharmacist",
    onetSearchTerms: ["pharmacist", "clinical pharmacist"],
    typicalEntryTitles: ["Pharmacist", "Clinical Pharmacist"],
    overrideOnetSocCode: "29-1051.00",
    preferredOnetSocCodes: ["29-1051.00"]
  },
  {
    sectorCluster: "allied_health_rehabilitation",
    canonicalName: "physical therapist",
    onetSearchTerms: ["physical therapist", "pt"],
    typicalEntryTitles: ["Physical Therapist", "Doctor of Physical Therapy"],
    overrideOnetSocCode: "29-1123.00",
    preferredOnetSocCodes: ["29-1123.00"]
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
