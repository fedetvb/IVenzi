const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const html = (supabaseUrl: string, anonKey: string) => `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Nuova Password - Salone Gestionale</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:linear-gradient(135deg,#fafaf9 0%,#fffbeb 100%);min-height:100vh;color:#1c1917;display:flex;flex-direction:column}
.header{background:white;border-bottom:1.5px solid #e7e5e4;padding:20px 24px;text-align:center}
.hi{display:inline-flex;align-items:center;gap:10px;margin-bottom:4px}
.logo{width:36px;height:36px;background:#f59e0b;border-radius:10px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(245,158,11,.3)}
.logo svg{width:18px;height:18px;fill:none;stroke:white;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.header h1{font-size:18px;font-weight:700;color:#1c1917}
.header p{font-size:13px;color:#78716c}
.container{max-width:420px;margin:0 auto;padding:40px 20px 60px;flex:1}
.card{background:white;border-radius:20px;border:1.5px solid #e7e5e4;padding:32px;box-shadow:0 4px 24px rgba(0,0,0,.06)}
.card-title{font-size:20px;font-weight:700;color:#1c1917;margin-bottom:6px}
.card-desc{font-size:13px;color:#78716c;margin-bottom:24px;line-height:1.6}
.fg{margin-bottom:16px}
label{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#57534e;margin-bottom:6px}
.iw{position:relative}
.iico{position:absolute;left:14px;top:50%;transform:translateY(-50%);pointer-events:none}
.iico svg{width:16px;height:16px;fill:none;stroke:#a8a29e;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.eye{position:absolute;right:14px;top:50%;transform:translateY(-50%);cursor:pointer;background:none;border:none;padding:0;color:#a8a29e}
.eye:hover{color:#57534e}
.eye svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
input{width:100%;padding:13px 44px;background:#fafaf9;border:1.5px solid #e7e5e4;border-radius:14px;font-size:14px;color:#1c1917;outline:none;transition:border-color .15s,box-shadow .15s;font-family:inherit}
input:focus{border-color:#f59e0b;box-shadow:0 0 0 3px rgba(245,158,11,.15);background:white}
input::placeholder{color:#c4bfbb}
.strength{height:4px;border-radius:2px;margin-top:8px;transition:all .3s;background:#e7e5e4}
.strength-text{font-size:11px;margin-top:4px}
.btn{width:100%;padding:15px;background:#f59e0b;color:white;font-size:15px;font-weight:700;border:none;border-radius:14px;cursor:pointer;transition:background .15s,transform .1s,box-shadow .15s;box-shadow:0 4px 14px rgba(245,158,11,.35);margin-top:8px}
.btn:hover{background:#e89000;box-shadow:0 6px 18px rgba(245,158,11,.4)}
.btn:active{transform:scale(.98)}
.btn:disabled{opacity:.5;cursor:not-allowed;box-shadow:none;transform:none}
.alert{display:flex;align-items:flex-start;gap:10px;border-radius:12px;padding:12px 16px;font-size:13px;margin-bottom:16px;line-height:1.5}
.alert svg{flex-shrink:0;width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;margin-top:1px}
.alert-err{background:#fef2f2;border:1.5px solid #fecaca;color:#dc2626}
.alert-ok{background:#f0fdf4;border:1.5px solid #bbf7d0;color:#16a34a}
.alert-warn{background:#fffbeb;border:1.5px solid #fde68a;color:#92400e}
.success-wrap{text-align:center;padding:20px 0}
.success-icon{width:80px;height:80px;background:#dcfce7;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;box-shadow:0 4px 20px rgba(22,163,74,.2)}
.success-icon svg{width:36px;height:36px;fill:none;stroke:#16a34a;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}
.success-wrap h2{font-size:22px;font-weight:800;color:#1c1917;margin-bottom:10px}
.success-wrap p{font-size:14px;color:#78716c;line-height:1.7}
.loading{text-align:center;padding:40px 0;color:#78716c;font-size:14px}
</style>
</head>
<body>
<div class="header">
  <div class="hi">
    <div class="logo">
      <svg viewBox="0 0 24 24"><path d="M6 3c1.5 0 3 1.5 3 3S6 12 6 12 3 9 3 6s1.5-3 3-3z"/><path d="M18 3c1.5 0 3 1.5 3 3s-3 6-3 6-3-3-3-6 1.5-3 3-3z"/><path d="M6 12l6 9 6-9"/></svg>
    </div>
    <h1>Salone Gestionale</h1>
  </div>
  <p>Reimpostazione password</p>
</div>

<div class="container">
  <div class="card">
    <div id="app"><div class="loading">Verifica token in corso...</div></div>
  </div>
</div>

<script type="module">
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabase = createClient('${supabaseUrl}', '${anonKey}');
const app = document.getElementById('app');

function eyeToggle(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (inp.type === 'password') {
    inp.type = 'text';
    btn.innerHTML = \`<svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>\`;
  } else {
    inp.type = 'password';
    btn.innerHTML = \`<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>\`;
  }
}

function strengthColor(n) {
  if (n < 2) return { color: '#ef4444', label: 'Debole', width: '33%' };
  if (n < 3) return { color: '#f59e0b', label: 'Discreta', width: '66%' };
  return { color: '#22c55e', label: 'Forte', width: '100%' };
}

function calcStrength(pwd) {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return score;
}

function renderForm() {
  app.innerHTML = \`
    <p class="card-title">Nuova password</p>
    <p class="card-desc">Scegli una nuova password sicura per il tuo account.</p>
    <div id="alert-area"></div>
    <form id="reset-form">
      <div class="fg">
        <label for="pwd1">Nuova password</label>
        <div class="iw">
          <span class="iico"><svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>
          <input type="password" id="pwd1" placeholder="Minimo 6 caratteri" minlength="6" required />
          <button type="button" class="eye" id="eye1"><svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
        </div>
        <div class="strength" id="strength-bar"></div>
        <div class="strength-text" id="strength-text"></div>
      </div>
      <div class="fg">
        <label for="pwd2">Conferma password</label>
        <div class="iw">
          <span class="iico"><svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>
          <input type="password" id="pwd2" placeholder="Ripeti la password" minlength="6" required />
          <button type="button" class="eye" id="eye2"><svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
        </div>
      </div>
      <button type="submit" class="btn" id="submit-btn">Imposta nuova password</button>
    </form>
  \`;

  document.getElementById('eye1').addEventListener('click', function() { eyeToggle('pwd1', this); });
  document.getElementById('eye2').addEventListener('click', function() { eyeToggle('pwd2', this); });

  const pwd1 = document.getElementById('pwd1');
  const bar = document.getElementById('strength-bar');
  const txt = document.getElementById('strength-text');
  pwd1.addEventListener('input', () => {
    const v = pwd1.value;
    if (!v) { bar.style.background = '#e7e5e4'; bar.style.width = ''; txt.textContent = ''; return; }
    const s = strengthColor(calcStrength(v));
    bar.style.background = s.color;
    bar.style.width = s.width;
    txt.textContent = s.label;
    txt.style.color = s.color;
  });

  document.getElementById('reset-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const alertArea = document.getElementById('alert-area');
    alertArea.innerHTML = '';
    const p1 = document.getElementById('pwd1').value;
    const p2 = document.getElementById('pwd2').value;
    if (p1.length < 6) {
      alertArea.innerHTML = '<div class="alert alert-err"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>La password deve avere almeno 6 caratteri.</div>';
      return;
    }
    if (p1 !== p2) {
      alertArea.innerHTML = '<div class="alert alert-err"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Le due password non coincidono.</div>';
      return;
    }
    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.textContent = 'Aggiornamento...';
    const { error } = await supabase.auth.updateUser({ password: p1 });
    if (error) {
      alertArea.innerHTML = '<div class="alert alert-err"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Errore: ' + error.message + '</div>';
      btn.disabled = false;
      btn.textContent = 'Imposta nuova password';
    } else {
      app.innerHTML = \`
        <div class="success-wrap">
          <div class="success-icon"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>
          <h2>Password aggiornata!</h2>
          <p>La tua password e' stata reimpostata con successo.<br>Puoi chiudere questa pagina e accedere al gestionale con la nuova password.</p>
        </div>
      \`;
    }
  });
}

function renderError(msg) {
  app.innerHTML = \`
    <div class="alert alert-warn" style="margin-bottom:0">
      <svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <div><strong>Link non valido o scaduto</strong><br><span style="font-size:12px">\${msg}</span></div>
    </div>
  \`;
}

// Parse token from URL hash or query params (Supabase sends both)
async function init() {
  // Try hash first (Supabase default)
  const hash = window.location.hash.substring(1);
  const hashParams = new URLSearchParams(hash);
  const query = new URLSearchParams(window.location.search);

  const accessToken = hashParams.get('access_token') || query.get('access_token');
  const refreshToken = hashParams.get('refresh_token') || query.get('refresh_token');
  const type = hashParams.get('type') || query.get('type');

  if (!accessToken || type !== 'recovery') {
    renderError('Nessun token di recupero trovato. Assicurati di aver cliccato sul link nell\'email.');
    return;
  }

  const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken ?? '' });
  if (error) {
    renderError('Il link e\' scaduto o non e\' valido. Richiedi un nuovo link dal gestionale.');
    return;
  }

  renderForm();
}

init();
</script>
</body>
</html>`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const page = html(SUPABASE_URL, SUPABASE_ANON_KEY);
    return new Response(page, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (err) {
    return new Response('Internal Server Error', { status: 500, headers: corsHeaders });
  }
});
