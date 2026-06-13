// ── CONFIG ────────────────────────────────────────────────────────────────────
const BOT_API = 'https://sortofdev.c.jrnm.app';
const BOT_KEY = 'sortofdev';
// ─────────────────────────────────────────────────────────────────────────────

const GID  = '1503297362246897694';
const CODE = 'dS4pgC9J5H';
const HK   = `dcw_${GID}`;
const GOAL = 100;
const BR   = [0, 2, 7, 14];
const BT   = { 0:'No Level', 1:'Level 1', 2:'Level 2', 3:'Level 3' };
const VL   = ['None','Low','Medium','High','Very High'];
const LB_PER_PAGE = 10;

const FM = {
  COMMUNITY:['🏘','Community'], VERIFIED:['✅','Verified'], PARTNERED:['🤝','Partner'],
  ANIMATED_ICON:['✨','Animated Icon'], BANNER:['🎨','Banner'], DISCOVERABLE:['🔍','Discoverable'],
  VANITY_URL:['🔗','Vanity URL'], NEWS:['📰','News Channels'], THREADS_ENABLED:['🧵','Threads'],
  MONETIZATION_ENABLED:['💰','Monetization']
};

// Status config
const STATUS = {
  online:  { dot:'#23a55a', label:'Online',  symbol:'🟢' },
  idle:    { dot:'#f0b232', label:'Idle',    symbol:'🟡' },
  dnd:     { dot:'#f23f43', label:'DND',     symbol:'🔴' },
  offline: { dot:'#80848e', label:'Offline', symbol:'⚫' },
};

let W = null, I = null, chart = null, filter = 'all';
let botStats = null, botLb = null, lbPage = 0;

const $        = id  => document.getElementById(id);
const setText  = (id, v) => { const e=$(id); if(e) e.textContent=v; };
const esc      = s   => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const apiFetch = p   => fetch(`${BOT_API}${p}${p.includes('?')?'&':'?'}key=${BOT_KEY}`).then(r=>r.json()).catch(()=>null);

// ── Particles ─────────────────────────────────────────────────────────────────
function spawnParticles() {
  const wrap=$('particles'); if(!wrap) return;
  const frag=document.createDocumentFragment();
  for(let i=0;i<18;i++){
    const p=document.createElement('div'); p.className='particle';
    const size=Math.random()*4+2;
    p.style.cssText=`width:${size}px;height:${size}px;left:${Math.random()*100}%;top:${Math.random()*100}%;animation-duration:${Math.random()*12+8}s;animation-delay:${Math.random()*8}s;`;
    frag.appendChild(p);
  }
  wrap.appendChild(frag);
}

// ── Load ──────────────────────────────────────────────────────────────────────
async function loadData() {
  try {
    const [wr, ir, bs, bl] = await Promise.all([
      fetch(`https://discord.com/api/guilds/${GID}/widget.json`),
      fetch(`https://discord.com/api/v9/invites/${CODE}?with_counts=true`),
      apiFetch('/stats'),
      apiFetch('/leaderboard?limit=100')
    ]);
    if(!wr.ok) throw new Error('Widget disabled. Enable in Server Settings → Widget.');
    W = await wr.json();
    I = ir.ok ? await ir.json() : null;
    botStats = bs;
    botLb    = Array.isArray(bl) ? bl : null;
    saveHistory(W.presence_count||0);
    render();
    resetBar();
  } catch(e) {
    const el=$('ov-content');
    if(el) el.innerHTML=`<div class="pempty"><div class="peico">⚠️</div><p>${esc(e.message)}</p></div>`;
  }
}

