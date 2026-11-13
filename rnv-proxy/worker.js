// Cloudflare Worker: holds the RNV secret, returns normalized departures.
// GET /departures?station=<key>  ->  { live:true, departures:[{destination,line,planned,realtime}] }
// UNVERIFIED against the live RNV schema (RNV hosts were unreachable when written).
// Check OAUTH_URL / API_URL / the GraphQL query against opendata.rnv-online.de docs
// and the graphql.http file in https://github.com/Rhein-Neckar-Verkehr/data-hub-typescript-client

let cached = { token: null, exp: 0 };

async function getToken(env) {
  if (cached.token && Date.now() < cached.exp - 60000) return cached.token;
  const r = await fetch(env.OAUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: env.RNV_CLIENT_ID,
      client_secret: env.RNV_CLIENT_SECRET,
      resource: env.RNV_RESOURCE_ID,
    }),
  });
  if (!r.ok) throw new Error("token " + r.status);
  const j = await r.json();
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return cached.token;
}

const QUERY = `query($id:String!,$start:String!){
  station(id:$id){ journeys(startTime:$start, first:25){ elements{
    line{ lineGroup }
    stops{ pole{ platform{ label } } plannedDeparture{ isoString } realtimeDeparture{ isoString } destinationLabel }
  }}}}`;

export default {
  async fetch(req, env) {
    const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
    try {
      const key = new URL(req.url).searchParams.get("station");
      const ids = JSON.parse(env.STATION_IDS);           // {"Schriesheim":"1234", ...}
      if (!ids[key]) return new Response('{"error":"unknown station"}', { status: 400, headers: cors });
      const token = await getToken(env);
      const r = await fetch(env.API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ query: QUERY, variables: { id: ids[key], start: new Date().toISOString() } }),
      });
      const data = await r.json();
      const els = data?.data?.station?.journeys?.elements ?? [];
      const departures = els.flatMap(e => (e.stops || []).slice(0, 1).map(s => ({
        line: e.line?.lineGroup, destination: s.destinationLabel,
        planned: s.plannedDeparture?.isoString, realtime: s.realtimeDeparture?.isoString,
      })));
      return new Response(JSON.stringify({ live: true, departures }), { headers: cors });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }), { status: 502, headers: cors });
    }
  },
};
