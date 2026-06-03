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

    // Risposta ambigua per sicurezza (non rivela se l'email esiste)
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

    // Salva nuovo OTP
    const { error: insertErr } = await adminClient.from('password_reset_otp').insert({
      user_id: matchedUser.id,
      email: matchedUser.email,
      code,
      expires_at: expiresAt,
      used: false,
    });
    if (insertErr) throw insertErr;

    // Genera un link di recovery Supabase con il codice OTP incorporato nel redirect URL
    // L'utente riceverà un'email Supabase standard ma con il codice OTP nel corpo
    // Usiamo l'endpoint /auth/v1/admin/generate_link per inviare email custom via SMTP Supabase
    const generateRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'recovery',
        email: matchedUser.email,
        options: {
          redirect_to: `${SUPABASE_URL}/functions/v1/reset-password`,
        },
      }),
    });

    if (!generateRes.ok) {
      const errText = await generateRes.text();
      throw new Error('Errore generazione link: ' + errText);
    }

    // Ora inviamo una email separata con il codice OTP tramite Supabase Mailer
    // usando l'endpoint interno di invio email
    const mailBody = {
      to: matchedUser.email,
      subject: `Codice recupero password: ${code}`,
      html: buildEmailHtml(code, matchedUser.email!),
    };

    // Tentiamo invio via Resend se disponibile, altrimenti via SMTP Supabase interno
    const RESEND_KEY = Deno.env.get('RESEND_API_KEY');

    if (RESEND_KEY) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Salone Gestionale <noreply@resend.dev>',
          to: [matchedUser.email!],
          subject: mailBody.subject,
          html: mailBody.html,
        }),
      });
      if (!res.ok) throw new Error('Errore Resend: ' + await res.text());
    } else {
      // Usa Supabase internal mailer endpoint
      const internalRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${matchedUser.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: { pending_otp_hint: code },
        }),
      });

      // Invia l'email tramite l'endpoint di invite che usa lo SMTP configurato
      const inviteRes = await fetch(`${SUPABASE_URL}/auth/v1/invite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: matchedUser.email,
          data: { otp_code: code },
          redirect_to: `${SUPABASE_URL}/functions/v1/verify-otp-reset`,
        }),
      });
    }

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

function buildEmailHtml(code: string, email: string): string {
  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#fafaf9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fafaf9;padding:40px 20px;">
  <tr><td align="center">
    <table width="100%" style="max-width:480px;background:#ffffff;border-radius:20px;border:1.5px solid #e7e5e4;overflow:hidden;">
      <tr>
        <td style="background:#1c1917;padding:24px 32px;text-align:center;">
          <span style="color:white;font-size:18px;font-weight:700;">&#9986; Salone Gestionale</span>
        </td>
      </tr>
      <tr>
        <td style="padding:32px;">
          <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1c1917;">Recupero Password</h2>
          <p style="margin:0 0 24px;font-size:14px;color:#78716c;line-height:1.6;">
            Hai richiesto il recupero della password per <strong>${email}</strong>.<br/>
            Inserisci il codice qui sotto nel gestionale per impostare una nuova password.
          </p>
          <div style="background:#fffbeb;border:2px dashed #f59e0b;border-radius:16px;padding:28px;text-align:center;margin-bottom:24px;">
            <p style="margin:0 0 8px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#92400e;">Codice OTP</p>
            <div style="font-size:44px;font-weight:900;letter-spacing:12px;color:#1c1917;font-family:monospace;">${code}</div>
            <p style="margin:12px 0 0;font-size:12px;color:#a8a29e;">Valido per <strong>30 minuti</strong></p>
          </div>
          <div style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:12px;padding:14px 16px;">
            <p style="margin:0;font-size:12px;color:#dc2626;line-height:1.6;">
              <strong>Non hai richiesto tu questo codice?</strong> Ignora questa email, il tuo account rimane al sicuro.
            </p>
          </div>
        </td>
      </tr>
      <tr>
        <td style="background:#fafaf9;border-top:1px solid #e7e5e4;padding:16px 32px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#a8a29e;">Email automatica &mdash; non rispondere</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
