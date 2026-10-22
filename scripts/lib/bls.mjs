/**
 * BLS Public Data API v1 (no key): GET https://api.bls.gov/publicAPI/v1/timeseries/data/{seriesID}
 * (path and response shape confirmed on https://www.bls.gov/developers/api_signature.htm, 2026-10-22).
 * Response: { status: "REQUEST_SUCCEEDED", message: [], Results: { series: [{ seriesID, data: [{ year, period,
 * periodName, value, latest?, footnotes }] }] } } — the documentation's sample shows `Results` as an array holding
 * that object, so both forms are read. The newest observation is the one marked `latest: "true"`, else the first.
 */
export const BLS_V1 = 'https://api.bls.gov/publicAPI/v1/timeseries/data/';

/** Parse one v1 response for one series into the row latest.json stores. Pure: unit-tested on a fixture. */
export function parseBls(series, json, httpStatus = 200) {
  const fail = (error) => ({ series, period: null, year: null, periodName: null, value: null, status: 'error', error });
  if (httpStatus < 200 || httpStatus >= 300) return fail(`HTTP ${httpStatus}`);
  if (!json || typeof json !== 'object') return fail('response was not JSON');
  if (json.status !== 'REQUEST_SUCCEEDED') return fail(`${json.status ?? 'no status'}${Array.isArray(json.message) && json.message.length ? `: ${json.message.join(' ')}` : ''}`);
  const results = Array.isArray(json.Results) ? json.Results[0] : json.Results;
  const s = (results?.series ?? []).find((x) => x.seriesID === series) ?? results?.series?.[0];
  const data = s?.data ?? [];
  if (!data.length) return fail(`no data for the series${Array.isArray(json.message) && json.message.length ? ` (${json.message.join(' ')})` : ''}`);
  const d = data.find((x) => String(x.latest) === 'true') ?? data[0];
  return { series, period: d.period ?? null, year: d.year ?? null, periodName: d.periodName ?? null, value: d.value ?? null, status: 'ok' };
}
