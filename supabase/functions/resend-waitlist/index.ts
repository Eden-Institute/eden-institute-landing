const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const RESEND_AUDIENCE_ID = Deno.env.get('RESEND_AUDIENCE_ID');

const TOPIC_IDS = [
  '89e7bfad-5e08-44c6-9a5c-ff8e9cf8ee1d',
  '0ed1f4b6-1b8c-4ef2-b9ca-7a7f67d3f2e6',
  'b87ee1ad-8592-495c-aa1d-1ddbbb7d0afd',
];

const COURSE_AUDIENCE_ID = "4860c1c5-8e2b-4d02-838a-60ef09b789bf";
const APP_AUDIENCE_ID = "cebd3478-b344-41b7-98c8-8bcf0e0108da";

// ── Email content ──

function buildFoundationsEmail(firstName: string): { subject: string; text: string } {
  return {
    subject: "You're on the list — here's what's coming",
    text: `Hi ${firstName},

Welcome to the Eden Institute community. You're on the Foundations Course waitlist and you'll be among the first to know when enrollment opens.

The Foundations Course is built on one conviction: that God did not design the body to be dependent on a system. He designed it to be stewarded. The course teaches you the constitutional framework, the energetic language of plants, and how to match the two — from a scriptural foundation outward.

While you wait, start here: grab Book One — Back to Eden: A Biblical Foundation for Herbal Healing — and read the first three chapters. Everything the course teaches grows out of what that book establishes.

Purchase Book One: https://www.amazon.com/dp/B0GPW5BZ32

We'll be in touch soon.

— Camila Johnson
The Eden Institute`,
  };
}

function buildAppBetaEmail(firstName: string): { subject: string; text: string } {
  return {
    subject: "You're in — Eden Apothecary beta access secured",
    text: `Hi ${firstName},

You're on the Eden Apothecary beta waitlist. That means when we launch in 2026 you'll get first access — and your beta pricing locked in for life.

Here's what that means in real numbers:

Full Access: $4.99/month (regular price $19.99/month) — locked in for life
Practitioner Tier: $19.99/month (regular price $99.99/month) — locked in for life

The Eden Apothecary App is a constitutional assessment and herb matching system built on the Eclectic, Physiomedical, and Vitalist traditions — grounded in Scripture. From home herbalist to clinical practitioner, every tier is designed to meet you where you are and take you further.

While you wait, get the foundation in place. Start with Book One:
https://www.amazon.com/dp/B0GPW5BZ32

We'll reach out when beta access opens.

— Camila Johnson
The Eden Institute`,
  };
}

