// ── CONFIG ────────────────────────────────────────────────
const BOT_API = 'https://sortofdev.c.jrnm.app';
const BOT_KEY = 'sortofdev';
// ─────────────────────────────────────────────────────────

const GID  = '1503297362246897694';
const CODE = 'dS4pgC9J5H';
const HK   = `dcw_${GID}`;
const GOAL = 100;
const BR   = [0,2,7,14];
const BT   = {0:'No Level',1:'Level 1',2:'Level 2',3:'Level 3'};
const VL   = ['None','Low','Medium','High','Very High'];
const LB_PER_PAGE = 10;
const FM = {
  COMMUNITY:['🏘','Community'],VERIFIED:['✅','Verified'],PARTNERED:['🤝','Partner'],
  ANIMATED_ICON:['✨','Animated Icon'],BANNER:['🎨','Banner'],DISCOVERABLE:['🔍','Discoverable'],
  VANITY_URL:['🔗','Vanity URL'],NEWS:['📰','News Channels'],THREADS_ENABLED:['🧵','Threads'],
  MONETIZATION_ENABLED:['💰','Monetization']
};
const STATUS = {
  online: {dot:'#23a55a',label:'Online', symbol:'🟢'},
  idle:   {dot:'#f0b232',label:'Idle',   symbol:'🟡'},
  dnd:    {dot:'#f23f43',label:'DND',    symbol:'🔴'},
  offline:{dot:'#80848e',label:'Offline',symbol:'⚫'},
};

let W=null,I=null,chart=null,filter='all';
let botStats=null,botLb=null,botGiveaways=null,botLog=null,lbPage=0;

const $       = id => document.getElementById(id);
const setText = (id,v)=>{ const e=$(id); if(e) e.textContent=v; };
const esc     = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const apiFetch= p => fetch(`${BOT_API}${p}${p.includes('?')?'&':'?'}key=${BOT_KEY}`).then(r=>r.json()).catch(()=>null);
const fmtNum  = n => Number(n||0).toLocaleString();

