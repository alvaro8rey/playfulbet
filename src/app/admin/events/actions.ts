"use server";

import { createAdminClient } from "@/lib/supabase/server";
import type { BetResult } from "@/types";

export async function resolveEvent(
  eventId: string,
  result: BetResult,
  homeScore: number | null,
  awayScore: number | null
) {
  const supabase = await createAdminClient();

  try {
    // Update event
    const { error: eventError } = await supabase.from("events").update({
      status: "finished",
      result,
      home_score: homeScore,
      away_score: awayScore,
    }).eq("id", eventId);

    if (eventError) throw eventError;

    // Get all pending bets on this event
    const { data: bets } = await supabase
      .from("bets")
      .select("*, profile:profiles(*)")
      .eq("event_id", eventId)
      .eq("status", "pending");

    if (bets && bets.length > 0) {
      for (const bet of bets) {
        const won = bet.prediction === result;

        // Update bet status
        const { error: betError } = await supabase.from("bets").update({
          status: won ? "won" : "lost",
          resolved_at: new Date().toISOString(),
        }).eq("id", bet.id);

        if (betError) throw betError;

        // Update user points
        const profile = bet.profile as { user_id: string; points: number; won_bets: number; lost_bets: number } | null;
        if (profile) {
          const updateData = won
            ? {
              points: profile.points + bet.potential_win,
              won_bets: profile.won_bets + 1,
            }
            : {
              lost_bets: profile.lost_bets + 1,
            };

          const { error: profileError } = await supabase
            .from("profiles")
            .update(updateData)
            .eq("user_id", bet.user_id);

          if (profileError) throw profileError;
        }
      }
    }

    return {
      success: true,
      message: `Evento resuelto: ${bets?.length || 0} apuestas procesadas ✓`,
      betsCount: bets?.length || 0,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Error al resolver",
    };
  }
}
