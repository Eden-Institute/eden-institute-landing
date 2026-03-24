// PDF generation is handled by the constitution-pdf edge function
import { buildNurtureEmail1, buildNurtureEmail2, buildNurtureEmail3, buildNurtureEmail4, toSlug } from '../_shared/nurture-email-templates.ts';

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

// Map 8 quiz types to 4 PDF categories
function getPDFCategory(constitutionType: string): string {
  if (constitutionType.startsWith("Hot") && constitutionType.includes("Dry")) return "hot-dry";
  if (constitutionType.startsWith("Hot") && constitutionType.includes("Damp")) return "hot-damp";
  if (constitutionType.startsWith("Cold") && constitutionType.includes("Dry")) return "cold-dry";
  if (constitutionType.startsWith("Cold") && constitutionType.includes("Damp")) return "cold-damp";
  return "hot-dry"; // fallback
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function fetchConstitutionPDF(category: string): Promise<Uint8Array> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const url = `${supabaseUrl}/functions/v1/constitution-pdf?type=${category}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${serviceRoleKey}`,
    },
  });
  if (!res.ok) {
    throw new Error(`PDF fetch failed: ${res.status}`);
  }
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

// Old generateConstitutionPDF removed — now fetched from constitution-pdf edge function

// ── Shared HTML components ──