function saveHistory(c){ try{ const a=JSON.parse(localStorage.getItem(HK)||'[]'); a.push({t:Date.now(),c}); while(a.length>80)a.shift(); localStorage.setItem(HK,JSON.stringify(a)); }catch{} }
function getHistory(){ try{ return JSON.parse(localStorage.getItem(HK)||'[]'); }catch{ return []; } }
function resetBar(){ const e=$('rfill'); if(!e) return; e.style.animation='none'; void e.offsetWidth; e.style.animation='rfa 35s linear forwards'; }

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
  if(!W) return;
  const g    = I?.guild||{};
  const total= I?.approximate_member_count||botStats?.memberCount||0;
  const online= W.presence_count||0;
  const mbs  = W.members||[];
  const chs  = W.channels||[];
  const tier = g.premium_tier||0;
  const bc   = g.premium_subscription_count||0;
  const voiceCount = chs.reduce((s,c)=>s+mbs.filter(m=>m.channel_id===c.id).length,0);
  const totalMsgs  = botStats?.totalMessages||0;

  const ico = g.icon
    ? `https://cdn.discordapp.com/icons/${GID}/${g.icon}.webp?size=256`
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(W.name)}&background=5865f2&color=fff&bold=true&size=256`;
  const hi=$('hero-icon'); if(hi) hi.src=ico;

  setText('hero-title', W.name);
  setText('hero-desc', g.description||'An active community of gamers and creators — join the grid.');

  const goalCount=botStats?.memberCount||total;
  setText('goal-text',`${goalCount.toLocaleString()} / ${GOAL}`);
  const gf=$('goal-fill'); if(gf) gf.style.width=`${Math.min((goalCount/GOAL)*100,100)}%`;

  animCount('h-total', total);
  animCount('h-online', online);
  setText('h-voice', voiceCount);
  setText('h-boosts', bc);
  const hm=$('h-msgs'); if(hm) hm.textContent=totalMsgs?totalMsgs.toLocaleString():'—';

  if(tier>0||bc>0){
    const bw=$('boost-wrap'); if(bw) bw.style.display='';
    setText('boost-tier', BT[tier]||'Level 0');
    setText('boost-count',`${bc} boost${bc!==1?'s':''}`);
    const next=BR[Math.min(tier+1,3)]||BR[3];
    const bf=$('boost-fill'); if(bf) bf.style.width=`${next?Math.min((bc/next)*100,100):100}%`;
  }
  if(W.instant_invite){ const jb=$('join-btn'); if(jb) jb.href=W.instant_invite; }

  renderMembers();
  renderVoice(mbs, chs);
  renderActivity(online);
  renderLeaderboard();
  renderOverview(mbs, total, online, tier, bc, g);
}

// ── Members ───────────────────────────────────────────────────────────────────
function memberCountMap(mbs){ return { all:mbs.length, online:mbs.filter(m=>m.status==='online').length, idle:mbs.filter(m=>m.status==='idle').length, dnd:mbs.filter(m=>m.status==='dnd').length }; }

function renderMembers() {
  if(!W) return;
  const mbs=W.members||[];
  const q=($('mb-srch')?.value||'').toLowerCase();
  const ctrl=$('mb-ctrl'); if(ctrl) ctrl.style.display='';
  const co=memberCountMap(mbs);
  setText('pfc-a',co.all); setText('pfc-o',co.online); setText('pfc-i',co.idle); setText('pfc-d',co.dnd);
  const list=mbs.filter(m=>(filter==='all'||m.status===filter)&&(!q||m.username.toLowerCase().includes(q)));
  const el=$('mb-list'); if(!el) return;
  if(!list.length){ el.innerHTML=`<div class="pempty"><div class="peico">🔍</div>No members found</div>`; return; }
  el.innerHTML=list.map(m=>{
    const st=STATUS[m.status]||STATUS.offline;
    return `<div class="mcrd">
      <div class="avw"><img class="av" src="${m.avatar_url}" alt="${esc(m.username)}" loading="lazy"><div class="avs ${m.status||'offline'}" style="background:${st.dot}"></div></div>
      <div class="minfo">
        <div class="mn-row"><span class="mn">${esc(m.username)}</span><span style="font-size:9px;color:${st.dot};font-weight:700;margin-left:4px">${st.symbol} ${st.label}</span></div>
        ${m.game?`<div class="ma">🎮 ${esc(m.game.name)}</div>`:''}
      </div>
      ${m.game?`<div class="gtag">${esc(m.game.name.slice(0,14))}${m.game.name.length>14?'…':''}</div>`:''}
    </div>`;
  }).join('');
}

function setFilter(f){ filter=f; document.querySelectorAll('.pfb').forEach(b=>b.classList.remove('on')); const map={all:'pf-all',online:'pf-o',idle:'pf-i',dnd:'pf-d'}; const el=$(map[f]); if(el) el.classList.add('on'); renderMembers(); }

// ── Voice ─────────────────────────────────────────────────────────────────────
function renderVoice(mbs, chs) {
  const el=$('vc-list'); if(!el) return;
  if(!chs.length){ el.innerHTML=`<div class="pempty"><div class="peico">🔇</div>No active voice channels</div>`; return; }
  el.innerHTML=chs.map(c=>{
    const ins=mbs.filter(m=>m.channel_id===c.id);
    return `<div class="vcg">
      <div class="vch">🔊 <span class="vcn">${esc(c.name)}</span><span class="vcc">${ins.length}</span></div>
      <div class="vcms">${ins.length
        ?ins.map(m=>{
            const st=STATUS[m.status]||STATUS.offline;
            return `<div class="vcmr">
              <img class="vcav" src="${m.avatar_url}" alt="${esc(m.username)}" loading="lazy">
              <span style="color:${st.dot}">${st.symbol}</span>
              <span>${esc(m.username)}</span>
              ${m.game?`<span style="font-size:9px;color:var(--t3);margin-left:auto">🎮 ${esc(m.game.name.slice(0,12))}</span>`:''}
            </div>`;
          }).join('')
        :'<div class="vce">— vacant —</div>'
      }</div>
    </div>`;
  }).join('');
}

// ── Activity ──────────────────────────────────────────────────────────────────
function renderActivity(online) {
  setText('ac-count',`${online} online`);
  const h=getHistory(), count=h.length;
  const peak=count?Math.max(...h.map(x=>x.c)):online;
  const avg =count?Math.round(h.reduce((s,x)=>s+x.c,0)/count):online;
  setText('ac-pk',peak||'—'); setText('ac-av',avg||'—'); setText('ac-pt',count);
  const wrap=document.querySelector('.ac-chart-wrap'); if(!wrap) return;
  if(count<2){
    wrap.innerHTML=`<div class="ac-empty"><div class="ac-empty-icon">📈</div><div class="ac-empty-title">Not enough history yet</div><div class="ac-empty-desc">Activity data builds up over time.</div><div class="ac-empty-stats"><div class="ac-mini"><span class="ac-mini-n">${online}</span><span class="ac-mini-l">Current</span></div><div class="ac-mini"><span class="ac-mini-n">${peak}</span><span class="ac-mini-l">Peak</span></div><div class="ac-mini"><span class="ac-mini-n">${avg}</span><span class="ac-mini-l">Average</span></div></div><div class="ac-empty-note">Keep this tab open to build the chart.</div></div>`;
    return;
  }
  if(!wrap.querySelector('canvas')) wrap.innerHTML=`<canvas id="actChart" height="140"></canvas>`;
  const last=h.slice(-30);
  if(chart) chart.destroy();
  chart=new Chart($('actChart').getContext('2d'),{
    type:'line',
    data:{
      labels:last.map(x=>{ const d=new Date(x.t); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }),
      datasets:[{data:last.map(x=>x.c),borderColor:'#57f287',backgroundColor:'rgba(87,242,135,.08)',borderWidth:2,fill:true,tension:.4,pointRadius:last.length<10?3:0,pointHoverRadius:4,pointBackgroundColor:'#57f287'}]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{backgroundColor:'#313338',borderColor:'rgba(255,255,255,.1)',borderWidth:1,titleColor:'#b5bac1',bodyColor:'#57f287',bodyFont:{family:"'JetBrains Mono',monospace",weight:'700',size:13},callbacks:{label:c=>` ${c.parsed.y} online`}}},
      scales:{x:{display:last.length<15,ticks:{color:'#4e5058',font:{size:9},maxTicksLimit:6},grid:{display:last.length>=5}},y:{beginAtZero:true,ticks:{color:'#4e5058',font:{family:"'JetBrains Mono',monospace",size:9},maxTicksLimit:4},grid:{display:last.length>=5,color:'rgba(255,255,255,.04)'}}}
    }
  });
}

// ── Leaderboard ───────────────────────────────────────────────────────────────
// Build a status map from widget members for cross-referencing
function getWidgetStatusMap() {
  const map = {};
  if(!W) return map;
  (W.members||[]).forEach(m => { map[m.username?.toLowerCase()] = m.status; });
  return map;
}

function renderLeaderboard() {
  const el=$('lb-list'); if(!el) return;

  // Show message even when bot API not connected
  if(!botLb || !botLb.length) {
    el.innerHTML=`<div class="pempty"><div class="peico">${botStats===null?'🔌':'💬'}</div>${botStats===null?'Bot API not connected.<br><small style="color:var(--t3)">Add the API addon to bot.js and restart.</small>':'No message data yet.'}</div>`;
    return;
  }

  const statusMap = getWidgetStatusMap();
  const medals    = ['👑','🥈','🥉'];
  const total     = Math.ceil(botLb.length / LB_PER_PAGE);
  if(lbPage >= total) lbPage = 0;

  const page = botLb.slice(lbPage * LB_PER_PAGE, (lbPage + 1) * LB_PER_PAGE);

  // Status: try to match by username from widget
  const rows = page.map((u, i) => {
    const rank    = lbPage * LB_PER_PAGE + i + 1;
    const rawSt   = statusMap[u.username?.toLowerCase()] || 'offline';
    const st      = STATUS[rawSt] || STATUS.offline;
    const medal   = rank <= 3 ? medals[rank-1] : null;
    return `<div class="mcrd" style="gap:10px;padding:8px 10px">
      <span style="font:700 12px 'JetBrains Mono',monospace;color:${rank<=3?'var(--blurple)':'var(--t3)'};width:28px;text-align:center;flex-shrink:0">${medal||`#${rank}`}</span>
      <div class="avw" style="flex-shrink:0">
        ${u.avatar
          ?`<img class="av" src="${esc(u.avatar)}" loading="lazy" style="width:32px;height:32px">`
          :`<div class="av" style="width:32px;height:32px;background:var(--bgact);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px">👤</div>`
        }
        <div class="avs" style="background:${st.dot};border-color:var(--bg3)"></div>
      </div>
      <div class="minfo" style="flex:1;min-width:0">
        <div class="mn-row">
          <span class="mn">${esc(u.username)}</span>
          <span style="font-size:9px;font-weight:700;color:${st.dot};margin-left:4px">${st.symbol} ${st.label}</span>
        </div>
        <div class="ma">💬 ${u.messages.toLocaleString()} messages</div>
      </div>
      <span style="font:700 11px 'JetBrains Mono',monospace;color:var(--green-b);flex-shrink:0">${u.messages.toLocaleString()}</span>
    </div>`;
  }).join('');

  // Pagination controls
  const pagi = total > 1 ? `
    <div style="display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 16px;border-top:1px solid var(--bd)">
      <button onclick="lbPageNav(-1)" style="background:var(--bg3);border:1px solid var(--bd2);color:var(--t2);border-radius:6px;padding:5px 12px;cursor:pointer;font:600 12px 'Outfit',sans-serif" ${lbPage===0?'disabled style="opacity:.4;cursor:default"':''}>◀</button>
      <span style="font:700 11px 'JetBrains Mono',monospace;color:var(--t3)">${lbPage+1} / ${total}</span>
      <button onclick="lbPageNav(1)" style="background:var(--bg3);border:1px solid var(--bd2);color:var(--t2);border-radius:6px;padding:5px 12px;cursor:pointer;font:600 12px 'Outfit',sans-serif" ${lbPage===total-1?'disabled style="opacity:.4;cursor:default"':''}>▶</button>
    </div>` : '';

  el.innerHTML = `<div style="padding:8px 0">${rows}</div>${pagi}`;
}

function lbPageNav(dir) {
  const total = Math.ceil((botLb?.length||0) / LB_PER_PAGE);
  lbPage = Math.max(0, Math.min(total - 1, lbPage + dir));
  renderLeaderboard();
}

// ── Overview ──────────────────────────────────────────────────────────────────
function renderOverview(mbs, total, online, tier, bc, g) {
  const o=mbs.filter(m=>m.status==='online').length;
  const id=mbs.filter(m=>m.status==='idle').length;
  const dn=mbs.filter(m=>m.status==='dnd').length;
  const tot=mbs.length||1;
  const p=n=>((n/tot)*100).toFixed(1);
  const feats=(g.features||[]).filter(f=>FM[f]).slice(0,8);
  const totalMsgs=botStats?.totalMessages||0;
  const tracked=botStats?.trackedUsers||0;

  let h=`
    <div class="ov-sec">Status Breakdown</div>
    <div class="sbb"><div class="sbb-s o" style="width:${p(o)}%"></div><div class="sbb-s i" style="width:${p(id)}%"></div><div class="sbb-s d" style="width:${p(dn)}%"></div></div>
    <div class="leg">
      <span class="leg-i"><span class="ldot" style="background:#23a55a"></span>Online <span class="lcnt">${o}</span></span>
      <span class="leg-i"><span class="ldot" style="background:#f0b232"></span>Idle <span class="lcnt">${id}</span></span>
      <span class="leg-i"><span class="ldot" style="background:#f23f43"></span>DND <span class="lcnt">${dn}</span></span>
      <span class="leg-i"><span class="ldot" style="background:#80848e"></span>Offline <span class="lcnt">${Math.max(0,(botStats?.memberCount||total)-o-id-dn)}</span></span>
    </div>
    <div class="ov-sec" style="margin-top:12px">Server Info</div>
    <div class="irow"><span class="ilbl">👥 Members</span><span class="ival">${total.toLocaleString()}</span></div>
    <div class="irow"><span class="ilbl">🛡 Verification</span><span class="ival">${VL[g.verification_level||0]}</span></div>
    <div class="irow"><span class="ilbl">⚡ Boost Level</span><span class="ival">${BT[tier]} · ${bc} boosts</span></div>`;

  if(totalMsgs){
    h+=`<div class="ov-sec" style="margin-top:12px">Bot Stats</div>
    <div class="irow"><span class="ilbl">💬 Total Messages</span><span class="ival">${totalMsgs.toLocaleString()}</span></div>
    <div class="irow"><span class="ilbl">👤 Tracked Users</span><span class="ival">${tracked.toLocaleString()}</span></div>`;
  }

  if(feats.length){
    h+=`<div class="ov-sec" style="margin-top:12px">Features</div><div class="igrid">`;
    feats.forEach(f=>{ const[ic,lb]=FM[f]; h+=`<div class="icell"><span>${ic}</span>${lb}</div>`; });
    h+=`</div>`;
  }
  const el=$('ov-content'); if(el) el.innerHTML=`<div style="padding:14px 16px">${h}</div>`;
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function switchTab(t) {
  const map={mb:'wp-mb',vc:'wp-vc',ac:'wp-ac',lb:'wp-lb',ov:'wp-ov'};
  const keys=['mb','vc','ac','lb','ov'];
  document.querySelectorAll('.wtab').forEach((b,i)=>b.classList.toggle('on',keys[i]===t));
  Object.values(map).forEach(id=>{ const el=$(id); if(el) el.classList.remove('on'); });
  const active=$(map[t]); if(active) active.classList.add('on');
  if(t==='ac'&&chart) chart.resize();
}

function copyInvite() {
  const url=$('join-btn')?.href||`https://discord.gg/${CODE}`;
  navigator.clipboard.writeText(url).catch(()=>{});
  const t=$('toast'); if(!t) return;
  t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1800);
}

function animCount(id,v) {
  const el=$(id); if(!el) return;
  if(!v){ el.textContent='—'; return; }
  const start=performance.now();
  const tick=(now)=>{ const p=Math.min((now-start)/700,1),ease=1-Math.pow(1-p,3); el.textContent=Math.round(v*ease).toLocaleString(); if(p<1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}

spawnParticles();
loadData();
setInterval(loadData, 35000);