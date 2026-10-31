# TT Elite Predictor — deployment starter

This project is the foundation for a hosted, iPhone-friendly TT Elite Series prediction app.

## What's included
- Supabase SQL schema for competitions, players, matches, set scores, predictions and import logs.
- Row-level security policies scoped to authenticated users.
- A server-side import function scaffold. It deliberately does not scrape Scores24 or BsportsFan; connect a licensed feed or upload a CSV.
- A documented provider adapter contract so a data provider can be changed without rebuilding the app.
- Prediction scoring specification and calibration notes.

## What is not connected yet
No Supabase project, GitHub repository, Vercel deployment, or licensed match-data feed has been connected. No live fixtures are being imported. The importer returns a clear configuration error until a provider adapter is implemented and credentials are added as server-side secrets.

## Deploy sequence
1. Create a Supabase project and run `supabase/migrations/001_initial_schema.sql` in its SQL editor.
2. Deploy `supabase/functions/import-matches` and configure provider secrets only after obtaining authorised API access.
3. Put this project in a GitHub repository and connect that repository to Vercel.
4. Configure the Supabase URL and anon key as Vercel environment variables.
5. Verify all divisions, historical results and set-score coverage before enabling automated predictions.

## Data-source policy
Use only a provider's documented API or data exports where its terms permit this use. Do not scrape websites or bypass access controls. Record provider, external match ID, import timestamp and source URL for every imported match.

## Prediction score
The score out of 100 is a model-confidence index, not a guaranteed probability. It must be calibrated against settled predictions before being described as reliable. Keep estimated win probability separate from the confidence index. Suppress predictions when history is insufficient or data quality is poor.
