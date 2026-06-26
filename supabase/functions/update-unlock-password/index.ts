import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const { newPassword, code, email } = await req.json();

    if (!newPassword || String(newPassword).trim().length < 4) {
      return json({ error: 'Il codice deve avere almeno 4 caratteri.' }, 400);
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (code && email) {
      // ── OTP path ──────────────────────────────────────────────────────────
      const { data: otpRow, error: fetchErr } = await adminClient
        .from('password_reset_otp')
        .select('id')
        .eq('email', String(email).toLowerCase())
        .eq('code', String(code))
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (fetchErr) throw fetchErr;
      if (!otpRow) return json({ error: 'Codice OTP non valido o scaduto.' }, 400);

      await adminClient
        .from('password_reset_otp')
        .update({ used: true })
        .eq('id', otpRow.id);
    } else {
      // ── Direct path: require valid Supabase session ───────────────────────
      const authHeader = req.headers.get('Authorization') ?? '';
      const jwt = authHeader.replace('Bearer ', '').trim();
      if (!jwt) return json({ error: 'Non autorizzato.' }, 401);

      const { error: authErr } = await adminClient.auth.getUser(jwt);
      if (authErr) return json({ error: 'Non autorizzato.' }, 401);
    }

    // ── Update system_settings ────────────────────────────────────────────
    const { error: updateErr } = await adminClient
      .from('system_settings')
      .update({ setting_value: String(newPassword).trim() })
      .eq('setting_key', 'app_unlock_password');

    if (updateErr) throw updateErr;

    return json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: msg }, 500);
  }
});