// ── Particles ─────────────────────────────────────────────
function spawnParticles(){
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

// ── Data Load ─────────────────────────────────────────────
async function loadData(){
  try {
    const [wr,ir,bs,bl,gw,lg]=await Promise.all([
      fetch(`https://discord.com/api/guilds/${GID}/widget.json`),
      fetch(`https://discord.com/api/v9/invites/${CODE}?with_counts=true`),
      apiFetch('/stats'),
      apiFetch('/leaderboard?limit=100'),
      apiFetch('/giveaways'),
      apiFetch('/log?limit=50'),
    ]);
    if(!wr.ok) throw new Error('Widget disabled. Enable in Server Settings → Widget.');
    W=await wr.json();
    I=ir.ok?await ir.json():null;
    botStats=bs;
    botLb=Array.isArray(bl)?bl:null;
    botGiveaways=Array.isArray(gw)?gw:null;
    botLog=Array.isArray(lg)?lg:null;
    saveHistory(W.presence_count||0);
    render();
    resetBar();
  } catch(e){
    const el=$('ov-content');
    if(el) el.innerHTML=`<div class="pempty"><div class="peico">⚠️</div><p>${esc(e.message)}</p></div>`;
  }
}

function saveHistory(c){ try{ const a=JSON.parse(localStorage.getItem(HK)||'[]'); a.push({t:Date.now(),c}); while(a.length>80)a.shift(); localStorage.setItem(HK,JSON.stringify(a)); }catch{} }
function getHistory(){ try{ return JSON.parse(localStorage.getItem(HK)||'[]'); }catch{ return []; } }
function resetBar(){ const e=$('rfill'); if(!e) return; e.style.animation='none'; void e.offsetWidth; e.style.animation='rfa 35s linear forwards'; }

// ── Render ────────────────────────────────────────────────
function render(){
  if(!W) return;
  const g=I?.guild||{};
  const total=I?.approximate_member_count||botStats?.memberCount||0;
  const online=W.presence_count||0;
  const mbs=W.members||[];
  const chs=W.channels||[];
  const tier=g.premium_tier||0;
  const bc=g.premium_subscription_count||0;
  const voiceCount=chs.reduce((s,c)=>s+mbs.filter(m=>m.channel_id===c.id).length,0);

  const ico=g.icon
    ?`https://cdn.discordapp.com/icons/${GID}/${g.icon}.webp?size=256`
    :`https://ui-avatars.com/api/?name=${encodeURIComponent(W.name)}&background=5865f2&color=fff&bold=true&size=256`;
  const hi=$('hero-icon'); if(hi) hi.src=ico;
  setText('hero-title',W.name);
  setText('hero-desc',g.description||'An active community of gamers and creators — join the grid.');

  const goalCount=botStats?.memberCount||total;
  setText('goal-text',`${fmtNum(goalCount)} / ${GOAL}`);
  const gf=$('goal-fill'); if(gf) gf.style.width=`${Math.min((goalCount/GOAL)*100,100)}%`;

  animCount('h-total',total);
  animCount('h-online',online);
  setText('h-voice',voiceCount);
  setText('h-boosts',bc);
  const hm=$('h-msgs'); if(hm) hm.textContent=botStats?.totalMessages?fmtNum(botStats.totalMessages):'—';

  if(tier>0||bc>0){
    const bw=$('boost-wrap'); if(bw) bw.style.display='';
    setText('boost-tier',BT[tier]||'Level 0');
    setText('boost-count',`${bc} boost${bc!==1?'s':''}`);
    const next=BR[Math.min(tier+1,3)]||BR[3];
    const bf=$('boost-fill'); if(bf) bf.style.width=`${next?Math.min((bc/next)*100,100):100}%`;
  }
  if(W.instant_invite){ const jb=$('join-btn'); if(jb) jb.href=W.instant_invite; }

  renderMembers();
  renderVoice(mbs,chs);
  renderActivity(online);
  renderLeaderboard();
  renderOverview(mbs,total,online,tier,bc,g);
  renderGiveaways();
  renderLog();
}

// ── Members ───────────────────────────────────────────────
function renderMembers(){
  if(!W) return;
  const mbs=W.members||[];
  const q=($('mb-srch')?.value||'').toLowerCase();
  const ctrl=$('mb-ctrl'); if(ctrl) ctrl.style.display='';
  const co={all:mbs.length,online:mbs.filter(m=>m.status==='online').length,idle:mbs.filter(m=>m.status==='idle').length,dnd:mbs.filter(m=>m.status==='dnd').length};
  setText('pfc-a',co.all); setText('pfc-o',co.online); setText('pfc-i',co.idle); setText('pfc-d',co.dnd);
  const list=mbs.filter(m=>(filter==='all'||m.status===filter)&&(!q||m.username.toLowerCase().includes(q)));
  const el=$('mb-list'); if(!el) return;
  if(!list.length){ el.innerHTML=`<div class="pempty"><div class="peico">🔍</div>No members found</div>`; return; }

  // Cross-ref with leaderboard for msg counts
  const lbMap={};
  if(botLb) botLb.forEach(u=>{ lbMap[u.username?.toLowerCase()]={messages:u.messages,level:u.level}; });

  el.innerHTML=list.map(m=>{
    const st=STATUS[m.status]||STATUS.offline;
    const lb=lbMap[m.username?.toLowerCase()];
    return `<div class="mcrd">
      <div class="avw"><img class="av" src="${m.avatar_url}" alt="${esc(m.username)}" loading="lazy"><div class="avs ${m.status||'offline'}" style="background:${st.dot}"></div></div>
      <div class="minfo">
        <div class="mn-row">
          <span class="mn">${esc(m.username)}</span>
          <span style="font-size:9px;color:${st.dot};font-weight:700;margin-left:4px">${st.symbol} ${st.label}</span>
          ${lb?`<span style="font-size:8px;background:var(--blurple-a);color:var(--blurple);border-radius:4px;padding:1px 5px;font-weight:700">Lv.${lb.level}</span>`:''}
        </div>
        ${m.game?`<div class="ma">🎮 ${esc(m.game.name)}</div>`:lb?`<div class="ma">💬 ${fmtNum(lb.messages)} msgs</div>`:''}
      </div>
      ${m.game?`<div class="gtag">${esc(m.game.name.slice(0,14))}${m.game.name.length>14?'…':''}</div>`:''}
    </div>`;
  }).join('');
}

function setFilter(f){ filter=f; document.querySelectorAll('.pfb').forEach(b=>b.classList.remove('on')); const map={all:'pf-all',online:'pf-o',idle:'pf-i',dnd:'pf-d'}; const el=$(map[f]); if(el) el.classList.add('on'); renderMembers(); }

// ── Voice ─────────────────────────────────────────────────
function renderVoice(mbs,chs){
  const el=$('vc-list'); if(!el) return;
  if(!chs.length){ el.innerHTML=`<div class="pempty"><div class="peico">🔇</div>No active voice channels</div>`; return; }
  el.innerHTML=chs.map(c=>{
    const ins=mbs.filter(m=>m.channel_id===c.id);
    return `<div class="vcg">
      <div class="vch">🔊 <span class="vcn">${esc(c.name)}</span><span class="vcc">${ins.length}</span></div>
      <div class="vcms">${ins.length
        ?ins.map(m=>{ const st=STATUS[m.status]||STATUS.offline; return `<div class="vcmr"><img class="vcav" src="${m.avatar_url}" alt="${esc(m.username)}" loading="lazy"><span style="color:${st.dot}">${st.symbol}</span><span>${esc(m.username)}</span>${m.game?`<span style="font-size:9px;color:var(--t3);margin-left:auto">🎮 ${esc(m.game.name.slice(0,12))}</span>`:''}</div>`; }).join('')
        :'<div class="vce">— vacant —</div>'
      }</div>
    </div>`;
  }).join('');
}

// ── Activity ──────────────────────────────────────────────
function renderActivity(online){
  setText('ac-count',`${online} online`);
  const h=getHistory(),count=h.length;
  const peak=count?Math.max(...h.map(x=>x.c)):online;
  const avg=count?Math.round(h.reduce((s,x)=>s+x.c,0)/count):online;
  setText('ac-pk',peak||'—'); setText('ac-av',avg||'—'); setText('ac-pt',count);
  const wrap=document.querySelector('.ac-chart-wrap'); if(!wrap) return;
  if(count<2){
    wrap.innerHTML=`<div class="ac-empty"><div class="ac-empty-icon">📈</div><div class="ac-empty-title">Not enough history</div><div class="ac-empty-desc">Activity builds over time.</div><div class="ac-empty-stats"><div class="ac-mini"><span class="ac-mini-n">${online}</span><span class="ac-mini-l">Now</span></div><div class="ac-mini"><span class="ac-mini-n">${peak}</span><span class="ac-mini-l">Peak</span></div><div class="ac-mini"><span class="ac-mini-n">${avg}</span><span class="ac-mini-l">Avg</span></div></div></div>`;
    return;
  }
  if(!wrap.querySelector('canvas')) wrap.innerHTML=`<canvas id="actChart" height="140"></canvas>`;
  const last=h.slice(-30);
  if(chart) chart.destroy();
  chart=new Chart($('actChart').getContext('2d'),{
    type:'line',
    data:{labels:last.map(x=>{ const d=new Date(x.t); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }),datasets:[{data:last.map(x=>x.c),borderColor:'#57f287',backgroundColor:'rgba(87,242,135,.08)',borderWidth:2,fill:true,tension:.4,pointRadius:last.length<10?3:0,pointHoverRadius:4,pointBackgroundColor:'#57f287'}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:'#313338',borderColor:'rgba(255,255,255,.1)',borderWidth:1,titleColor:'#b5bac1',bodyColor:'#57f287',bodyFont:{family:"'JetBrains Mono',monospace",weight:'700',size:13},callbacks:{label:c=>` ${c.parsed.y} online`}}},scales:{x:{display:last.length<15,ticks:{color:'#4e5058',font:{size:9},maxTicksLimit:6},grid:{display:false}},y:{beginAtZero:true,ticks:{color:'#4e5058',font:{family:"'JetBrains Mono',monospace",size:9},maxTicksLimit:4},grid:{color:'rgba(255,255,255,.04)'}}}}
  });
}

