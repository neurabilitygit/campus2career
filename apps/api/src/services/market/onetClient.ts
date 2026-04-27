const ONET_BASE_URL = process.env.ONET_BASE_URL || "https://api-v2.onetcenter.org";

export interface OnetAuthConfig {
  apiKey?: string;
  username?: string;
  password?: string;
}

function getHeaders(config: OnetAuthConfig): Record<string, string> {
  if (config.apiKey) {
    return {
      "x-api-key": config.apiKey,
      accept: "application/json",
    };
  }

  if (config.username && config.password) {
    return {
      authorization: `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`,
      accept: "application/json",
    };
  }

  throw new Error("O*NET credentials are required");
}

async function onetGet(path: string, config: OnetAuthConfig) {
  const res = await fetch(`${ONET_BASE_URL}${path}`, {
    headers: getHeaders(config),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`O*NET request failed: ${res.status} ${res.statusText} :: ${text}`);
  }

  return res.json();
}

/**
 * O*NET search is documented through the official web services.
 * The exact returned JSON shape varies by endpoint.
 */
export async function searchOccupationsByKeyword(keyword: string, config: OnetAuthConfig) {
  return onetGet(`/online/search?keyword=${encodeURIComponent(keyword)}`, config);
}

export async function getOccupationOverview(onetCode: string, config: OnetAuthConfig) {
  return onetGet(`/online/occupations/${encodeURIComponent(onetCode)}/`, config);
}

export async function getOccupationSkillsSummary(onetCode: string, config: OnetAuthConfig) {
  return onetGet(`/online/occupations/${encodeURIComponent(onetCode)}/summary/skills?start=1&end=20`, config);
}

export async function getOccupationTechnologySkillsSummary(onetCode: string, config: OnetAuthConfig) {
  return onetGet(`/online/occupations/${encodeURIComponent(onetCode)}/summary/technology_skills?start=1&end=20`, config);
}

export async function getOccupationJobZone(onetCode: string, config: OnetAuthConfig) {
  return onetGet(`/online/occupations/${encodeURIComponent(onetCode)}/summary/job_zone`, config);
}

export async function getCareerJobOutlook(onetCode: string, config: OnetAuthConfig) {
  return onetGet(`/mnm/careers/${encodeURIComponent(onetCode)}/job_outlook`, config);
}

export function getOnetAuthConfigFromEnv(): OnetAuthConfig {
  const apiKey = process.env.ONET_API_KEY;
  const username = process.env.ONET_USERNAME;
  const password = process.env.ONET_PASSWORD;
  if (apiKey) {
    return { apiKey };
  }
  if (!username || !password) {
    throw new Error("ONET_API_KEY or ONET_USERNAME and ONET_PASSWORD are required");
  }
  return { username, password };
}
