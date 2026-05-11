import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const log: string[] = [];

    // ── Step 1: Create 5 demo users via Admin API (proper GoTrue flow) ──────
    const demoUserDefs = [
      { email: "alex@demo.kritiq.app",   password: "demo1234", username: "alexmovies",     display_name: "Alex Chen"    },
      { email: "jamie@demo.kritiq.app",  password: "demo1234", username: "jamiewatch",     display_name: "Jamie Rivera" },
      { email: "sam@demo.kritiq.app",    password: "demo1234", username: "samfilms",       display_name: "Sam Patel"    },
      { email: "morgan@demo.kritiq.app", password: "demo1234", username: "morgancritic",   display_name: "Morgan Lee"   },
      { email: "taylor@demo.kritiq.app", password: "demo1234", username: "taylorscreens",  display_name: "Taylor Kim"   },
    ];

    const users: Record<string, string> = {}; // email -> real UUID

    for (const u of demoUserDefs) {
      const { data, error } = await admin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { username: u.username, display_name: u.display_name },
      });
      if (error || !data?.user) {
        log.push(`ERROR creating ${u.email}: ${error?.message}`);
        continue;
      }
      users[u.email] = data.user.id;
      log.push(`created ${u.email} → ${data.user.id}`);

      // Ensure profile exists (trigger should handle it, upsert as safety net)
      await admin.from("profiles").upsert({
        id: data.user.id,
        username: u.username,
        display_name: u.display_name,
        avatar_url: "",
      });
    }

    const alex   = users["alex@demo.kritiq.app"];
    const jamie  = users["jamie@demo.kritiq.app"];
    const sam    = users["sam@demo.kritiq.app"];
    const morgan = users["morgan@demo.kritiq.app"];
    const taylor = users["taylor@demo.kritiq.app"];

    if (!alex || !jamie || !sam || !morgan || !taylor) {
      return new Response(JSON.stringify({ ok: false, log, error: "Not all users created" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Step 2: Create groups ────────────────────────────────────────────────
    const { data: groups, error: gErr } = await admin.from("groups").insert([
      { name: "Sci-Fi Fanatics",     description: "We rate everything from classics to the latest blockbusters.", invite_code: "SFF-2025", owner_id: alex,   is_public: true  },
      { name: "Horror Nights",       description: "Jump scares, slow burns, and everything in between.",          invite_code: "HNT-6969", owner_id: jamie,  is_public: true  },
      { name: "Sunday Cinema Club",  description: "Weekly watches and heated debates.",                           invite_code: "SCC-1234", owner_id: sam,    is_public: true  },
      { name: "Private Picks",       description: "Morgan's curated watchlist — invite only.",                    invite_code: "PRV-7777", owner_id: morgan, is_public: false },
    ]).select();

    if (gErr || !groups) {
      log.push(`ERROR creating groups: ${gErr?.message}`);
      return new Response(JSON.stringify({ ok: false, log }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const gScifi   = groups[0].id;
    const gHorror  = groups[1].id;
    const gSunday  = groups[2].id;
    const gPrivate = groups[3].id;
    log.push(`created 4 groups`);

    // ── Step 3: Group memberships ────────────────────────────────────────────
    await admin.from("group_members").insert([
      // Sci-Fi Fanatics
      { group_id: gScifi,   user_id: alex,   role: "owner"  },
      { group_id: gScifi,   user_id: jamie,  role: "member" },
      { group_id: gScifi,   user_id: sam,    role: "member" },
      { group_id: gScifi,   user_id: morgan, role: "member" },
      { group_id: gScifi,   user_id: taylor, role: "member" },
      // Horror Nights
      { group_id: gHorror,  user_id: jamie,  role: "owner"  },
      { group_id: gHorror,  user_id: sam,    role: "member" },
      { group_id: gHorror,  user_id: taylor, role: "member" },
      // Sunday Cinema Club
      { group_id: gSunday,  user_id: sam,    role: "owner"  },
      { group_id: gSunday,  user_id: alex,   role: "member" },
      { group_id: gSunday,  user_id: morgan, role: "member" },
      { group_id: gSunday,  user_id: taylor, role: "member" },
      // Private Picks
      { group_id: gPrivate, user_id: morgan, role: "owner"  },
      { group_id: gPrivate, user_id: alex,   role: "member" },
    ]);
    log.push(`created group memberships`);

    // ── Step 4: Media items ──────────────────────────────────────────────────
    const { data: media, error: mErr } = await admin.from("media_items").insert([
      // Sci-Fi Fanatics
      { group_id: gScifi,  title: "Dune: Part Two",         year: 2024, media_type: "movie", poster_url: "https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg", description: "Epic continuation of Paul Atreides' journey.",                added_by: alex   },
      { group_id: gScifi,  title: "Interstellar",           year: 2014, media_type: "movie", poster_url: "https://images.pexels.com/photos/1252869/pexels-photo-1252869.jpeg", description: "A team travels through a wormhole in search of a new home.", added_by: jamie  },
      { group_id: gScifi,  title: "Severance",              year: 2022, media_type: "show",  poster_url: "https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg", description: "Employees have their work and personal memories separated.", added_by: sam    },
      { group_id: gScifi,  title: "Arrival",                year: 2016, media_type: "movie", poster_url: "https://images.pexels.com/photos/2156881/pexels-photo-2156881.jpeg", description: "A linguist is tasked with communicating with alien visitors.", added_by: morgan },
      { group_id: gScifi,  title: "Andor",                  year: 2022, media_type: "show",  poster_url: "https://images.pexels.com/photos/5011647/pexels-photo-5011647.jpeg", description: "The story of rebel spy Cassian Andor.",                       added_by: taylor },
      { group_id: gScifi,  title: "The Martian",            year: 2015, media_type: "movie", poster_url: "https://images.pexels.com/photos/87009/earth-soil-creep-moon-87009.jpeg", description: "An astronaut stranded on Mars must survive.",           added_by: alex   },
      // Horror Nights
      { group_id: gHorror, title: "Hereditary",             year: 2018, media_type: "movie", poster_url: "https://images.pexels.com/photos/3617457/pexels-photo-3617457.jpeg", description: "A family unravels dark secrets after a tragedy.",             added_by: jamie  },
      { group_id: gHorror, title: "The Last of Us",         year: 2023, media_type: "show",  poster_url: "https://images.pexels.com/photos/2873486/pexels-photo-2873486.jpeg", description: "Survivors navigate a post-apocalyptic world.",               added_by: sam    },
      { group_id: gHorror, title: "Midsommar",              year: 2019, media_type: "movie", poster_url: "https://images.pexels.com/photos/1028225/pexels-photo-1028225.jpeg", description: "A couple travel to Sweden for a midsummer festival.",         added_by: taylor },
      { group_id: gHorror, title: "The Menu",               year: 2022, media_type: "movie", poster_url: "https://images.pexels.com/photos/941861/pexels-photo-941861.jpeg",   description: "Guests visit a remote island restaurant with dark secrets.",  added_by: jamie  },
      // Sunday Cinema Club
      { group_id: gSunday, title: "Past Lives",             year: 2023, media_type: "movie", poster_url: "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg", description: "Two childhood friends reunite decades later.",                added_by: sam    },
      { group_id: gSunday, title: "The Bear",               year: 2022, media_type: "show",  poster_url: "https://images.pexels.com/photos/262978/pexels-photo-262978.jpeg",   description: "A chef returns home to run his family's sandwich shop.",      added_by: alex   },
      { group_id: gSunday, title: "All of Us Strangers",    year: 2023, media_type: "movie", poster_url: "https://images.pexels.com/photos/1170986/pexels-photo-1170986.jpeg", description: "A screenwriter forms a bond with his neighbor.",              added_by: morgan },
      { group_id: gSunday, title: "Succession",             year: 2018, media_type: "show",  poster_url: "https://images.pexels.com/photos/936722/pexels-photo-936722.jpeg",   description: "A dysfunctional media family battles for control.",           added_by: taylor },
      // Private Picks
      { group_id: gPrivate, title: "Oppenheimer",           year: 2023, media_type: "movie", poster_url: "https://images.pexels.com/photos/256541/pexels-photo-256541.jpeg",   description: "The story of the atomic bomb's creation.",                    added_by: morgan },
      { group_id: gPrivate, title: "Slow Horses",           year: 2022, media_type: "show",  poster_url: "https://images.pexels.com/photos/1181346/pexels-photo-1181346.jpeg", description: "MI5 agents relegated to mundane work uncover a conspiracy.", added_by: alex   },
    ]).select();

    if (mErr || !media) {
      log.push(`ERROR creating media: ${mErr?.message}`);
      return new Response(JSON.stringify({ ok: false, log }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    log.push(`created ${media.length} media items`);

    // Map title -> id for reviews
    const mid: Record<string, string> = {};
    for (const m of media) mid[m.title] = m.id;

    // ── Step 5: Reviews ──────────────────────────────────────────────────────
    await admin.from("reviews").insert([
      // Sci-Fi Fanatics reviews
      { media_item_id: mid["Dune: Part Two"],      user_id: alex,   score: 92, text: "Stunning visuals and an epic score. Villeneuve at his best." },
      { media_item_id: mid["Dune: Part Two"],      user_id: jamie,  score: 88, text: "Incredible world-building but pacing dips in the middle." },
      { media_item_id: mid["Dune: Part Two"],      user_id: sam,    score: 85, text: "Visually spectacular. A worthy conclusion." },
      { media_item_id: mid["Interstellar"],        user_id: alex,   score: 95, text: "A masterpiece. The docking scene alone earns a perfect score." },
      { media_item_id: mid["Interstellar"],        user_id: morgan, score: 89, text: "Emotionally devastating and intellectually rich." },
      { media_item_id: mid["Interstellar"],        user_id: taylor, score: 91, text: "Hans Zimmer's score elevates every scene." },
      { media_item_id: mid["Severance"],           user_id: sam,    score: 96, text: "One of the most original concepts on TV. Season 2 please!" },
      { media_item_id: mid["Severance"],           user_id: jamie,  score: 93, text: "Unsettling in the best way. Can't stop thinking about it." },
      { media_item_id: mid["Arrival"],             user_id: morgan, score: 94, text: "The twist reframes everything. Watched it twice." },
      { media_item_id: mid["Arrival"],             user_id: alex,   score: 90, text: "Quiet, thoughtful sci-fi. Rare to see this done so well." },
      { media_item_id: mid["Andor"],               user_id: taylor, score: 97, text: "The best Star Wars content in years. Feels grounded and real." },
      { media_item_id: mid["The Martian"],         user_id: alex,   score: 87, text: "Fun and optimistic. Matt Damon carries the whole film." },
      // Horror Nights reviews
      { media_item_id: mid["Hereditary"],          user_id: jamie,  score: 91, text: "Toni Collette is otherworldly. Absolutely terrifying." },
      { media_item_id: mid["Hereditary"],          user_id: sam,    score: 85, text: "Genuinely disturbing but hard to watch at times." },
      { media_item_id: mid["The Last of Us"],      user_id: sam,    score: 98, text: "Episode 3 is one of the greatest hours of television ever made." },
      { media_item_id: mid["The Last of Us"],      user_id: taylor, score: 94, text: "Pedro Pascal and Bella Ramsey are perfect." },
      { media_item_id: mid["Midsommar"],           user_id: taylor, score: 88, text: "Disturbing and beautiful simultaneously. Ari Aster is unhinged (compliment)." },
      { media_item_id: mid["The Menu"],            user_id: jamie,  score: 82, text: "Ralph Fiennes is menacing. Great concept, slightly rushed ending." },
      { media_item_id: mid["The Menu"],            user_id: sam,    score: 79, text: "Enjoyable but I wanted more from the finale." },
      // Sunday Cinema Club reviews
      { media_item_id: mid["Past Lives"],          user_id: sam,    score: 93, text: "Quietly devastating. The ending will stay with me forever." },
      { media_item_id: mid["Past Lives"],          user_id: alex,   score: 90, text: "Understated and beautiful. A2 is a star." },
      { media_item_id: mid["The Bear"],            user_id: alex,   score: 97, text: "Season 2 episode 'Forks' is peak television." },
      { media_item_id: mid["The Bear"],            user_id: morgan, score: 95, text: "Stressful in the best way. I could feel the heat of the kitchen." },
      { media_item_id: mid["All of Us Strangers"], user_id: morgan, score: 94, text: "Andrew Scott is extraordinary. Cried twice." },
      { media_item_id: mid["Succession"],          user_id: taylor, score: 99, text: "The greatest drama series of the decade. No debate." },
      { media_item_id: mid["Succession"],          user_id: sam,    score: 96, text: "Kendall's arc is one of TV's all-time best character studies." },
      // Private Picks reviews
      { media_item_id: mid["Oppenheimer"],         user_id: morgan, score: 96, text: "A monumental achievement in filmmaking. The IMAX scenes are breathtaking." },
      { media_item_id: mid["Oppenheimer"],         user_id: alex,   score: 88, text: "Dense but rewarding. Cillian Murphy deserved every award." },
      { media_item_id: mid["Slow Horses"],         user_id: morgan, score: 95, text: "Gary Oldman is magnetic. The most underrated spy show on TV." },
    ]);
    log.push(`created reviews`);

    // ── Step 6: Set view counts on public groups ─────────────────────────────
    await admin.from("groups").update({ view_count: 312 }).eq("id", gScifi);
    await admin.from("groups").update({ view_count: 187 }).eq("id", gHorror);
    await admin.from("groups").update({ view_count: 95  }).eq("id", gSunday);

    log.push("done");

    return new Response(JSON.stringify({ ok: true, log, users }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