const constitutionProfiles: Record<string, { nickname: string; body: string }> = {
  "Hot / Dry / Tense": {
    nickname: "The Burning Bowstring",
    body: `You are intense, driven, and finely tuned — and your body runs hot. You were designed with a metabolism that generates heat and a nervous system that doesn't easily let go. This is a gift: your energy, passion, and focus are expressions of that fire. But when that fire isn't tended, it consumes.

Your body's patterns: You likely run warm, sleep lightly, and find it difficult to fully relax. Tension lives in your muscles — your jaw, your neck, your shoulders. You may be prone to headaches, skin inflammation, or digestive heat. Emotionally, you feel things sharply and deeply.

What your body needs: cooling, moistening, and releasing. Herbs that calm the heat without extinguishing your fire.

Your primary herbs: Chamomile, Feverfew, California Poppy, Lavender, American Ginseng.

Biblical anchor: 'A hot-tempered person stirs up conflict, but the one who is patient calms a quarrel.' — Proverbs 15:18. Your constitution understands this tension personally. The work is not to suppress your fire — it is to steward it.`,
  },
  "Hot / Dry / Relaxed": {
    nickname: "The Open Flame",
    body: `You carry genuine warmth — people feel it when they're around you. Your metabolism runs on the warmer side, but your tissue has a softness and laxity to it. You are warm-hearted, open, and generous, but that openness can sometimes mean poor boundaries — physically and emotionally.

Your body's patterns: Heat symptoms with poor tissue tone. You may experience varicose veins, hemorrhoids, or a tendency toward prolapse. Loose stools with heat. You absorb warmth from your environment and from people.

What your body needs: cooling and toning. Herbs that reduce heat while firming and toning lax tissue.

Your primary herbs: Yarrow, Witch Hazel, Raspberry Leaf, Goldenrod, Bayberry.

Biblical anchor: 'Like a city whose walls are broken through is a person who lacks self-control.' — Proverbs 25:28. The work of your constitution is to tend your warmth while building strong walls.`,
  },
  "Hot / Damp / Tense": {
    nickname: "The Pressure Cooker",
    body: `You hold heat and dampness simultaneously — a combination that produces pressure. There is real fire here, but it has nowhere to go.

Your body's patterns: Damp-heat patterns throughout. Acne, eczema with oozing, urinary tract infections, liver heat, congested lymphatics. Tension in the body that compounds the congestion.

What your body needs: cooling, drying, and moving. Herbs that drain heat and dampness while encouraging lymphatic circulation.

Your primary herbs: Dandelion, Burdock, Calendula, Cleavers, Chickweed.

Biblical anchor: 'He who tends a fig tree will eat its fruit.' — Proverbs 27:18. The congestion in your constitution is often the result of neglected tending. Regular, consistent care transforms the pattern.`,
  },
  "Hot / Damp / Relaxed": {
    nickname: "The Overflowing Cup",
    body: `Your constitution generates heat and holds moisture — a full, generous pattern. You are likely warm and welcoming by nature. But when out of balance, that fullness tips into excess.

Your body's patterns: Congested lymphatics, sluggish liver, skin eruptions with heat. Prone to weight gain with warmth. Social and generous, but boundaries can be unclear.

What your body needs: cooling, drying, and moving stagnation. Herbs that clear damp heat and encourage drainage.

Your primary herbs: Elder, Cleavers, Red Clover, Calendula, Dandelion.

Biblical anchor: 'My cup overflows.' — Psalm 23:5. Overflow is a blessing — but only when the cup is regularly poured out. Your work is circulation, generosity, and release.`,
  },
  "Cold / Dry / Tense": {
    nickname: "The Drawn Bowstring",
    body: `You are wound tightly and running on empty. Cold from depletion, dry from exhaustion, tense from the nervous system trying to hold everything together with insufficient resources. You may identify as anxious, hypersensitive, or prone to overthinking.

Your body's patterns: Poor circulation, cold extremities, dry skin, constipation, tension headaches, insomnia, anxiety, and chronic pain that is tight and cramping.

What your body needs: warming, moistening, and nourishing. Herbs that feed the depleted reserves while gently releasing the tension.

Your primary herbs: Ashwagandha, Ginger, Cinnamon, Asian Ginseng, Valerian, Hawthorn.

Biblical anchor: 'He gives strength to the weary and increases the power of the weak.' — Isaiah 40:29. Your constitution is not a character flaw. It is a call to receive.`,
  },
  "Cold / Dry / Relaxed": {
    nickname: "The Spent Candle",
    body: `Your reserves have been drawn down. Cold, dry, and without the tone to pull things back up — this constitution speaks of genuine depletion. You may have given much, rested little, and now find that your body simply doesn't have the same resilience it once did.

Your body's patterns: Deep fatigue, poor immunity, tendency toward atrophy or prolapse, thin tissue, dry mucous membranes, poor wound healing.

What your body needs: deep, slow nourishment. Warming, moistening, tonic herbs that rebuild rather than stimulate.

Your primary herbs: Astragalus, Asian Ginseng, Eleuthero, Marshmallow Root, Ashwagandha, Ginger.

Biblical anchor: 'He restores my soul.' — Psalm 23:3. Restoration is not earned. It is received. Your work is to stop, be still, and let the restoration come.`,
  },
  "Cold / Damp / Tense": {
    nickname: "The Frozen River",
    body: `Cold and damp with nowhere to move — the pressure builds inside while the exterior is stiff and bound. The tension here is not wired or anxious. It is cold, heavy, and immovable.

Your body's patterns: Chronic mucus, phlegm, stiff and cold joints, slow digestion, bloating, cold hands and feet with tension headaches. Tends toward melancholy or feeling unmotivated.

What your body needs: warming and moving. Herbs that ignite the cold and get things circulating again.

Your primary herbs: Cayenne, Ginger, Fennel, Garlic, Thyme, Horseradish.

Biblical anchor: 'There is a time for everything, and a season for every activity under the heavens.' — Ecclesiastes 3:1. The frozen river needs one thing: the return of warmth. Your season of movement is coming.`,
  },
  "Cold / Damp / Relaxed": {
    nickname: "The Still Pond",
    body: `Slow, cool, and full — this is the most common constitution in the modern Western world. The pattern of metabolic slowdown, fluid retention, easy weight gain, chronic fatigue, and a sluggish immune system is epidemic. It is not a moral failure or a lack of willpower. It is a constitutional pattern — and it responds beautifully to constitutional care.

Your body's patterns: Sluggish metabolism, weight gain, fluid retention, brain fog, chronic fatigue, frequent illness, low thyroid signs. Often presents as 'I just can't get going.'

What your body needs: warming, drying, and stimulating. Herbs that ignite the metabolism, move the lymphatics, and restore the body's thermostat.

Your primary herbs: Cayenne, Ginger, Cinnamon, Garlic, Eleuthero, Astragalus, Fennel.

Biblical anchor: 'Wake up, sleeper, rise from the dead, and Christ will shine on you.' — Ephesians 5:14. This is not a judgment — it is an invitation. The still pond can move. The body was designed to wake up.`,
  },
};

