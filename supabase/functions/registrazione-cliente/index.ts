import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const HTML = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Scheda Cliente</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:linear-gradient(135deg,#fafaf9 0%,#fffbeb 100%);min-height:100vh;color:#1c1917}
.header{background:white;border-bottom:1px solid #e7e5e4;padding:20px 24px;text-align:center}
.hi{display:inline-flex;align-items:center;gap:10px;margin-bottom:4px}
.logo{width:36px;height:36px;background:#f59e0b;border-radius:10px;display:flex;align-items:center;justify-content:center}
.logo svg{width:18px;height:18px;fill:none;stroke:white;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.header h1{font-size:18px;font-weight:700;color:#1c1917}
.header p{font-size:14px;color:#78716c}
.container{max-width:440px;margin:0 auto;padding:32px 24px}
.fg{margin-bottom:20px}
label{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#57534e;margin-bottom:6px}
.req{color:#f87171}
.iw{position:relative}
.ii{position:absolute;left:14px;top:50%;transform:translateY(-50%);width:16px;height:16px;fill:none;stroke:#a8a29e;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.ti{top:16px;transform:none}
input,textarea{width:100%;padding:13px 16px 13px 42px;background:white;border:1.5px solid #e7e5e4;border-radius:14px;font-size:14px;color:#1c1917;outline:none;transition:border-color .15s,box-shadow .15s;-webkit-appearance:none}
input:focus,textarea:focus{border-color:#f59e0b;box-shadow:0 0 0 3px rgba(245,158,11,.15)}
textarea{resize:none;padding-top:13px}
.privacy{font-size:12px;color:#a8a29e;line-height:1.6;margin-bottom:20px}
.btn{width:100%;padding:15px;background:#f59e0b;color:white;font-size:15px;font-weight:700;border:none;border-radius:14px;cursor:pointer;transition:background .15s,transform .1s}
.btn:hover{background:#d97706}
.btn:active{transform:scale(.98)}
.btn:disabled{opacity:.6;cursor:not-allowed}
.eb{display:flex;align-items:center;gap:10px;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:12px 16px;margin-bottom:16px;font-size:13px;color:#dc2626}
.eb svg{flex-shrink:0;width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.ss{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:70vh;text-align:center;padding:40px 24px}
.si{width:80px;height:80px;background:#dcfce7;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-bottom:24px}
.si svg{width:36px;height:36px;fill:none;stroke:#16a34a;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}
.ss h2{font-size:26px;font-weight:700;color:#1c1917;margin-bottom:12px}
.ss p{font-size:15px;color:#78716c;line-height:1.6;max-width:280px}
.sf{margin-top:32px;display:flex;align-items:center;gap:8px;color:#f59e0b;font-size:14px;font-weight:600}
.sf svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
</style>
</head>
<body>
<div class="header">
  <div class="hi">
    <div class="logo"><svg viewBox="0 0 24 24"><path d="M6 3c1.5 0 3 1.5 3 3S6 12 6 12 3 9 3 6s1.5-3 3-3z"/><path d="M18 3c1.5 0 3 1.5 3 3s-3 6-3 6-3-3-3-6 1.5-3 3-3z"/><path d="M6 12l6 9 6-9"/></svg></div>
    <h1>Scheda Cliente</h1>
  </div>
  <p>Compila il modulo per registrarti</p>
</div>
<div id="app">
  <div class="container">
    <form id="f">
      <div class="fg">
        <label>Nome <span class="req">*</span></label>
        <div class="iw"><svg class="ii" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg><input type="text" id="nome" placeholder="Il tuo nome"/></div>
      </div>
      <div class="fg">
        <label>Cognome <span class="req">*</span></label>
        <div class="iw"><svg class="ii" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg><input type="text" id="cognome" placeholder="Il tuo cognome"/></div>
      </div>
      <div class="fg">
        <label>Telefono</label>
        <div class="iw"><svg class="ii" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg><input type="tel" id="telefono" placeholder="+39 333 000 0000"/></div>
      </div>
      <div class="fg">
        <label>Email</label>
        <div class="iw"><svg class="ii" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg><input type="email" id="email" placeholder="nome@esempio.it"/></div>
      </div>
      <div class="fg">
        <label>Data di nascita</label>
        <div class="iw"><svg class="ii" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><input type="date" id="dn"/></div>
      </div>
      <div class="fg">
        <label>Note / Allergie / Preferenze</label>
        <div class="iw"><svg class="ii ti" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg><textarea id="note" rows="3" placeholder="Allergie, preferenze, informazioni utili..."></textarea></div>
      </div>
      <div id="err" class="eb" style="display:none"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span id="em"></span></div>
      <p class="privacy">I tuoi dati saranno utilizzati esclusivamente per la gestione della scheda cliente nel salone e non saranno ceduti a terzi.</p>
      <button type="submit" class="btn" id="btn">Invia la mia scheda</button>
    </form>
  </div>
</div>
<script>
var SU="__SU__",SK="__SK__";
document.getElementById("f").onsubmit=async function(e){
  e.preventDefault();
  var n=document.getElementById("nome").value.trim();
  var c=document.getElementById("cognome").value.trim();
  var t=document.getElementById("telefono").value.trim();
  var em=document.getElementById("email").value.trim();
  var d=document.getElementById("dn").value||null;
  var no=document.getElementById("note").value.trim();
  var ed=document.getElementById("err");
  var emsg=document.getElementById("em");
  var btn=document.getElementById("btn");
  if(!n||!c){emsg.textContent="Nome e cognome sono obbligatori.";ed.style.display="flex";return;}
  ed.style.display="none";btn.disabled=true;btn.textContent="Invio in corso...";
  try{
    var r=await fetch(SU+"/rest/v1/schede_clienti_da_confermare",{
      method:"POST",
      headers:{"Content-Type":"application/json","apikey":SK,"Authorization":"Bearer "+SK,"Prefer":"return=minimal"},
      body:JSON.stringify({nome:n,cognome:c,telefono:t,email:em,data_nascita:d,note:no,stato:"in_attesa"})
    });
    if(!r.ok)throw 1;
    document.getElementById("app").innerHTML='<div class="ss"><div class="si"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div><h2>Grazie!</h2><p>I tuoi dati sono stati inviati correttamente.<br/>Il nostro staff creer\u00e0 la tua scheda al pi\u00f9 presto.</p><div class="sf"><svg viewBox="0 0 24 24"><path d="M6 3c1.5 0 3 1.5 3 3S6 12 6 12 3 9 3 6s1.5-3 3-3z"/><path d="M18 3c1.5 0 3 1.5 3 3s-3 6-3 6-3-3-3-6 1.5-3 3-3z"/><path d="M6 12l6 9 6-9"/></svg>Ti aspettiamo!</div></div>';
  }catch(x){
    btn.disabled=false;btn.textContent="Invia la mia scheda";
    emsg.textContent="Si \u00e8 verificato un errore. Riprova.";ed.style.display="flex";
  }
};
</script>
</body>
</html>`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
      },
    });
  }

  try {
    const su = Deno.env.get("SUPABASE_URL") ?? "";
    const sk = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const html = HTML.replace("__SU__", su).replace("__SK__", sk);

    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (err) {
    return new Response(String(err), { status: 500 });
  }
});
