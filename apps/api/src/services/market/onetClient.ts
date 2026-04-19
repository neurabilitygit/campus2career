const ONET_BASE_URL = "https://services.onetcenter.org/ws";

export interface OnetAuthConfig {
  username: string;
  password: string;
}

function getAuthHeader(config: OnetAuthConfig): string {
  return `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`;
}

async function onetGet(path: string, config: OnetAuthConfig) {
  const res = await fetch(`${ONET_BASE_URL}${path}`, {
    headers: {
      authorization: getAuthHeader(config),
      accept: "application/json",
    },
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
  return onetGet(`/mnm/search?keyword=${encodeURIComponent(keyword)}`, config);
}

/**
 * Detail fetch placeholder path. Adjust to the chosen official endpoint set
 * when wiring the full ETL.
 */
export async function getOccupationDetails(onetCode: string, config: OnetAuthConfig) {
  return onetGet(`/online/occupations/${encodeURIComponent(onetCode)}`, config);
}

export function getOnetAuthConfigFromEnv(): OnetAuthConfig {
  const username = process.env.ONET_USERNAME;
  const password = process.env.ONET_PASSWORD;
  if (!username || !password) {
    throw new Error("ONET_USERNAME and ONET_PASSWORD are required");
  }
  return { username, password };
}
