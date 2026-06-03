import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendEmail(to: string, code: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Salone Gestionale <onboarding@resend.dev>',
      to: [to],
      subject: 'Codice di reset password',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #1c1917; margin-bottom: 8px;">Reset password</h2>
          <p style="color: #78716c; margin-bottom: 24px;">Hai richiesto il reset della password per il tuo account Salone Gestionale.</p>
          <div style="background: #f5f5f4; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <p style="color: #78716c; font-size: 14px; margin: 0 0 8px 0;">Il tuo codice di verifica</p>
            <p style="color: #1c1917; font-size: 36px; font-weight: 700; letter-spacing: 8px; margin: 0;">${code}</p>
          </div>
          <p style="color: #a8a29e; font-size: 13px;">Il codice scade tra 30 minuti. Se non hai richiesto il reset, ignora questa email.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
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

    // Salva il nuovo OTP
    const { error: insertErr } = await adminClient.from('password_reset_otp').insert({
      user_id: matchedUser.id,
      email: matchedUser.email,
      code,
      expires_at: expiresAt,
      used: false,
    });
    if (insertErr) throw insertErr;

    // Invia email con Resend
    await sendEmail(matchedUser.email!, code);

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
