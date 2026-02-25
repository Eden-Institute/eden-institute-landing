const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const RESEND_AUDIENCE_ID = Deno.env.get('RESEND_AUDIENCE_ID');

const TOPIC_IDS = [
  '89e7bfad-5e08-44c6-9a5c-ff8e9cf8ee1d', // Foundations Course Waitlist
  '0ed1f4b6-1b8c-4ef2-b9ca-7a7f67d3f2e6', // App Beta Waitlist
  'b87ee1ad-8592-495c-aa1d-1ddbbb7d0afd', // Book 2 Launch List
];

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

    const { firstName, email, constitutionType, source } = await req.json();

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

    // Step 2: Subscribe to each topic separately with delays to avoid rate limits
    const topicResults = [];
    for (let i = 0; i < TOPIC_IDS.length; i++) {
      const topicId = TOPIC_IDS[i];
      if (i > 0) await new Promise(r => setTimeout(r, 500)); // 500ms delay between calls
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
