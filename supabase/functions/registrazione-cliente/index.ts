import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
.photo-area{display:flex;flex-direction:column;align-items:center;gap:12px}
.photo-preview{width:100px;height:100px;border-radius:50%;object-fit:cover;border:3px solid #f59e0b;display:none}
.photo-placeholder{width:100px;height:100px;border-radius:50%;background:#f5f5f4;border:2.5px dashed #d6d3d1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;cursor:pointer;transition:border-color .15s,background .15s}
.photo-placeholder:hover{border-color:#f59e0b;background:#fffbeb}
.photo-placeholder svg{width:28px;height:28px;fill:none;stroke:#a8a29e;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
.photo-placeholder span{font-size:11px;color:#a8a29e;font-weight:600;text-align:center;line-height:1.3}
.photo-btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.pbtn{padding:8px 14px;border-radius:10px;font-size:13px;font-weight:600;border:1.5px solid #e7e5e4;background:white;color:#57534e;cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:6px}
.pbtn svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.pbtn:hover{border-color:#f59e0b;color:#d97706;background:#fffbeb}
.pbtn.remove{border-color:#fecaca;color:#dc2626}
.pbtn.remove:hover{background:#fef2f2}
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
.prog{width:100%;height:4px;background:#e7e5e4;border-radius:4px;overflow:hidden;margin-top:4px;display:none}
.prog-bar{height:100%;background:#f59e0b;border-radius:4px;transition:width .3s}
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

      <div class="fg">
        <label>Foto profilo <span style="font-weight:400;color:#a8a29e;text-transform:none;letter-spacing:0">(opzionale)</span></label>
        <div class="photo-area" id="photoArea">
          <div class="photo-placeholder" id="photoPlaceholder" onclick="document.getElementById('fileGallery').click()">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M20.5 6.5h-2.1l-1.5-2h-9.8l-1.5 2H3.5A2 2 0 001.5 8.5v10a2 2 0 002 2h17a2 2 0 002-2v-10a2 2 0 00-2-2z"/></svg>
            <span>Tocca per<br/>aggiungere foto</span>
          </div>
          <img id="photoPreview" class="photo-preview" alt="Anteprima foto" />
          <div class="photo-btns" id="photoBtns" style="display:none">
            <button type="button" class="pbtn" onclick="document.getElementById('fileSelfie').click()">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M20.5 6.5h-2.1l-1.5-2h-9.8l-1.5 2H3.5A2 2 0 001.5 8.5v10a2 2 0 002 2h17a2 2 0 002-2v-10a2 2 0 00-2-2z"/></svg>
              Selfie
            </button>
            <button type="button" class="pbtn" onclick="document.getElementById('fileGallery').click()">
              <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              Galleria
            </button>
            <button type="button" class="pbtn remove" onclick="removePhoto()">
              <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
              Rimuovi
            </button>
          </div>
          <div class="photo-btns" id="photoAddBtns">
            <button type="button" class="pbtn" onclick="document.getElementById('fileSelfie').click()">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M20.5 6.5h-2.1l-1.5-2h-9.8l-1.5 2H3.5A2 2 0 001.5 8.5v10a2 2 0 002 2h17a2 2 0 002-2v-10a2 2 0 00-2-2z"/></svg>
              Scatta selfie
            </button>
            <button type="button" class="pbtn" onclick="document.getElementById('fileGallery').click()">
              <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              Scegli foto
            </button>
          </div>
          <input type="file" id="fileSelfie" accept="image/*" capture="user" style="display:none" onchange="handlePhoto(this)"/>
          <input type="file" id="fileGallery" accept="image/*" style="display:none" onchange="handlePhoto(this)"/>
          <div class="prog" id="prog"><div class="prog-bar" id="progBar" style="width:0%"></div></div>
        </div>
      </div>

      <div id="err" class="eb" style="display:none"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span id="em"></span></div>
      <p class="privacy">I tuoi dati saranno utilizzati esclusivamente per la gestione della scheda cliente nel salone e non saranno ceduti a terzi.</p>
      <button type="submit" class="btn" id="btn">Invia la mia scheda</button>
    </form>
  </div>
</div>
<script>
var SU="__SU__",SK="__SK__",EF="__EF__";
var photoBase64=null,photoMime=null;

function handlePhoto(input){
  var file=input.files[0];
  if(!file)return;
  if(file.size>5*1024*1024){showErr("La foto non deve superare 5 MB.");input.value='';return;}
  var reader=new FileReader();
  reader.onload=function(e){
    var data=e.target.result;
    photoBase64=data.split(',')[1];
    photoMime=file.type||'image/jpeg';
    document.getElementById('photoPreview').src=data;
    document.getElementById('photoPreview').style.display='block';
    document.getElementById('photoPlaceholder').style.display='none';
    document.getElementById('photoBtns').style.display='flex';
    document.getElementById('photoAddBtns').style.display='none';
  };
  reader.readAsDataURL(file);
}

function removePhoto(){
  photoBase64=null;photoMime=null;
  document.getElementById('photoPreview').style.display='none';
  document.getElementById('photoPlaceholder').style.display='flex';
  document.getElementById('photoBtns').style.display='none';
  document.getElementById('photoAddBtns').style.display='flex';
  document.getElementById('fileSelfie').value='';
  document.getElementById('fileGallery').value='';
}

function showErr(msg){
  document.getElementById('em').textContent=msg;
  document.getElementById('err').style.display='flex';
}

document.getElementById("f").onsubmit=async function(e){
  e.preventDefault();
  var n=document.getElementById("nome").value.trim();
  var c=document.getElementById("cognome").value.trim();
  var t=document.getElementById("telefono").value.trim();
  var em=document.getElementById("email").value.trim();
  var d=document.getElementById("dn").value||null;
  var no=document.getElementById("note").value.trim();
  var btn=document.getElementById("btn");
  var prog=document.getElementById('prog');
  var progBar=document.getElementById('progBar');
  if(!n||!c){showErr("Nome e cognome sono obbligatori.");return;}
  document.getElementById('err').style.display="none";
  btn.disabled=true;btn.textContent="Invio in corso...";
  if(photoBase64){prog.style.display='block';progBar.style.width='30%';}
  try{
    var payload={nome:n,cognome:c,telefono:t,email:em,data_nascita:d,note:no};
    if(photoBase64){payload.foto_base64=photoBase64;payload.foto_mime=photoMime;}
    if(photoBase64)progBar.style.width='60%';
    var r=await fetch(EF,{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":"Bearer "+SK},
      body:JSON.stringify(payload)
    });
    if(photoBase64)progBar.style.width='90%';
    var res=await r.json();
    if(!r.ok||res.error)throw new Error(res.error||'Errore');
    if(photoBase64)progBar.style.width='100%';
    setTimeout(function(){
      document.getElementById("app").innerHTML='<div class="ss"><div class="si"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div><h2>Grazie!</h2><p>I tuoi dati sono stati inviati correttamente.<br/>Il nostro staff creer\u00e0 la tua scheda al pi\u00f9 presto.</p><div class="sf"><svg viewBox="0 0 24 24"><path d="M6 3c1.5 0 3 1.5 3 3S6 12 6 12 3 9 3 6s1.5-3 3-3z"/><path d="M18 3c1.5 0 3 1.5 3 3s-3 6-3 6-3-3-3-6 1.5-3 3-3z"/><path d="M6 12l6 9 6-9"/></svg>Ti aspettiamo!</div></div>';
    },300);
  }catch(x){
    btn.disabled=false;btn.textContent="Invia la mia scheda";
    showErr(x.message||"Si \u00e8 verificato un errore. Riprova.");
    prog.style.display='none';
  }
};
</script>
</body>
</html>`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const su = Deno.env.get("SUPABASE_URL") ?? "";
  const sk = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const efUrl = `${su}/functions/v1/registrazione-cliente`;

  // GET: serve la pagina HTML
  if (req.method === "GET") {
    const html = HTML
      .replace("__SU__", su)
      .replace("__SK__", sk)
      .replace("__EF__", efUrl);
    return new Response(html, {
      status: 200,
      headers: { ...corsHeaders, "content-type": "text/html; charset=utf-8" },
    });
  }

  // POST: riceve dati + eventuale foto, inserisce nel DB
  if (req.method === "POST") {
    try {
      const body = await req.json();
      const { nome, cognome, telefono, email, data_nascita, note, foto_base64, foto_mime } = body;

      if (!nome || !cognome) {
        return new Response(JSON.stringify({ error: "Nome e cognome sono obbligatori." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const admin = createClient(su, serviceKey);
      let foto_url = "";

      if (foto_base64 && foto_mime) {
        const mimeType = String(foto_mime).startsWith("image/") ? String(foto_mime) : "image/jpeg";
        const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
        const filename = `schede/${crypto.randomUUID()}.${ext}`;

        const binaryStr = atob(String(foto_base64));
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        const { error: uploadErr } = await admin.storage
          .from("foto-clienti")
          .upload(filename, bytes, { contentType: mimeType, upsert: false });

        if (!uploadErr) {
          const { data: urlData } = admin.storage.from("foto-clienti").getPublicUrl(filename);
          foto_url = urlData.publicUrl;
        }
      }

      const { error: insertErr } = await admin
        .from("schede_clienti_da_confermare")
        .insert({
          nome: String(nome).trim(),
          cognome: String(cognome).trim(),
          telefono: String(telefono ?? "").trim(),
          email: String(email ?? "").trim(),
          data_nascita: data_nascita || null,
          note: String(note ?? "").trim(),
          foto_url,
          stato: "in_attesa",
        });

      if (insertErr) throw new Error(insertErr.message);

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
});
