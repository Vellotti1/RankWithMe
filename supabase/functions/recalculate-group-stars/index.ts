import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function calcLevel(totalStars: number, memberCount: number): number {
  if (memberCount < 5) return 0;
  let level = 0;
  let remaining = totalStars;
  while (remaining >= (3 * level) + 1) {
    remaining -= (3 * level) + 1;
    level++;
  }
  return level;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const groupId = body.group_id;
    if (!groupId) {
      return new Response(JSON.stringify({ error: "group_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Get all current group members
    const { data: members, error: membersErr } = await supabaseAdmin
      .from("group_members")
      .select("user_id")
      .eq("group_id", groupId);
    if (membersErr) throw membersErr;

    const memberUserIds = new Set((members ?? []).map((m: any) => m.user_id));
    const memberCount = memberUserIds.size;

    // 2. Get all media items in this group
    const { data: mediaItems, error: mediaErr } = await supabaseAdmin
      .from("media_items")
      .select("id")
      .eq("group_id", groupId);
    if (mediaErr) throw mediaErr;

    const mediaIds = (mediaItems ?? []).map((m: any) => m.id);

    // 3. Get all reviews for these media items
    const { data: reviews, error: reviewsErr } = await supabaseAdmin
      .from("reviews")
      .select("media_item_id, user_id")
      .in("media_item_id", mediaIds);
    if (reviewsErr) throw reviewsErr;

    // Build a map: media_item_id → Set of user_ids who reviewed it
    const reviewedBy = new Map<string, Set<string>>();
    for (const r of reviews ?? []) {
      if (!reviewedBy.has(r.media_item_id)) reviewedBy.set(r.media_item_id, new Set());
      reviewedBy.get(r.media_item_id)!.add(r.user_id);
    }

    // 4. Determine which media items qualify for a star
    const qualifyingMediaIds: string[] = [];
    for (const mediaId of mediaIds) {
      const reviewers = reviewedBy.get(mediaId);
      if (!reviewers) continue;
      // Check if every current member has reviewed this item
      let allReviewed = true;
      for (const uid of memberUserIds) {
        if (!reviewers.has(uid)) {
          allReviewed = false;
          break;
        }
      }
      if (allReviewed && memberCount > 0) {
        qualifyingMediaIds.push(mediaId);
      }
    }

    // 5. Get existing starred media
    const { data: existingStars, error: starsErr } = await supabaseAdmin
      .from("group_starred_media")
      .select("media_item_id")
      .eq("group_id", groupId);
    if (starsErr) throw starsErr;

    const existingStarIds = new Set((existingStars ?? []).map((s: any) => s.media_item_id));
    const qualifyingSet = new Set(qualifyingMediaIds);

    // 6. Insert new stars (media that qualifies but isn't starred yet)
    const toInsert = qualifyingMediaIds.filter((id) => !existingStarIds.has(id));
    if (toInsert.length > 0) {
      const rows = toInsert.map((media_item_id) => ({ group_id: groupId, media_item_id }));
      const { error: insertErr } = await supabaseAdmin
        .from("group_starred_media")
        .insert(rows);
      if (insertErr) throw insertErr;
    }

    // 7. Remove stars that no longer qualify
    const toRemove = [...existingStarIds].filter((id) => !qualifyingSet.has(id));
    if (toRemove.length > 0) {
      const { error: deleteErr } = await supabaseAdmin
        .from("group_starred_media")
        .delete()
        .eq("group_id", groupId)
        .in("media_item_id", toRemove);
      if (deleteErr) throw deleteErr;
    }

    // 8. Calculate total stars and level
    const totalStars = qualifyingMediaIds.length;
    const level = calcLevel(totalStars, memberCount);

    // 9. Update the groups table
    const { error: updateErr } = await supabaseAdmin
      .from("groups")
      .update({ total_stars: totalStars, level })
      .eq("id", groupId);
    if (updateErr) throw updateErr;

    return new Response(JSON.stringify({
      group_id: groupId,
      total_stars: totalStars,
      level,
      member_count: memberCount,
      stars_added: toInsert.length,
      stars_removed: toRemove.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