function buildAssessmentEmail(firstName: string, constitutionType: string): { subject: string; text: string } {
  const profile = constitutionProfiles[constitutionType];
  if (!profile) {
    return {
      subject: `Your constitutional type: ${constitutionType}`,
      text: `Hi ${firstName},\n\nYour constitutional assessment is complete. Your type is: ${constitutionType}.\n\nVisit https://edeninstitute.health/#foundation for more.\n\n— Camila Johnson\nThe Eden Institute`,
    };
  }
  return {
    subject: `Your constitutional type: ${constitutionType} — ${profile.nickname}`,
    text: `Hi ${firstName},

Your constitutional assessment is complete. Here is your full profile.

——————————————
YOUR CONSTITUTIONAL TYPE: ${constitutionType}
${profile.nickname}
——————————————

${profile.body}

——————————————
WHAT THIS MEANS FOR YOU

Understanding your constitution is the beginning — not the end. The Foundations Course teaches you how to read your constitution in real time, how to track it as it shifts with seasons and stress, and how to match it precisely to God's provision in the plant world.

You were not designed to guess. You were designed to know.

→ Join the Foundations Course Waitlist: https://edeninstitute.health/#foundation
→ Purchase Book One — Back to Eden: https://www.amazon.com/dp/B0GPW5BZ32

— Camila Johnson
The Eden Institute`,
  };
}

// ── Send email helper ──

async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'The Eden Institute <hello@edeninstitute.health>',
      reply_to: 'hello@edeninstitute.health',
      to: [to],
      subject,
      text,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('Email send failed:', res.status, JSON.stringify(data));
  } else {
    console.log('Email sent successfully:', JSON.stringify(data));
  }
}

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY || !RESEND_AUDIENCE_ID) {
      console.error('Missing env vars:', { hasKey: !!RESEND_API_KEY, hasAudience: !!RESEND_AUDIENCE_ID });
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { firstName, email, audienceId, constitutionType, source } = await req.json();

    if (!firstName || !email) {
      return new Response(
        JSON.stringify({ error: 'Name and email are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Add/update contact in the audience
    const contactRes = await fetch(`https://api.resend.com/audiences/${RESEND_AUDIENCE_ID}/contacts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        first_name: firstName,
        unsubscribed: false,
      }),
    });

    const contactData = await contactRes.json();
    console.log('Contact creation response:', contactRes.status, JSON.stringify(contactData));

    if (!contactRes.ok && contactRes.status !== 409) {
      return new Response(
        JSON.stringify({ error: contactData.message || 'Failed to add contact' }),
        { status: contactRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Subscribe to each topic separately with delays
    const topicResults = [];
    for (let i = 0; i < TOPIC_IDS.length; i++) {
      const topicId = TOPIC_IDS[i];
      if (i > 0) await new Promise(r => setTimeout(r, 500));
      try {
        const topicRes = await fetch(`https://api.resend.com/audiences/${RESEND_AUDIENCE_ID}/contacts`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            first_name: firstName,
            unsubscribed: false,
          }),
        });
        const topicData = await topicRes.json();
        console.log(`Topic ${topicId} response:`, topicRes.status, JSON.stringify(topicData));
        topicResults.push({ topicId, status: topicRes.status, ok: topicRes.ok });
      } catch (topicErr) {
        console.error(`Topic ${topicId} error:`, topicErr.message);
        topicResults.push({ topicId, error: topicErr.message });
      }
    }

    // Step 3: Send welcome/results email (fire-and-forget — don't block the response)
    let emailContent: { subject: string; text: string } | null = null;

    if (source === 'constitution_assessment' && constitutionType) {
      emailContent = buildAssessmentEmail(firstName, constitutionType);
    } else if (audienceId === COURSE_AUDIENCE_ID) {
      emailContent = buildFoundationsEmail(firstName);
    } else if (audienceId === APP_AUDIENCE_ID) {
      emailContent = buildAppBetaEmail(firstName);
    }

    if (emailContent) {
      // Don't await — send email in background so user sees success immediately
      sendEmail(email, emailContent.subject, emailContent.text).catch((err) => {
        console.error('Background email send error:', err.message);
      });
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Your results are on their way. Check your inbox.', constitutionType, source, topicResults }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Unhandled error:', err.message, err.stack);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