function emailWrapper(bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>The Eden Institute</title></head>
<body style="margin:0;padding:0;background-color:#F5F0E8;font-family:Georgia,serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F0E8;">
<tr><td align="center" style="padding:20px 10px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#FFFFFF;">
<!-- HEADER -->
<tr><td style="background-color:#1C3A2E;padding:40px 20px;text-align:center;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="text-align:center;font-family:Georgia,serif;font-size:13px;font-weight:bold;letter-spacing:4px;color:#C9A84C;text-transform:uppercase;">THE EDEN INSTITUTE</td></tr>
<tr><td align="center" style="padding:16px 0;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="width:60px;border-top:1px solid #C9A84C;font-size:0;line-height:0;">&nbsp;</td></tr></table>
</td></tr>
<tr><td style="text-align:center;font-family:Georgia,serif;font-size:14px;color:#F5F0E8;font-style:italic;">Back to Eden. Back to Truth.</td></tr>
</table>
</td></tr>
<!-- BODY -->
<tr><td style="background-color:#FFFFFF;padding:32px 40px;">
${bodyContent}
</td></tr>
<!-- FOOTER -->
<tr><td style="background-color:#F5F0E8;padding:30px 20px;text-align:center;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-family:Georgia,serif;font-size:13px;color:#1C3A2E;text-align:center;">The Eden Institute | edeninstitute.health</td></tr>
<tr><td style="font-family:Georgia,serif;font-size:12px;color:#1C3A2E;text-align:center;padding-top:8px;">You're receiving this because you signed up at edeninstitute.health. No spam, ever.</td></tr>
<tr><td style="text-align:center;padding-top:8px;"><a href="https://edeninstitute.health/unsubscribe" style="font-family:Georgia,serif;font-size:12px;color:#C9A84C;text-decoration:underline;">Unsubscribe</a></td></tr>
</table>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function goldDivider(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #C9A84C;font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr></table>`;
}

function goldLabel(text: string): string {
  return `<p style="font-family:Georgia,serif;font-size:12px;font-weight:bold;letter-spacing:3px;color:#C9A84C;text-transform:uppercase;margin:0 0 16px 0;">${text}</p>`;
}

function ctaButton(label: string, href: string, variant: 'primary' | 'secondary' = 'primary'): string {
  const bg = variant === 'primary' ? '#1C3A2E' : '#F5F0E8';
  const color = variant === 'primary' ? '#F5F0E8' : '#1C3A2E';
  const border = variant === 'secondary' ? 'border:2px solid #1C3A2E;' : '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0;">
<a href="${href}" target="_blank" style="display:inline-block;background-color:${bg};color:${color};${border}font-family:Georgia,serif;font-size:14px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;text-decoration:none;padding:16px 32px;">${label}</a>
</td></tr></table>`;
}

function closingBlock(): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:24px 0 4px 0;">We'll be in touch soon.</p>
<p style="font-family:Georgia,serif;font-size:16px;color:#1C3A2E;font-weight:bold;margin:0;">— Camila Johnson</p>
<p style="font-family:Georgia,serif;font-size:14px;color:#C9A84C;margin:4px 0 0 0;">The Eden Institute</p>`;
}

// ── Email builders ──

function buildFoundationsEmail(firstName: string): { subject: string; html: string } {
  const body = `
<p style="font-family:Georgia,serif;font-size:18px;color:#1C3A2E;margin:0 0 24px 0;">Hi ${firstName},</p>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 8px 0;">Welcome to the Eden Institute. You're officially on the Foundations Course waitlist — and you'll be among the first to know when enrollment opens.</p>
${goldDivider()}
${goldLabel('WHILE YOU WAIT')}
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 16px 0;">The Foundations Course is built on one conviction: that God did not design the body to be dependent on a system. He designed it to be stewarded. The course teaches you the constitutional framework, the energetic language of plants, and how to match the two — from a scriptural foundation outward.</p>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 24px 0;">Start here. Grab Book One and read the first three chapters. Everything the course teaches grows out of what that book establishes.</p>
${ctaButton('→ PURCHASE BOOK ONE', 'https://www.amazon.com/dp/B0GPW5BZ32')}
${goldDivider()}
${closingBlock()}`;
  return { subject: "You're on the list — here's what's coming", html: emailWrapper(body) };
}

function buildAppBetaEmail(firstName: string): { subject: string; html: string } {
  const body = `
<p style="font-family:Georgia,serif;font-size:18px;color:#1C3A2E;margin:0 0 24px 0;">Hi ${firstName},</p>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 8px 0;">You're on the Eden Apothecary beta waitlist. That means first access when we launch in 2026 — and your pricing locked in for life.</p>
${goldDivider()}
${goldLabel('YOUR BETA PRICING — LOCKED IN FOR LIFE')}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
<tr><td style="background-color:#F5F0E8;padding:20px;text-align:center;border-bottom:1px solid #FFFFFF;">
<p style="font-family:Georgia,serif;font-size:16px;font-weight:bold;color:#1C3A2E;margin:0 0 8px 0;">Full Access Tier</p>
<p style="font-family:Georgia,serif;font-size:20px;font-weight:bold;color:#C9A84C;margin:0 0 4px 0;">$4.99/month during beta</p>
<p style="font-family:Georgia,serif;font-size:13px;color:#999999;margin:0;"><s>Regular price: $19.99/month</s></p>
</td></tr>
<tr><td style="background-color:#F5F0E8;padding:20px;text-align:center;">
<p style="font-family:Georgia,serif;font-size:16px;font-weight:bold;color:#1C3A2E;margin:0 0 8px 0;">Practitioner Tier</p>
<p style="font-family:Georgia,serif;font-size:20px;font-weight:bold;color:#C9A84C;margin:0 0 4px 0;">$19.99/month during beta</p>
<p style="font-family:Georgia,serif;font-size:13px;color:#999999;margin:0;"><s>Regular price: $99.99/month</s></p>
</td></tr>
</table>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 16px 0;">The Eden Apothecary App is a constitutional assessment and herb matching system built on the Eclectic, Physiomedical, and Vitalist traditions — grounded in Scripture. From home herbalist to clinical practitioner, every tier is designed to meet you where you are.</p>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 24px 0;">While you wait, get the foundation in place.</p>
${ctaButton('→ START WITH BOOK ONE', 'https://www.amazon.com/dp/B0GPW5BZ32')}
${goldDivider()}
${closingBlock()}`;
  return { subject: "You're in — Eden Apothecary beta access secured", html: emailWrapper(body) };
}

// ── Constitutional profiles ──

const constitutionProfiles: Record<string, { nickname: string; intro: string; patterns: string; needs: string; herbs: string; anchor: string }> = {
  "Hot / Dry / Tense": {
    nickname: "The Burning Bowstring",
    intro: "You are intense, driven, and finely tuned — and your body runs hot. You were designed with a metabolism that generates heat and a nervous system that doesn't easily let go. This is a gift: your energy, passion, and focus are expressions of that fire. But when that fire isn't tended, it consumes.",
    patterns: "You likely run warm, sleep lightly, and find it difficult to fully relax. Tension lives in your muscles — your jaw, your neck, your shoulders. You may be prone to headaches, skin inflammation, or digestive heat. Emotionally, you feel things sharply and deeply.",
    needs: "Cooling, moistening, and releasing. Herbs that calm the heat without extinguishing your fire.",
    herbs: "Chamomile, Feverfew, California Poppy, Lavender, American Ginseng.",
    anchor: "'A hot-tempered person stirs up conflict, but the one who is patient calms a quarrel.' — Proverbs 15:18. Your constitution understands this tension personally. The work is not to suppress your fire — it is to steward it.",
  },
  "Hot / Dry / Relaxed": {
    nickname: "The Open Flame",
    intro: "You carry genuine warmth — people feel it when they're around you. Your metabolism runs on the warmer side, but your tissue has a softness and laxity to it. You are warm-hearted, open, and generous, but that openness can sometimes mean poor boundaries — physically and emotionally.",
    patterns: "Heat symptoms with poor tissue tone. You may experience varicose veins, hemorrhoids, or a tendency toward prolapse. Loose stools with heat. You absorb warmth from your environment and from people.",
    needs: "Cooling and toning. Herbs that reduce heat while firming and toning lax tissue.",
    herbs: "Yarrow, Witch Hazel, Raspberry Leaf, Goldenrod, Bayberry.",
    anchor: "'Like a city whose walls are broken through is a person who lacks self-control.' — Proverbs 25:28. The work of your constitution is to tend your warmth while building strong walls.",
  },
  "Hot / Damp / Tense": {
    nickname: "The Pressure Cooker",
    intro: "You hold heat and dampness simultaneously — a combination that produces pressure. There is real fire here, but it has nowhere to go.",
    patterns: "Damp-heat patterns throughout. Acne, eczema with oozing, urinary tract infections, liver heat, congested lymphatics. Tension in the body that compounds the congestion.",
    needs: "Cooling, drying, and moving. Herbs that drain heat and dampness while encouraging lymphatic circulation.",
    herbs: "Dandelion, Burdock, Calendula, Cleavers, Chickweed.",
    anchor: "'He who tends a fig tree will eat its fruit.' — Proverbs 27:18. The congestion in your constitution is often the result of neglected tending. Regular, consistent care transforms the pattern.",
  },
  "Hot / Damp / Relaxed": {
    nickname: "The Overflowing Cup",
    intro: "Your constitution generates heat and holds moisture — a full, generous pattern. You are likely warm and welcoming by nature. But when out of balance, that fullness tips into excess.",
    patterns: "Congested lymphatics, sluggish liver, skin eruptions with heat. Prone to weight gain with warmth. Social and generous, but boundaries can be unclear.",
    needs: "Cooling, drying, and moving stagnation. Herbs that clear damp heat and encourage drainage.",
    herbs: "Elder, Cleavers, Red Clover, Calendula, Dandelion.",
    anchor: "'My cup overflows.' — Psalm 23:5. Overflow is a blessing — but only when the cup is regularly poured out. Your work is circulation, generosity, and release.",
  },
  "Cold / Dry / Tense": {
    nickname: "The Drawn Bowstring",
    intro: "You are wound tightly and running on empty. Cold from depletion, dry from exhaustion, tense from the nervous system trying to hold everything together with insufficient resources. You may identify as anxious, hypersensitive, or prone to overthinking.",
    patterns: "Poor circulation, cold extremities, dry skin, constipation, tension headaches, insomnia, anxiety, and chronic pain that is tight and cramping.",
    needs: "Warming, moistening, and nourishing. Herbs that feed the depleted reserves while gently releasing the tension.",
    herbs: "Ashwagandha, Ginger, Cinnamon, Asian Ginseng, Valerian, Hawthorn.",
    anchor: "'He gives strength to the weary and increases the power of the weak.' — Isaiah 40:29. Your constitution is not a character flaw. It is a call to receive.",
  },
  "Cold / Dry / Relaxed": {
    nickname: "The Spent Candle",
    intro: "Your reserves have been drawn down. Cold, dry, and without the tone to pull things back up — this constitution speaks of genuine depletion. You may have given much, rested little, and now find that your body simply doesn't have the same resilience it once did.",
    patterns: "Deep fatigue, poor immunity, tendency toward atrophy or prolapse, thin tissue, dry mucous membranes, poor wound healing.",
    needs: "Deep, slow nourishment. Warming, moistening, tonic herbs that rebuild rather than stimulate.",
    herbs: "Astragalus, Asian Ginseng, Eleuthero, Marshmallow Root, Ashwagandha, Ginger.",
    anchor: "'He restores my soul.' — Psalm 23:3. Restoration is not earned. It is received. Your work is to stop, be still, and let the restoration come.",
  },
  "Cold / Damp / Tense": {
    nickname: "The Frozen Knot",
    intro: "Cold and damp with nowhere to move — the pressure builds inside while the exterior is stiff and bound. The tension here is not wired or anxious. It is cold, heavy, and immovable.",
    patterns: "Chronic mucus, phlegm, stiff and cold joints, slow digestion, bloating, cold hands and feet with tension headaches. Tends toward melancholy or feeling unmotivated.",
    needs: "Warming and moving. Herbs that ignite the cold and get things circulating again.",
    herbs: "Cayenne, Ginger, Fennel, Garlic, Thyme, Horseradish.",
    anchor: "'There is a time for everything, and a season for every activity under the heavens.' — Ecclesiastes 3:1. The frozen river needs one thing: the return of warmth. Your season of movement is coming.",
  },
  "Cold / Damp / Relaxed": {
    nickname: "The Still Water",
    intro: "Slow, cool, and full — this is the most common constitution in the modern Western world. The pattern of metabolic slowdown, fluid retention, easy weight gain, chronic fatigue, and a sluggish immune system is epidemic. It is not a moral failure or a lack of willpower. It is a constitutional pattern — and it responds beautifully to constitutional care.",
    patterns: "Sluggish metabolism, weight gain, fluid retention, brain fog, chronic fatigue, frequent illness, low thyroid signs. Often presents as 'I just can't get going.'",
    needs: "Warming, drying, and stimulating. Herbs that ignite the metabolism, move the lymphatics, and restore the body's thermostat.",
    herbs: "Cayenne, Ginger, Cinnamon, Garlic, Eleuthero, Astragalus, Fennel.",
    anchor: "'Wake up, sleeper, rise from the dead, and Christ will shine on you.' — Ephesians 5:14. This is not a judgment — it is an invitation. The still pond can move. The body was designed to wake up.",
  },
};

function buildAssessmentEmail(firstName: string, constitutionType: string): { subject: string; html: string } {
  const profile = constitutionProfiles[constitutionType];
  if (!profile) {
    const fallback = `<p style="font-family:Georgia,serif;font-size:16px;color:#1C3A2E;">Hi ${firstName},</p><p style="font-family:Georgia,serif;font-size:16px;color:#1C3A2E;">Your constitutional assessment is complete. Your type is: ${constitutionType}.</p>`;
    return { subject: `Your constitutional type: ${constitutionType}`, html: emailWrapper(fallback) };
  }

  const body = `
<p style="font-family:Georgia,serif;font-size:18px;color:#1C3A2E;margin:0 0 24px 0;">Hi ${firstName},</p>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 8px 0;">Your constitutional assessment is complete. Here is your full profile.</p>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 8px 0;"><strong>Your personalized Constitutional Guide is attached to this email as a PDF</strong> — save it, print it, or keep it for reference.</p>
${goldDivider()}
<!-- Constitutional Type Display Block -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #C9A84C;background-color:#F5F0E8;margin-bottom:24px;">
<tr><td style="padding:30px;text-align:center;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-family:Georgia,serif;font-size:12px;font-weight:bold;letter-spacing:3px;color:#C9A84C;text-transform:uppercase;text-align:center;padding-bottom:12px;">YOUR CONSTITUTIONAL TYPE</td></tr>
<tr><td style="font-family:Georgia,serif;font-size:28px;font-weight:bold;color:#1C3A2E;text-align:center;padding-bottom:8px;">${constitutionType}</td></tr>
<tr><td style="font-family:Georgia,serif;font-size:18px;font-style:italic;color:#C9A84C;text-align:center;">${profile.nickname}</td></tr>
</table>
</td></tr>
</table>
${goldDivider()}
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 20px 0;">${profile.intro}</p>
<p style="font-family:Georgia,serif;font-size:16px;font-weight:bold;color:#1C3A2E;margin:0 0 8px 0;">Your body's patterns:</p>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 20px 0;">${profile.patterns}</p>
<p style="font-family:Georgia,serif;font-size:16px;font-weight:bold;color:#1C3A2E;margin:0 0 8px 0;">What your body needs:</p>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 20px 0;">${profile.needs}</p>
<p style="font-family:Georgia,serif;font-size:16px;font-weight:bold;color:#1C3A2E;margin:0 0 8px 0;">Your primary herbs:</p>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 20px 0;">${profile.herbs}</p>
<!-- Biblical Anchor Block -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
<tr>
<td style="width:4px;background-color:#C9A84C;"></td>
<td style="background-color:#F5F0E8;padding:20px;">
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;font-style:italic;margin:0;"><strong>Biblical anchor:</strong> ${profile.anchor}</p>
</td>
</tr>
</table>
${goldDivider()}
${goldLabel('WHAT THIS MEANS FOR YOU')}
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 16px 0;">Understanding your constitution is the beginning — not the end. The Foundations Course teaches you how to read your constitution in real time, how to track it as it shifts with seasons and stress, and how to match it precisely to God's provision in the plant world.</p>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;font-weight:bold;margin:0 0 24px 0;">You were not designed to guess. You were designed to know.</p>
${ctaButton('→ JOIN THE FOUNDATIONS COURSE WAITLIST', 'https://edeninstitute.health/#foundation')}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:12px;font-size:0;line-height:0;">&nbsp;</td></tr></table>
${ctaButton('→ PURCHASE BOOK ONE', 'https://www.amazon.com/dp/B0GPW5BZ32', 'secondary')}
${goldDivider()}
<p style="font-family:Georgia,serif;font-size:16px;color:#1C3A2E;font-weight:bold;margin:0;">— Camila Johnson</p>
<p style="font-family:Georgia,serif;font-size:14px;color:#C9A84C;margin:4px 0 0 0;">The Eden Institute</p>`;

  return {
    subject: `Your constitutional type: ${constitutionType} — ${profile.nickname}`,
    html: emailWrapper(body),
  };
}

// ── Send email helper ──

async function sendEmail(to: string, subject: string, html: string, attachments?: Array<{ filename: string; content: string }>): Promise<void> {
  const payload: any = {
    from: 'The Eden Institute <hello@edeninstitute.health>',
    reply_to: 'hello@edeninstitute.health',
    to: [to],
    subject,
    html,
  };

  if (attachments && attachments.length > 0) {
    payload.attachments = attachments;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
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

    const { firstName, email, audienceId, constitutionType, constitutionNickname, source } = await req.json();

    if (!firstName || !email) {
      return new Response(
        JSON.stringify({ error: 'Name and email are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build contact properties for quiz submissions
    const contactProperties: Record<string, string> = {};
    if (constitutionType) {
      const nickname = constitutionNickname || constitutionProfiles[constitutionType]?.nickname || '';
      const slug = nickname ? toSlug(nickname) : '';
      contactProperties.constitution_type = slug;
      contactProperties.constitution_name = nickname;
      contactProperties.quiz_completed_at = new Date().toISOString();
      contactProperties.purchased_guide = 'false';
      contactProperties.purchased_course = 'false';
    }

    // Step 1: Add/update contact in the audience (try with properties, fallback without)
    const hasProperties = Object.keys(contactProperties).length > 0;
    const baseContactPayload = { email, first_name: firstName, unsubscribed: false };

    let contactRes = await fetch(`https://api.resend.com/audiences/${RESEND_AUDIENCE_ID}/contacts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(hasProperties ? { ...baseContactPayload, properties: contactProperties } : baseContactPayload),
    });

    let contactData = await contactRes.json();
    console.log('Contact creation response:', contactRes.status, JSON.stringify(contactData));

    // If properties don't exist in Resend yet, retry without them
    if (contactRes.status === 422 && hasProperties) {
      console.warn('Properties not found on audience — retrying without properties. Create constitution_type and constitution_name properties in Resend Audience settings.');
      await new Promise(r => setTimeout(r, 300));
      contactRes = await fetch(`https://api.resend.com/audiences/${RESEND_AUDIENCE_ID}/contacts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(baseContactPayload),
      });
      contactData = await contactRes.json();
      console.log('Contact creation retry (no props):', contactRes.status, JSON.stringify(contactData));
    }

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

    // Step 3: Send welcome/results email
    let emailContent: { subject: string; html: string } | null = null;
    let pdfAttachments: Array<{ filename: string; content: string }> | undefined;

    if (source === 'constitution_assessment' && constitutionType) {
      emailContent = buildAssessmentEmail(firstName, constitutionType);

      // Fetch comprehensive PDF from constitution-pdf edge function
      try {
        const pdfCategory = getPDFCategory(constitutionType);
        console.log(`Fetching PDF for category: ${pdfCategory}`);
        const pdfBytes = await fetchConstitutionPDF(pdfCategory);
        const pdfBase64 = uint8ArrayToBase64(pdfBytes);
        pdfAttachments = [{
          filename: `Eden-Institute-${pdfCategory}-constitution-guide.pdf`,
          content: pdfBase64,
        }];
        console.log(`PDF fetched: ${pdfBytes.length} bytes`);
      } catch (pdfErr) {
        console.error('PDF fetch failed:', pdfErr.message);
        // Continue without attachment — email still sends
      }

      // Step 3b: Record quiz completion and schedule nurture emails
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      if (serviceRoleKey && supabaseUrl) {
        const nickname = constitutionNickname || constitutionProfiles[constitutionType]?.nickname || '';
        const slug = nickname ? toSlug(nickname) : '';

        // Check for existing quiz completion (duplicate prevention)
        const checkRes = await fetch(
          `${supabaseUrl}/rest/v1/quiz_completions?email=eq.${encodeURIComponent(email)}&select=id,email_1_sent_at&limit=1`,
          {
            headers: {
              'apikey': serviceRoleKey,
              'Authorization': `Bearer ${serviceRoleKey}`,
              'Content-Type': 'application/json',
            },
          }
        );
        const existing = await checkRes.json();
        const alreadyNurtured = Array.isArray(existing) && existing.length > 0 && existing[0].email_1_sent_at;

        if (alreadyNurtured) {
          // User retook quiz — update constitution info but DON'T re-send nurture sequence
          console.log(`Existing nurture sequence for ${email} — updating constitution info only`);
          await fetch(
            `${supabaseUrl}/rest/v1/quiz_completions?email=eq.${encodeURIComponent(email)}`,
            {
              method: 'PATCH',
              headers: {
                'apikey': serviceRoleKey,
                'Authorization': `Bearer ${serviceRoleKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal',
              },
              body: JSON.stringify({
                constitution_type: constitutionType,
                constitution_nickname: nickname,
              }),
            }
          );
        } else {
          // New quiz completion — insert row and schedule nurture emails 1-4
          const now = new Date();
          const nowIso = now.toISOString();

          // Insert or update quiz_completion row
          if (Array.isArray(existing) && existing.length > 0) {
            // Row exists but no emails sent yet — update it
            await fetch(
              `${supabaseUrl}/rest/v1/quiz_completions?email=eq.${encodeURIComponent(email)}`,
              {
                method: 'PATCH',
                headers: {
                  'apikey': serviceRoleKey,
                  'Authorization': `Bearer ${serviceRoleKey}`,
                  'Content-Type': 'application/json',
                  'Prefer': 'return=minimal',
                },
                body: JSON.stringify({
                  constitution_type: constitutionType,
                  constitution_nickname: nickname,
                  email_1_sent_at: nowIso,
                  email_2_sent_at: nowIso,
                  email_3_sent_at: nowIso,
                  email_4_sent_at: nowIso,
                }),
              }
            );
          } else {
            // Brand new row
            await fetch(`${supabaseUrl}/rest/v1/quiz_completions`, {
              method: 'POST',
              headers: {
                'apikey': serviceRoleKey,
                'Authorization': `Bearer ${serviceRoleKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal',
              },
              body: JSON.stringify({
                email,
                first_name: firstName,
                constitution_type: constitutionType,
                constitution_nickname: nickname,
                email_1_sent_at: nowIso,
                email_2_sent_at: nowIso,
                email_3_sent_at: nowIso,
                email_4_sent_at: nowIso,
              }),
            });
          }
          console.log('Quiz completion recorded, scheduling nurture emails');

          // Schedule nurture emails 1-4 via Resend (fire-and-forget)
          const scheduleNurture = async () => {
            try {
              const sendHeaders = {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
              };
              const from = 'Camila at The Eden Institute <hello@edeninstitute.health>';
              const replyTo = 'hello@edeninstitute.health';

              // Email 1 — immediate
              const e1 = buildNurtureEmail1(firstName, nickname, slug);
              await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: sendHeaders,
                body: JSON.stringify({ from, reply_to: replyTo, to: [email], subject: e1.subject, html: e1.html }),
              });
              console.log('Nurture Email 1 sent to', email);

              // Email 2 — Day 3
              const e2 = buildNurtureEmail2(firstName, nickname, slug);
              const day3 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
              await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: sendHeaders,
                body: JSON.stringify({ from, reply_to: replyTo, to: [email], subject: e2.subject, html: e2.html, scheduled_at: day3 }),
              });
              console.log('Nurture Email 2 scheduled for', day3);

              // Email 3 — Day 7
              const e3 = buildNurtureEmail3(firstName, nickname, slug);
              const day7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
              await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: sendHeaders,
                body: JSON.stringify({ from, reply_to: replyTo, to: [email], subject: e3.subject, html: e3.html, scheduled_at: day7 }),
              });
              console.log('Nurture Email 3 scheduled for', day7);

              // Email 4 — Day 10
              const e4 = buildNurtureEmail4(firstName, nickname, slug);
              const day10 = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString();
              await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: sendHeaders,
                body: JSON.stringify({ from, reply_to: replyTo, to: [email], subject: e4.subject, html: e4.html, scheduled_at: day10 }),
              });
              console.log('Nurture Email 4 scheduled for', day10);
            } catch (nurtureErr) {
              console.error('Nurture scheduling error:', nurtureErr.message);
            }
          };

          // Fire-and-forget — don't block the response
          scheduleNurture().catch(err => console.error('Nurture scheduling failed:', err.message));
        }
      }
    } else if (audienceId === COURSE_AUDIENCE_ID) {
      emailContent = buildFoundationsEmail(firstName);
    } else if (audienceId === APP_AUDIENCE_ID) {
      emailContent = buildAppBetaEmail(firstName);
    }

    if (emailContent) {
      sendEmail(email, emailContent.subject, emailContent.html, pdfAttachments).catch((err) => {
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
