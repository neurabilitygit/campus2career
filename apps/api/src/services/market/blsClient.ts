const BLS_BASE_URL = "https://api.bls.gov/publicAPI/v2/timeseries/data/";

export interface BlsSeriesRequest {
  seriesid: string[];
  startyear?: string;
  endyear?: string;
  catalog?: boolean;
  calculations?: boolean;
  annualaverage?: boolean;
  aspects?: boolean;
  registrationkey?: string;
}

export interface BlsSeriesDataPoint {
  year: string;
  period: string;
  periodName: string;
  value: string;
  latest?: string;
}

export async function blsPost(request: BlsSeriesRequest) {
  const res = await fetch(BLS_BASE_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`BLS request failed: ${res.status} ${res.statusText} :: ${text}`);
  }

  return res.json();
}

export async function fetchLatestBlsSeries(seriesId: string) {
  const url = `${BLS_BASE_URL}${seriesId}?latest=true`;
  const res = await fetch(url, { headers: { accept: "application/json" } });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`BLS latest request failed: ${res.status} ${res.statusText} :: ${text}`);
  }

  return res.json();
}
