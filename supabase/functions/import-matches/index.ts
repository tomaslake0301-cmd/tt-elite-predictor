import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type SetScore = { set_number: number; points_a: number; points_b: number };
type IncomingMatch = {
  source_match_id: string;
  source_url?: string;
  competition?: string;
  level?: string;
  region?: string;
  scheduled_at?: string | null;
  status: "scheduled" | "live" | "completed" | "cancelled" | "postponed";
  player_a: string;
  player_b: string;
  winner?: string | null;
  score_a?: number | null;
  score_b?: number | null;
  sets?: SetScore[];
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });

serve(async (request) => {
  if (request.method !== "POST") return json({ success: false, message: "Use POST." }, 405);

  const expectedSecret = Deno.env.get("TT_IMPORT_WEBHOOK_SECRET");
  const suppliedSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expectedSecret || !suppliedSecret || suppliedSecret !== expectedSecret) {
    return json({ success: false, message: "Unauthorised import request." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ success: false, message: "Supabase function secrets are not configured." }, 503);
  }

  let payload: { provider?: string; matches?: IncomingMatch[] };
  try {
    payload = await request.json();
  } catch {
    return json({ success: false, message: "Request body must be valid JSON." }, 400);
  }

  const provider = payload.provider?.trim();
  const matches = payload.matches;
  if (!provider || !Array.isArray(matches) || matches.length === 0) {
    return json({ success: false, message: "Provide provider and a non-empty matches array." }, 400);
  }
  if (matches.length > 500) return json({ success: false, message: "Maximum 500 matches per request." }, 413);

  const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: run, error: runError } = await db.from("import_runs")
    .insert({ provider, status: "started", records_seen: matches.length })
    .select("id").single();
  if (runError) return json({ success: false, message: runError.message }, 500);

  let imported = 0;
  const errors: string[] = [];
  for (const item of matches) {
    try {
      if (!item.source_match_id || !item.player_a || !item.player_b ||
          item.player_a.trim().toLowerCase() === item.player_b.trim().toLowerCase() ||
          !["scheduled", "live", "completed", "cancelled", "postponed"].includes(item.status)) {
        throw new Error("Invalid match identity, players, or status.");
      }

      const playerIds: Record<string, string> = {};
      for (const displayName of [item.player_a, item.player_b]) {
        const normalized = displayName.trim().toLocaleLowerCase().replace(/\s+/g, " ");
        const { data, error } = await db.from("players").upsert(
          { display_name: displayName.trim(), normalized_name: normalized, provider },
          { onConflict: "normalized_name" }
        ).select("id").single();
        if (error) throw error;
        playerIds[normalized] = data.id;
      }

      let competitionId: string | null = null;
      if (item.competition) {
        const { data, error } = await db.from("competitions").upsert(
          { name: item.competition, level: item.level ?? "TT Elite Series", region: item.region ?? "Poland" },
          { onConflict: "name,level" }
        ).select("id").single();
        if (error) throw error;
        competitionId = data.id;
      }

      const winnerName = item.winner?.trim().toLocaleLowerCase().replace(/\s+/g, " ");
      const { data: match, error: matchError } = await db.from("matches").upsert({
        competition_id: competitionId,
        player_a_id: playerIds[item.player_a.trim().toLocaleLowerCase().replace(/\s+/g, " ")],
        player_b_id: playerIds[item.player_b.trim().toLocaleLowerCase().replace(/\s+/g, " ")],
        scheduled_at: item.scheduled_at ?? null,
        status: item.status,
        winner_id: winnerName ? playerIds[winnerName] ?? null : null,
        score_a: item.score_a ?? null,
        score_b: item.score_b ?? null,
        source_provider: provider,
        source_match_id: item.source_match_id,
        source_url: item.source_url ?? null,
        source_updated_at: new Date().toISOString(),
        imported_at: new Date().toISOString(),
        data_verified: true
      }, { onConflict: "source_provider,source_match_id" }).select("id").single();
      if (matchError) throw matchError;

      if (item.sets?.length) {
        const rows = item.sets.map((set) => ({
          match_id: match.id,
          set_number: set.set_number,
          points_a: set.points_a,
          points_b: set.points_b
        }));
        const { error } = await db.from("match_sets").upsert(rows, { onConflict: "match_id,set_number" });
        if (error) throw error;
      }
      imported++;
    } catch (error) {
      errors.push(`${item.source_match_id || "unknown"}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await db.from("import_runs").update({
    finished_at: new Date().toISOString(),
    status: errors.length ? (imported ? "completed_with_errors" : "failed") : "completed",
    records_imported: imported,
    error_summary: errors.slice(0, 20).join("\n") || null
  }).eq("id", run.id);

  return json({ success: errors.length === 0, provider, records_seen: matches.length,
    records_imported: imported, errors: errors.slice(0, 20), import_run_id: run.id },
    errors.length && !imported ? 207 : 200);
});
