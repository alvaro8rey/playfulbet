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

    if (eventError) {
      console.error("Event update error:", eventError);
      throw eventError;
    }

    // Get all pending bets on this event
    const { data: bets, error: betsError } = await supabase
      .from("bets")
      .select("id, user_id, prediction, amount, potential_win, event_id, profile:profiles(id, user_id, points, won_bets, lost_bets)")
      .eq("event_id", eventId)
      .eq("status", "pending");

    if (betsError) {
      console.error("Bets fetch error:", betsError);
      throw betsError;
    }

    console.log(`Found ${bets?.length || 0} pending bets for event ${eventId}`);

    if (bets && bets.length > 0) {
      for (const bet of bets) {
        const won = bet.prediction === result;
        console.log(`Processing bet ${bet.id}: won=${won}, prediction=${bet.prediction}, result=${result}`);

        // Update bet status
        const { error: betError } = await supabase
          .from("bets")
          .update({
            status: won ? "won" : "lost",
            resolved_at: new Date().toISOString(),
          })
          .eq("id", bet.id);

        if (betError) {
          console.error(`Bet update error for ${bet.id}:`, betError);
          throw betError;
        }

        // Update user points
        const profile = (bet.profile as unknown as { id: string; user_id: string; points: number; won_bets: number; lost_bets: number } | null) || null;
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

          if (profileError) {
            console.error(`Profile update error for ${bet.user_id}:`, profileError);
            throw profileError;
          }
        }
      }
    }

    return {
      success: true,
      message: `Evento resuelto: ${bets?.length || 0} apuestas procesadas ✓`,
      betsCount: bets?.length || 0,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al resolver";
    console.error("Resolve event error:", message);
    return {
      success: false,
      message,
    };
  }
}