// ── Leaderboard ───────────────────────────────────────────
function getWidgetStatusMap(){ const map={}; if(!W) return map; (W.members||[]).forEach(m=>{ map[m.username?.toLowerCase()]=m.status; }); return map; }

function renderLeaderboard(){
  const el=$('lb-list'); if(!el) return;
  if(!botLb||!botLb.length){
    el.innerHTML=`<div class="pempty"><div class="peico">${botStats===null?'🔌':'💬'}</div>${botStats===null?'Bot API not connected.':'No message data yet.'}</div>`;
    return;
  }
  const statusMap=getWidgetStatusMap();
  const medals=['👑','🥈','🥉'];
  const total=Math.ceil(botLb.length/LB_PER_PAGE);
  if(lbPage>=total) lbPage=0;
  const page=botLb.slice(lbPage*LB_PER_PAGE,(lbPage+1)*LB_PER_PAGE);

  const rows=page.map((u,i)=>{
    const rank=lbPage*LB_PER_PAGE+i+1;
    const rawSt=statusMap[u.username?.toLowerCase()]||'offline';
    const st=STATUS[rawSt]||STATUS.offline;
    const medal=rank<=3?medals[rank-1]:null;
    const barW=Math.round(Math.min((u.messages/(botLb[0]?.messages||1))*100,100));
    return `<div class="mcrd" style="flex-direction:column;align-items:stretch;gap:6px;padding:10px 12px">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font:700 12px 'JetBrains Mono',monospace;color:${rank<=3?'var(--blurple)':'var(--t3)'};width:28px;text-align:center;flex-shrink:0">${medal||`#${rank}`}</span>
        <div class="avw" style="flex-shrink:0">
          ${u.avatar?`<img class="av" src="${esc(u.avatar)}" loading="lazy" style="width:32px;height:32px">`:`<div class="av" style="width:32px;height:32px;background:var(--bgact);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px">👤</div>`}
          <div class="avs" style="background:${st.dot};border-color:var(--bg3)"></div>
        </div>
        <div class="minfo" style="flex:1;min-width:0">
          <div class="mn-row">
            <span class="mn">${esc(u.username)}</span>
            <span style="font-size:9px;color:${st.dot};font-weight:700;margin-left:4px">${st.symbol}</span>
            <span style="font-size:8px;background:var(--blurple-a);color:var(--blurple);border-radius:4px;padding:1px 5px;font-weight:700">Lv.${u.level}</span>
          </div>
          <div class="ma">💬 ${fmtNum(u.messages)} messages</div>
        </div>
        <span style="font:700 11px 'JetBrains Mono',monospace;color:var(--green-b);flex-shrink:0">${fmtNum(u.messages)}</span>
      </div>
      <div style="height:3px;background:var(--bgact);border-radius:2px;overflow:hidden;margin-left:38px">
        <div style="height:100%;width:${barW}%;background:linear-gradient(90deg,var(--blurple),#57f287);border-radius:2px;transition:width .6s ease"></div>
      </div>
    </div>`;
  }).join('');

  const pagi=total>1?`
    <div style="display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 16px;border-top:1px solid var(--bd)">
      <button onclick="lbPageNav(-1)" style="background:var(--bg3);border:1px solid var(--bd2);color:var(--t2);border-radius:6px;padding:5px 12px;cursor:pointer;font:600 12px 'Outfit',sans-serif;${lbPage===0?'opacity:.4;cursor:default':''}">◀</button>
      <span style="font:700 11px 'JetBrains Mono',monospace;color:var(--t3)">${lbPage+1} / ${total}</span>
      <button onclick="lbPageNav(1)" style="background:var(--bg3);border:1px solid var(--bd2);color:var(--t2);border-radius:6px;padding:5px 12px;cursor:pointer;font:600 12px 'Outfit',sans-serif;${lbPage===total-1?'opacity:.4;cursor:default':''}">▶</button>
    </div>`:'';

  el.innerHTML=`<div style="padding:6px 0">${rows}</div>${pagi}`;
}

function lbPageNav(dir){ const total=Math.ceil((botLb?.length||0)/LB_PER_PAGE); lbPage=Math.max(0,Math.min(total-1,lbPage+dir)); renderLeaderboard(); }

// ── Giveaways ─────────────────────────────────────────────
function renderGiveaways(){
  const el=$('gw-list'); if(!el) return;
  if(!botGiveaways||!botGiveaways.length){
    el.innerHTML=`<div class="pempty"><div class="peico">🎁</div>${botStats===null?'Bot API not connected.':'No active giveaways.'}</div>`;
    return;
  }
  const now=Date.now();
  el.innerHTML=botGiveaways.map(gw=>{
    const ended=gw.ended;
    const left=Math.max(0,gw.endAt-now);
    const mins=Math.floor(left/60000), hrs=Math.floor(left/3600000), days=Math.floor(left/86400000);
    const timeStr=ended?'Ended':days>0?`${days}d ${hrs%24}h left`:hrs>0?`${hrs}h ${mins%60}m left`:`${mins}m left`;
    const color=ended?'#2ECC71':'#F1C40F';
    const pct=ended?100:Math.max(0,Math.min(100,100-(left/(gw.endAt-(gw.endAt-left+1))*100)));
    return `<div style="background:var(--bg3);border:1px solid var(--bd);border-radius:10px;padding:14px 16px;margin-bottom:8px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:13px;font-weight:800;color:var(--t1)">🎁 ${esc(gw.prize)}</span>
        <span style="font-size:10px;font-weight:700;color:${color};background:${color}22;padding:3px 8px;border-radius:20px;border:1px solid ${color}44">${ended?'✅ Ended':'🔴 Live'}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px">
        <div style="text-align:center;background:var(--bgact);border-radius:6px;padding:6px"><div style="font:700 13px 'JetBrains Mono',monospace;color:var(--t1)">${fmtNum(gw.participants)}</div><div style="font-size:8px;color:var(--t3);font-weight:700;text-transform:uppercase;letter-spacing:.8px;margin-top:2px">Entries</div></div>
        <div style="text-align:center;background:var(--bgact);border-radius:6px;padding:6px"><div style="font:700 13px 'JetBrains Mono',monospace;color:var(--t1)">${gw.winners}</div><div style="font-size:8px;color:var(--t3);font-weight:700;text-transform:uppercase;letter-spacing:.8px;margin-top:2px">Winners</div></div>
        <div style="text-align:center;background:var(--bgact);border-radius:6px;padding:6px"><div style="font:700 11px 'JetBrains Mono',monospace;color:${color}">${esc(timeStr)}</div><div style="font-size:8px;color:var(--t3);font-weight:700;text-transform:uppercase;letter-spacing:.8px;margin-top:2px">Time</div></div>
      </div>
      ${gw.winnerIds?.length?`<div style="font-size:10px;color:var(--t3);margin-bottom:6px">🏆 Winners: <span style="color:var(--green-b);font-weight:700">${gw.winnerNames?.join(', ')||gw.winnerIds.join(', ')}</span></div>`:''}
      ${gw.reqMsgs?`<div style="font-size:10px;color:var(--t3)">✉️ Requires ${fmtNum(gw.reqMsgs)} messages</div>`:''}
      <div style="height:3px;background:var(--bgact);border-radius:2px;overflow:hidden;margin-top:8px">
        <div style="height:100%;width:${ended?100:Math.round((1-left/Math.max(gw.duration||1,1))*100)}%;background:linear-gradient(90deg,${color},${color}88);border-radius:2px;transition:width .6s ease"></div>
      </div>
    </div>`;
  }).join('');
}

// ── Bot Log ───────────────────────────────────────────────
function renderLog(){
  const el=$('log-list'); if(!el) return;
  if(!botLog||!botLog.length){
    el.innerHTML=`<div class="pempty"><div class="peico">📋</div>${botStats===null?'Bot API not connected.':'No logs yet.'}</div>`;
    return;
  }
  const typeColors={BOT:'#5865f2',JOIN:'#2ecc71',LEAVE:'#e74c3c',LEVEL:'#f59e0b',GIVEAWAY:'#ff73fa',BOOST:'#e91e63',ERROR:'#f23f43',API:'#80848e'};
  el.innerHTML=`<div style="padding:8px 0">${botLog.map(entry=>{
    const color=typeColors[entry.type]||'#80848e';
    const d=new Date(entry.at);
    const time=`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
    return `<div style="display:flex;align-items:flex-start;gap:10px;padding:6px 14px;border-bottom:1px solid var(--bd);transition:background .1s" onmouseenter="this.style.background='var(--bghov)'" onmouseleave="this.style.background=''">
      <span style="font:700 9px 'JetBrains Mono',monospace;color:${color};background:${color}22;border:1px solid ${color}44;border-radius:4px;padding:2px 5px;flex-shrink:0;margin-top:1px">${esc(entry.type)}</span>
      <span style="flex:1;font-size:11px;color:var(--t2);line-height:1.5">${esc(entry.msg)}</span>
      <span style="font:500 9px 'JetBrains Mono',monospace;color:var(--t3);flex-shrink:0;margin-top:2px">${time}</span>
    </div>`;
  }).join('')}</div>`;
}

// ── Overview ──────────────────────────────────────────────
function renderOverview(mbs,total,online,tier,bc,g){
  const o=mbs.filter(m=>m.status==='online').length;
  const id=mbs.filter(m=>m.status==='idle').length;
  const dn=mbs.filter(m=>m.status==='dnd').length;
  const tot=mbs.length||1;
  const p=n=>((n/tot)*100).toFixed(1);
  const feats=(g.features||[]).filter(f=>FM[f]).slice(0,8);
  const totalMsgs=botStats?.totalMessages||0;
  const tracked=botStats?.trackedUsers||0;
  const uptime=botStats?.uptime||0;
  const uptStr=uptime?`${Math.floor(uptime/86400)}d ${Math.floor(uptime%86400/3600)}h ${Math.floor(uptime%3600/60)}m`:'—';
  const ytSubs=botStats?.ytSubscribers||0;

  let h=`
    <div class="ov-sec">📊 Status Breakdown</div>
    <div class="sbb"><div class="sbb-s o" style="width:${p(o)}%"></div><div class="sbb-s i" style="width:${p(id)}%"></div><div class="sbb-s d" style="width:${p(dn)}%"></div></div>
    <div class="leg">
      <span class="leg-i"><span class="ldot" style="background:#23a55a"></span>Online <span class="lcnt">${o}</span></span>
      <span class="leg-i"><span class="ldot" style="background:#f0b232"></span>Idle <span class="lcnt">${id}</span></span>
      <span class="leg-i"><span class="ldot" style="background:#f23f43"></span>DND <span class="lcnt">${dn}</span></span>
      <span class="leg-i"><span class="ldot" style="background:#80848e"></span>Offline <span class="lcnt">${Math.max(0,(botStats?.memberCount||total)-o-id-dn)}</span></span>
    </div>
    <div class="ov-sec" style="margin-top:12px">🌐 Server Info</div>
    <div class="irow"><span class="ilbl">👥 Members</span><span class="ival">${fmtNum(total)}</span></div>
    <div class="irow"><span class="ilbl">🛡 Verification</span><span class="ival">${VL[g.verification_level||0]}</span></div>
    <div class="irow"><span class="ilbl">⚡ Boost Level</span><span class="ival">${BT[tier]} · ${bc} boosts</span></div>
    <div class="irow"><span class="ilbl">🆔 Server ID</span><span class="ival" style="font-family:'JetBrains Mono',monospace;font-size:9px">${GID}</span></div>`;

  if(totalMsgs||ytSubs){
    h+=`<div class="ov-sec" style="margin-top:12px">🤖 Bot Stats</div>
    <div class="irow"><span class="ilbl">💬 Total Messages</span><span class="ival">${fmtNum(totalMsgs)}</span></div>
    <div class="irow"><span class="ilbl">👤 Tracked Users</span><span class="ival">${fmtNum(tracked)}</span></div>
    <div class="irow"><span class="ilbl">📺 YouTube Subs</span><span class="ival">${ytSubs?fmtNum(ytSubs):'—'}</span></div>
    <div class="irow"><span class="ilbl">⏱️ Bot Uptime</span><span class="ival">${uptStr}</span></div>`;
  }

  if(botGiveaways?.length){
    const active=botGiveaways.filter(g=>!g.ended).length;
    const ended=botGiveaways.filter(g=>g.ended).length;
    h+=`<div class="ov-sec" style="margin-top:12px">🎁 Giveaways</div>
    <div class="irow"><span class="ilbl">🔴 Active</span><span class="ival">${active}</span></div>
    <div class="irow"><span class="ilbl">✅ Ended</span><span class="ival">${ended}</span></div>`;
  }

  if(feats.length){
    h+=`<div class="ov-sec" style="margin-top:12px">✨ Server Features</div><div class="igrid">`;
    feats.forEach(f=>{ const[ic,lb]=FM[f]; h+=`<div class="icell"><span>${ic}</span>${lb}</div>`; });
    h+=`</div>`;
  }

  const el=$('ov-content'); if(el) el.innerHTML=`<div style="padding:14px 16px">${h}</div>`;
}

// ── Tabs ──────────────────────────────────────────────────
function switchTab(t){
  const map={mb:'wp-mb',vc:'wp-vc',ac:'wp-ac',lb:'wp-lb',gw:'wp-gw',log:'wp-log',ov:'wp-ov'};
  const keys=['mb','vc','ac','lb','gw','log','ov'];
  document.querySelectorAll('.wtab').forEach((b,i)=>b.classList.toggle('on',keys[i]===t));
  Object.values(map).forEach(id=>{ const el=$(id); if(el) el.classList.remove('on'); });
  const active=$(map[t]); if(active) active.classList.add('on');
  if(t==='ac'&&chart) chart.resize();
}

function copyInvite(){
  const url=$('join-btn')?.href||`https://discord.gg/${CODE}`;
  navigator.clipboard.writeText(url).catch(()=>{});
  const t=$('toast'); if(!t) return;
  t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1800);
}

function animCount(id,v){
  const el=$(id); if(!el) return;
  if(!v){ el.textContent='—'; return; }
  const start=performance.now();
  const tick=(now)=>{ const p=Math.min((now-start)/700,1),ease=1-Math.pow(1-p,3); el.textContent=Math.round(v*ease).toLocaleString(); if(p<1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}

spawnParticles();
loadData();
setInterval(loadData,35000);