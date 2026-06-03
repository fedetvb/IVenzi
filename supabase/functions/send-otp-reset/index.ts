import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return new Response(JSON.stringify({ error: 'Email mancante.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Cerca l'utente per email
    const { data: { users }, error: listErr } = await adminClient.auth.admin.listUsers();
    if (listErr) throw listErr;

    const matchedUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    // Risposta ambigua per sicurezza (non rivela se l'email esiste o no)
    if (!matchedUser) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    // Invalida OTP precedenti per questo utente
    await adminClient
      .from('password_reset_otp')
      .update({ used: true })
      .eq('user_id', matchedUser.id)
      .eq('used', false);

    // Salva il nuovo OTP nel database
    const { error: insertErr } = await adminClient.from('password_reset_otp').insert({
      user_id: matchedUser.id,
      email: matchedUser.email,
      code,
      expires_at: expiresAt,
      used: false,
    });
    if (insertErr) throw insertErr;

    // Invia email tramite il sistema email integrato di Supabase
    // Usiamo generateLink tipo "recovery" che usa lo SMTP già configurato nel progetto
    const { error: mailErr } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email: matchedUser.email!,
      options: {
        redirectTo: `${SUPABASE_URL}/functions/v1/reset-password?otp=${code}`,
      },
    });
    if (mailErr) throw mailErr;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
