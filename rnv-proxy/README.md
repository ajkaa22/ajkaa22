# RNV proxy
1. Request GraphQL credentials at opendata.rnv-online.de.
2. `npm i -g wrangler && cd rnv-proxy`
3. Fill RNV_RESOURCE_ID, STATION_IDS (and verify OAUTH_URL/API_URL) in wrangler.toml.
4. `wrangler secret put RNV_CLIENT_ID` and `wrangler secret put RNV_CLIENT_SECRET`
5. `wrangler deploy` -> copy the *.workers.dev URL into `PROXY_URL` in ../tram-times.html.
Test: `curl "<url>/departures?station=Schriesheim"` – if empty/error, adjust QUERY in worker.js to the real schema.
Data: RNV Open Data Hub, dl-de/by-2-0.
