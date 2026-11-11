// HTML-Seiten (bewusst ohne Framework, damit alles in einer Datei verständlich bleibt)
const config = require("./config");
const CAFE = config.cafe;
const C = CAFE.colors;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

// Sicherer JS-String innerhalb von <script>
const js = (s) => JSON.stringify(String(s)).replace(/</g, "\\u003c");

function layout(title, body, { extraHead = "" } = {}) {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title><meta name="theme-color" content="${C.background}">
<link rel="icon" href="/img/icon-180.png"><link rel="apple-touch-icon" href="/img/icon-180.png">
<style>
:root{--bg:${C.background};--fg:${C.text};--accent:${C.stamp};--label:${C.label}}
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f6f1ec;color:#2a1b14;-webkit-font-smoothing:antialiased}
.wrap{max-width:440px;margin:0 auto;padding:24px 18px 48px}
.card{background:var(--bg);color:var(--fg);border-radius:22px;padding:20px;box-shadow:0 10px 30px rgba(0,0,0,.18)}
.card h1{margin:0 0 4px;font-size:24px}.card .sub{color:var(--label);font-size:14px;margin:0 0 14px}
.card img.stamps{width:100%;border-radius:12px;display:block}
.progress{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-top:12px;font-size:15px}.progress b{font-size:20px;white-space:nowrap}
h2{font-size:18px;margin:28px 0 10px}p{line-height:1.5}.muted{color:#7a6a60;font-size:13px}
.btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:15px;border-radius:14px;border:0;font-size:17px;font-weight:600;text-decoration:none;cursor:pointer;margin:10px 0;font-family:inherit}
.btn-apple{background:#000;color:#fff}.btn-google{background:#fff;color:#1f1f1f;border:1px solid #dadce0}
.btn-main{background:var(--bg);color:var(--fg)}.btn-light{background:#fff;color:#2a1b14;border:1px solid #e3d8cf}
.btn-green{background:#1f8a4c;color:#fff}.btn-red{background:#b3261e;color:#fff}
.banner{background:#fff3d6;border:1px solid #f0d58e;border-radius:14px;padding:12px 14px;margin:0 0 16px;font-size:15px}
.box{background:#fff;border-radius:16px;padding:16px;border:1px solid #eadfd6}
input{width:100%;padding:14px;font-size:18px;border-radius:12px;border:1px solid #d9cbbf;font-family:inherit;letter-spacing:1px}
.hidden{display:none!important}
</style>${extraHead}</head><body><div class="wrap">${body}</div></body></html>`;
}

const appleLogo = `<svg width="18" height="22" viewBox="0 0 814 1000" fill="currentColor"><path d="M788 341c-6 4-108 62-108 190 0 149 131 201 135 202-1 3-21 72-69 142-43 62-88 124-157 124s-87-40-166-40c-77 0-105 41-168 41s-107-57-158-128C38 788 0 663 0 544c0-191 124-292 246-292 65 0 119 43 160 43 39 0 100-45 174-45 28 0 129 2 196 97zM558 160c31-37 53-88 53-139 0-7-1-14-2-20-50 2-110 34-146 76-28 32-55 83-55 135 0 8 1 15 2 18 3 1 9 1 14 1 45 0 102-30 134-71z"/></svg>`;
const googleLogo = `<svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.2C12.4 13.7 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.2z"/><path fill="#FBBC05" d="M10.5 28.5c-.5-1.4-.8-2.9-.8-4.5s.3-3.1.8-4.5l-7.9-6.2C1 16.6 0 20.2 0 24s1 7.4 2.6 10.7l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.2-13.5-10l-7.9 6.2C6.6 42.6 14.6 48 24 48z"/></svg>`;

function joinPage({ referrer, existing }) {
  const walletButtons = `
    ${config.apple.enabled ? `<button class="btn btn-apple wallet-apple" name="platform" value="apple">${appleLogo} Zu Apple Wallet hinzufügen</button>` : ""}
    ${config.google.enabled ? `<button class="btn btn-google wallet-google" name="platform" value="google">${googleLogo} Zu Google Wallet hinzufügen</button>` : ""}
    ${!config.apple.enabled && !config.google.enabled ? `<p class="banner">Noch keine Wallet eingerichtet – siehe Anleitung (README).</p>` : ""}`;
  return layout(`${CAFE.name} – Stempelkarte`, `
    ${referrer ? `<div class="banner">🎁 Du wurdest eingeladen! Bei deinem ersten Besuch bekommst du <b>${CAFE.referralBonus} Bonus-Stempel</b> extra.</div>` : ""}
    <div class="card">
      <h1>${esc(CAFE.name)}</h1>
      <p class="sub">Digitale Stempelkarte · ohne App</p>
      <img class="stamps" src="/img/hero/0.png" alt="">
      <div class="progress"><span>Pro Getränk 1 Stempel</span><span style="white-space:nowrap">${CAFE.stampsRequired} = ${esc(CAFE.rewardText)}</span></div>
    </div>
    ${existing ? `<div class="banner" style="margin-top:16px">Du hast schon eine Karte. <a href="/k/${esc(existing)}">Deine Karte öffnen →</a></div>` : ""}
    <form method="post" action="/j" style="margin-top:18px" id="f">
      <input type="hidden" name="ref" value="${esc(referrer || "")}">
      <div id="buttons">${walletButtons}</div>
    </form>
    <p class="muted">Wir speichern keine Namen, E-Mail-Adressen oder Telefonnummern – nur eine zufällige Kartennummer und deine Stempel.${CAFE.privacyUrl ? ` <a href="${esc(CAFE.privacyUrl)}">Datenschutz</a>` : ""}</p>
    <script>
      // Passenden Button zuerst zeigen
      var b=document.getElementById('buttons'),a=b.querySelector('.wallet-apple'),g=b.querySelector('.wallet-google');
      if(/android/i.test(navigator.userAgent)&&a&&g){b.insertBefore(g,a)}
      document.getElementById('f').addEventListener('submit',function(){setTimeout(function(){b.querySelectorAll('button').forEach(function(x){x.disabled=true})},10)});
    </script>`);
}

function cardPage(c, texts) {
  const invite = `${config.baseUrl}/j?ref=${c.ref_code}`;
  return layout(`${CAFE.name} – Deine Karte`, `
    <div class="card">
      <h1>${esc(CAFE.name)}</h1><p class="sub">Karte ${esc(c.card_code)}</p>
      <img class="stamps" src="/img/hero/${Math.min(c.stamps, CAFE.stampsRequired)}.png" alt="${esc(texts.progress)}">
      <div class="progress"><span>${esc(texts.status)}</span><b>${esc(texts.progress)}</b></div>
    </div>
    ${config.apple.enabled ? `<a class="btn btn-apple" href="/k/${c.id}/karte.pkpass">${appleLogo} Zu Apple Wallet hinzufügen</a>` : ""}
    ${config.google.enabled ? `<a class="btn btn-google" href="/k/${c.id}/google">${googleLogo} Zu Google Wallet hinzufügen</a>` : ""}
    <h2>🎁 Freunde einladen</h2>
    <div class="box">
      <p style="margin-top:0">Schick deinen Link an Freunde. Sobald sie zum ersten Mal bei uns waren, bekommt ihr <b>beide ${CAFE.referralBonus} Bonus-Stempel</b>.</p>
      <input readonly value="${esc(invite)}" id="inv" onclick="this.select()">
      <button class="btn btn-main" id="share">Link teilen</button>
    </div>
    <p class="muted">Tipp: Speichere diese Seite oder die Wallet-Karte – sie ist deine Stempelkarte.</p>
    <script>
      document.getElementById('share').onclick=async function(){
        var url=document.getElementById('inv').value, text=${js(`Hol dir die Stempelkarte von ${CAFE.name} – wir bekommen beide einen Bonus-Stempel ☕️`)};
        if(navigator.share){try{await navigator.share({title:${js(CAFE.name)},text:text,url:url})}catch(e){}}
        else{navigator.clipboard.writeText(url);this.textContent='Link kopiert ✓'}
      };
    </script>`);
}

function loginPage(error) {
  return layout("Team-Login", `
    <h1>Team-Login</h1>
    ${error ? `<div class="banner">${esc(error)}</div>` : ""}
    <form method="post" action="/team/login" class="box">
      <label>PIN</label><input type="password" name="pin" inputmode="numeric" autofocus>
      <button class="btn btn-main">Anmelden</button>
    </form>`);
}

function staffPage() {
  return layout("Stempeln", `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <h1 style="margin:0;font-size:22px">☕️ Stempeln</h1>
      <span><a href="/team/stats">Statistik</a> · <a href="/team/aufsteller">QR-Aufsteller</a></span>
    </div>
    <div id="reader" class="hidden" style="margin:16px 0;border-radius:16px;overflow:hidden;background:#000"></div>
    <button class="btn btn-light" id="cam">📷 Kamera starten</button>
    <form id="manual" class="box" style="margin-top:8px">
      <label class="muted">…oder Kartennummer eintippen</label>
      <div style="display:flex;gap:8px;margin-top:6px"><input id="code" autocapitalize="characters" autocomplete="off" placeholder="z. B. K7M2Q9XA"><button class="btn btn-main" style="width:auto;margin:0;padding:0 18px">OK</button></div>
    </form>

    <div id="result" class="hidden" style="margin-top:16px">
      <div class="card">
        <p class="sub" id="r-code"></p>
        <img class="stamps" id="r-img" alt="">
        <div class="progress"><span id="r-status"></span><b id="r-progress"></b></div>
      </div>
      <div id="r-msg" class="banner hidden" style="margin-top:12px"></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-green" data-stamp="1">+1 Stempel</button>
        <button class="btn btn-green" data-stamp="2" style="width:40%">+2</button>
      </div>
      <button class="btn btn-main hidden" id="redeem">🎉 Prämie einlösen</button>
      <button class="btn btn-light" id="undo">↩︎ Letzten Stempel zurücknehmen</button>
      <button class="btn btn-light" id="next">Nächste Karte scannen</button>
    </div>

    <script src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"></script>
    <script>
    var current=null, scanner=null, busy=false;
    function $(id){return document.getElementById(id)}
    function show(c,msg){
      current=c.card_code; $('result').classList.remove('hidden');
      $('r-code').textContent='Karte '+c.card_code+' · '+c.rewards_redeemed+'× eingelöst';
      $('r-img').src='/img/hero/'+Math.min(c.stamps,c.required)+'.png';
      $('r-progress').textContent=c.progress; $('r-status').textContent=c.status;
      $('redeem').classList.toggle('hidden',!c.ready);
      var m=$('r-msg'); if(msg){m.innerHTML=msg;m.classList.remove('hidden')}else m.classList.add('hidden');
      $('result').scrollIntoView({behavior:'smooth'});
    }
    async function api(path,body){
      var r=await fetch(path,{method:body?'POST':'GET',headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined});
      if(r.status===401){location.href='/team/login';return {}}
      return r.json();
    }
    async function load(code){
      code=(code||'').trim().toUpperCase(); if(!code||busy)return; busy=true;
      try{var d=await api('/api/team/karte/'+encodeURIComponent(code)); if(d.error){alert(d.error)}else{stopCam();show(d.card)}}
      finally{busy=false}
    }
    async function stamp(n,force){
      var d=await api('/api/team/karte/'+current+'/stempel',{count:n,force:!!force});
      if(d.warning){ if(confirm(d.warning+'\\n\\nTrotzdem stempeln?')) return stamp(n,true); return }
      if(d.error) return alert(d.error);
      var msg='✅ '+n+' Stempel vergeben.'; if(d.bonus) msg+='<br>🎁 Empfehlungs-Bonus: +'+d.bonus+' für diesen Gast und den Freund, der ihn eingeladen hat.';
      if(d.card.ready) msg+='<br><b>🎉 Prämie ist bereit!</b>';
      if(navigator.vibrate) navigator.vibrate(80);
      show(d.card,msg);
    }
    document.querySelectorAll('[data-stamp]').forEach(function(b){b.onclick=function(){stamp(+b.dataset.stamp)}});
    $('redeem').onclick=async function(){ if(!confirm('Prämie jetzt einlösen?'))return; var d=await api('/api/team/karte/'+current+'/einloesen',{}); if(d.error)return alert(d.error); show(d.card,'🎉 Prämie eingelöst – Stempel wurden abgezogen.') };
    $('undo').onclick=async function(){ var d=await api('/api/team/karte/'+current+'/rueckgaengig',{}); if(d.error)return alert(d.error); show(d.card,'↩︎ Letzter Stempel zurückgenommen.') };
    $('next').onclick=function(){ $('result').classList.add('hidden'); current=null; startCam() };
    $('manual').onsubmit=function(e){e.preventDefault();load($('code').value)};
    function startCam(){
      if(scanner) return; $('reader').classList.remove('hidden'); scanner=new Html5Qrcode('reader');
      scanner.start({facingMode:'environment'},{fps:10,qrbox:240},function(text){load(text)},function(){}).then(function(){$('cam').classList.add('hidden')})
        .catch(function(e){alert('Kamera nicht verfügbar: '+e);scanner=null;$('reader').classList.add('hidden')});
    }
    function stopCam(){ if(scanner){var s=scanner;scanner=null;s.stop().catch(function(){});$('reader').classList.add('hidden');$('cam').classList.remove('hidden')} }
    $('cam').onclick=startCam;
    </script>`);
}

function statsPage(s) {
  const row = (label, val) => `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eee"><span>${label}</span><b>${val}</b></div>`;
  return layout("Statistik", `
    <p><a href="/team">← Zurück zum Stempeln</a></p><h1>Statistik</h1>
    <div class="box">
      ${row("Karten insgesamt", s.customers)}
      ${row("…davon mind. 1× gestempelt", s.activeCustomers)}
      ${row("Neue Karten (7 Tage)", s.newWeek)}
      ${row("Stempel heute", s.stampsToday)}
      ${row("Stempel (7 Tage)", s.stampsWeek)}
      ${row("Prämien eingelöst", s.rewardsTotal)}
      ${row("Über Empfehlung angemeldet", s.viaReferral)}
      ${row("…davon schon da gewesen", s.referralsVisited)}
      ${row("Karten in Apple Wallet", s.appleDevices)}
      ${row("Karten in Google Wallet", s.googleCards)}
    </div>`);
}

function posterPage(qrSvg) {
  return layout("QR-Aufsteller", `
    <p class="no-print"><a href="/team">← Zurück</a> · <a href="#" onclick="print();return false">Drucken</a></p>
    <div class="poster">
      <div class="p-name">${esc(CAFE.name)}</div>
      <div class="p-title">Deine digitale<br>Stempelkarte</div>
      <div class="p-qr">${qrSvg}</div>
      <div class="p-steps">📷 Mit der Kamera scannen<br>📲 In Apple oder Google Wallet speichern<br>☕️ ${CAFE.stampsRequired} Stempel = ${esc(CAFE.rewardText)}</div>
      <div class="p-foot">Ganz ohne App · Freunde einladen = Bonus-Stempel</div>
    </div>`, { extraHead: `<style>
      .poster{background:${C.background};color:${C.text};border-radius:24px;padding:36px 28px;text-align:center}
      .p-name{color:${C.label};letter-spacing:3px;text-transform:uppercase;font-size:14px}
      .p-title{font-size:34px;font-weight:800;line-height:1.1;margin:10px 0 22px}
      .p-qr{background:#fff;border-radius:18px;padding:14px;width:250px;margin:0 auto}.p-qr svg{display:block;width:100%;height:auto}
      .p-steps{margin-top:22px;font-size:17px;line-height:1.8}.p-foot{margin-top:16px;color:${C.label};font-size:13px}
      @media print{body{background:#fff}.no-print{display:none}.wrap{padding:0}.poster{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style>` });
}

module.exports = { joinPage, cardPage, loginPage, staffPage, statsPage, posterPage, layout, esc };
