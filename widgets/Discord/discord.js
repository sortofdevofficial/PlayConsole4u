const GID = '1503297362246897694';
const CODE = 'dS4pgC9J5H';
const HK = `dcw_${GID}`;
const BR = [0,2,7,14];
const BT = {0:'No Level',1:'Level 1',2:'Level 2',3:'Level 3'};
const VL = ['None','Low','Medium','High','Very High'];
const FM = {
  COMMUNITY:['🏘','Community'],VERIFIED:['✅','Verified'],PARTNERED:['🤝','Partner'],
  ANIMATED_ICON:['✨','Animated Icon'],BANNER:['🎨','Banner'],
  DISCOVERABLE:['🔍','Discoverable'],VANITY_URL:['🔗','Vanity URL'],
  NEWS:['📰','News Channels'],THREADS_ENABLED:['🧵','Threads'],
  MONETIZATION_ENABLED:['💰','Monetization']
};

// role badge matching by username keyword
const ROLE_MAP = [
  { match:'sortofdev', role:'👑 Owner',  color:'#ffd700', bg:'rgba(255,215,0,.15)' },
  { match:'mod',       role:'🛡 Mod',    color:'#57f287', bg:'rgba(87,242,135,.15)' },
  { match:'admin',     role:'⚡ Admin',  color:'#5865f2', bg:'rgba(88,101,242,.15)' },
  { match:'bot',       role:'🤖 Bot',    color:'#80848e', bg:'rgba(128,132,142,.15)' },
  { match:'dev',       role:'💻 Dev',    color:'#3b9eed', bg:'rgba(59,158,237,.15)' },
];

let W = null, I = null, chart = null, filter = 'all';

// ── PARTICLES ────────────────────────────────────────────
function spawnParticles() {
  const wrap = document.getElementById('particles');
  if (!wrap) return;
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 4 + 2;
    p.style.cssText = `
      width:${size}px;height:${size}px;
      left:${Math.random()*100}%;
      top:${Math.random()*100}%;
      animation-duration:${Math.random()*12+8}s;
      animation-delay:${Math.random()*8}s;
    `;
    wrap.appendChild(p);
  }
}

// ── DATA LOAD ─────────────────────────────────────────────
async function loadData() {
  try {
    const [wr, ir] = await Promise.all([
      fetch(`https://discord.com/api/guilds/${GID}/widget.json`),
      fetch(`https://discord.com/api/v9/invites/${CODE}?with_counts=true`)
    ]);
    if (!wr.ok) throw new Error('Widget disabled. Enable in Server Settings → Widget.');
    W = await wr.json();
    I = ir.ok ? await ir.json() : null;
    saveHistory(W.presence_count || 0);
    render();
    resetBar();
  } catch(e) {
    document.getElementById('ov-content').innerHTML = `<div class="pempty"><div class="peico">⚠️</div><p>${esc(e.message)}</p></div>`;
  }
}

// ── HISTORY ───────────────────────────────────────────────
function saveHistory(c) {
  try {
    const a = JSON.parse(localStorage.getItem(HK) || '[]');
    a.push({ t: Date.now(), c });
    while (a.length > 80) a.shift();
    localStorage.setItem(HK, JSON.stringify(a));
  } catch {}
}
function getHistory() {
  try { return JSON.parse(localStorage.getItem(HK) || '[]'); } catch { return []; }
}

// ── REFRESH BAR ───────────────────────────────────────────
function resetBar() {
  const e = document.getElementById('rfill');
  if (!e) return;
  e.style.animation = 'none';
  void e.offsetWidth;
  e.style.animation = 'rfa 35s linear forwards';
}

// ── RENDER ALL ────────────────────────────────────────────
function render() {
  if (!W) return;
  const g = I?.guild || {};
  const total = I?.approximate_member_count || 0;
  const online = W.presence_count || 0;
  const mbs = W.members || [];
  const chs = W.channels || [];
  const tier = g.premium_tier || 0;
  const bc = g.premium_subscription_count || 0;
  const voiceCount = chs.reduce((s, c) => s + mbs.filter(m => m.channel_id === c.id).length, 0);

  // icon
  const ico = g.icon
    ? `https://cdn.discordapp.com/icons/${GID}/${g.icon}.webp?size=256`
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(W.name)}&background=5865f2&color=fff&bold=true&size=256`;
  const heroIcon = document.getElementById('hero-icon');
  if (heroIcon) heroIcon.src = ico;

  // hero text
  setText('hero-title', W.name);
  setText('hero-desc', g.description || 'An active community of gamers and creators — join the grid.');

  // hero stats
  animCount('h-total', total);
  animCount('h-online', online);
  document.getElementById('h-voice').textContent = voiceCount;
  document.getElementById('h-boosts').textContent = bc;

  // boost bar
  if (tier > 0 || bc > 0) {
    const bw = document.getElementById('boost-wrap');
    if (bw) bw.style.display = '';
    setText('boost-tier', BT[tier]);
    setText('boost-count', `${bc} boost${bc !== 1 ? 's' : ''}`);
    const next = BR[Math.min(tier + 1, 3)] || BR[3];
    const pct = next ? Math.min((bc / next) * 100, 100) : 100;
    const bf = document.getElementById('boost-fill');
    if (bf) bf.style.width = pct + '%';
  }

  // join invite
  if (W.instant_invite) {
    const jb = document.getElementById('join-btn');
    if (jb) jb.href = W.instant_invite;
  }

  renderMembers();
  renderVoice(mbs, chs);
  renderActivity(online);
  renderOverview(mbs, total, online, tier, bc, g);
}

// ── MEMBERS ───────────────────────────────────────────────
function renderMembers() {
  if (!W) return;
  const mbs = W.members || [];
  const q = (document.getElementById('mb-srch')?.value || '').toLowerCase();
  const ctrl = document.getElementById('mb-ctrl');
  if (ctrl) ctrl.style.display = '';

  const co = {
    all: mbs.length,
    online: mbs.filter(m => m.status === 'online').length,
    idle: mbs.filter(m => m.status === 'idle').length,
    dnd: mbs.filter(m => m.status === 'dnd').length,
  };
  setText('pfc-a', co.all);
  setText('pfc-o', co.online);
  setText('pfc-i', co.idle);
  setText('pfc-d', co.dnd);

  const list = mbs.filter(m =>
    (filter === 'all' || m.status === filter) &&
    (!q || m.username.toLowerCase().includes(q))
  );

  const el = document.getElementById('mb-list');
  if (!el) return;
  if (!list.length) { el.innerHTML = `<div class="pempty"><div class="peico">🔍</div>No members found</div>`; return; }

  el.innerHTML = list.map(m => `
    <div class="mcrd">
      <div class="avw">
        <img class="av" src="${m.avatar_url}" alt="${esc(m.username)}" loading="lazy">
        <div class="avs ${m.status || 'o'}"></div>
      </div>
      <div class="minfo">
        <div class="mn-row">
          <span class="mn">${esc(m.username)}</span>
          ${roleBadge(m.username)}
        </div>
        ${m.game ? `<div class="ma">🎮 ${esc(m.game.name)}</div>` : ''}
      </div>
      ${m.game ? `<div class="gtag">${esc(m.game.name.slice(0, 14))}${m.game.name.length > 14 ? '…' : ''}</div>` : ''}
    </div>`).join('');
}

function setFilter(f) {
  filter = f;
  document.querySelectorAll('.pfb').forEach(b => b.classList.remove('on'));
  const map = { all:'pf-all', online:'pf-o', idle:'pf-i', dnd:'pf-d' };
  const el = document.getElementById(map[f]);
  if (el) el.classList.add('on');
  renderMembers();
}

// ── VOICE ─────────────────────────────────────────────────
function renderVoice(mbs, chs) {
  const el = document.getElementById('vc-list');
  if (!el) return;
  if (!chs.length) { el.innerHTML = `<div class="pempty"><div class="peico">🔇</div>No active voice channels</div>`; return; }
  el.innerHTML = chs.map(c => {
    const ins = mbs.filter(m => m.channel_id === c.id);
    return `<div class="vcg">
      <div class="vch">🔊 <span class="vcn">${esc(c.name)}</span><span class="vcc">${ins.length}</span></div>
      <div class="vcms">${ins.length
        ? ins.map(m => `<div class="vcmr">
            <img class="vcav" src="${m.avatar_url}" loading="lazy">
            <span>${esc(m.username)}</span>
            ${roleBadge(m.username)}
            ${m.game ? `<span style="font-size:9px;color:var(--t3);margin-left:auto">🎮 ${esc(m.game.name.slice(0, 12))}</span>` : ''}
          </div>`).join('')
        : '<div class="vce">— vacant —</div>'}
      </div>
    </div>`;
  }).join('');
}

// ── ACTIVITY ──────────────────────────────────────────────
function renderActivity(online) {
  setText('ac-count', `${online} online`);
  const h = getHistory();
  document.getElementById('ac-pk').textContent = h.length ? Math.max(...h.map(x => x.c)) : '—';
  document.getElementById('ac-av').textContent = h.length ? Math.round(h.reduce((s, x) => s + x.c, 0) / h.length) : '—';
  document.getElementById('ac-pt').textContent = h.length;

  const wrap = document.querySelector('.ac-chart-wrap');
  if (!wrap) return;
  if (h.length < 2) {
    wrap.innerHTML = `<div style="padding:14px;text-align:center;font-size:11px;color:var(--t3)">Not enough history yet — revisit to build the chart.</div>`;
    return;
  }
  if (!wrap.querySelector('canvas')) wrap.innerHTML = `<canvas id="actChart" height="120"></canvas>`;
  const last = h.slice(-30);
  if (chart) chart.destroy();
  chart = new Chart(document.getElementById('actChart').getContext('2d'), {
    type: 'line',
    data: {
      labels: last.map(x => { const d = new Date(x.t); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }),
      datasets: [{ data: last.map(x => x.c), borderColor:'#57f287', backgroundColor:'rgba(87,242,135,.08)', borderWidth:2, fill:true, tension:.4, pointRadius: last.length < 10 ? 3 : 0, pointHoverRadius:4, pointBackgroundColor:'#57f287' }]
    },
    options: {
      responsive:true,
      plugins:{ legend:{display:false}, tooltip:{ backgroundColor:'#313338', borderColor:'rgba(255,255,255,.1)', borderWidth:1, titleColor:'#b5bac1', bodyColor:'#57f287', bodyFont:{family:"'JetBrains Mono',monospace",weight:'700',size:13}, callbacks:{label:c=>` ${c.parsed.y} online`} } },
      scales:{
        x:{display: last.length < 15, ticks:{color:'#4e5058',font:{size:9},maxTicksLimit:6}, grid:{display:false}},
        y:{ticks:{color:'#4e5058',font:{family:"'JetBrains Mono',monospace",size:9},maxTicksLimit:4}, grid:{color:'rgba(255,255,255,.04)'}}
      }
    }
  });
}

// ── OVERVIEW ──────────────────────────────────────────────
function renderOverview(mbs, total, online, tier, bc, g) {
  const o = mbs.filter(m => m.status === 'online').length;
  const id = mbs.filter(m => m.status === 'idle').length;
  const dn = mbs.filter(m => m.status === 'dnd').length;
  const tot = mbs.length || 1;
  const p = n => ((n / tot) * 100).toFixed(1);
  const next = BR[Math.min(tier + 1, 3)] || BR[3];
  const bp = next ? Math.min((bc / next) * 100, 100) : 100;
  const feats = (g.features || []).filter(f => FM[f]).slice(0, 8);

  let h = `
    <div class="ov-sec">Status Breakdown</div>
    <div class="sbb">
      <div class="sbb-s o" style="width:${p(o)}%"></div>
      <div class="sbb-s i" style="width:${p(id)}%"></div>
      <div class="sbb-s d" style="width:${p(dn)}%"></div>
    </div>
    <div class="leg">
      <span class="leg-i"><span class="ldot" style="background:var(--green)"></span>Online <span class="lcnt">${o}</span></span>
      <span class="leg-i"><span class="ldot" style="background:var(--yellow)"></span>Idle <span class="lcnt">${id}</span></span>
      <span class="leg-i"><span class="ldot" style="background:var(--red)"></span>DND <span class="lcnt">${dn}</span></span>
    </div>
    <div class="ov-sec" style="margin-top:12px">Server Info</div>
    <div class="irow"><span class="ilbl">👥 Members</span><span class="ival">${total.toLocaleString()}</span></div>
    <div class="irow"><span class="ilbl">🛡 Verification</span><span class="ival">${VL[g.verification_level || 0]}</span></div>
    <div class="irow"><span class="ilbl">⚡ Boost Level</span><span class="ival">${BT[tier]} · ${bc} boosts</span></div>`;

  if (feats.length) {
    h += `<div class="ov-sec" style="margin-top:12px">Features</div><div class="igrid">`;
    feats.forEach(f => { const [ic, lb] = FM[f]; h += `<div class="icell"><span>${ic}</span>${lb}</div>`; });
    h += `</div>`;
  }
  const el = document.getElementById('ov-content');
  if (el) el.innerHTML = `<div style="padding:14px 16px">${h}</div>`;
}

// ── TAB SWITCH ────────────────────────────────────────────
function switchTab(t) {
  const map = { mb:'wp-mb', vc:'wp-vc', ac:'wp-ac', ov:'wp-ov' };
  document.querySelectorAll('.wtab').forEach((b, i) => {
    const keys = ['mb','vc','ac','ov'];
    b.classList.toggle('on', keys[i] === t);
  });
  Object.values(map).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('on');
  });
  const active = document.getElementById(map[t]);
  if (active) active.classList.add('on');
}

// ── COPY INVITE ───────────────────────────────────────────
function copyInvite() {
  const url = document.getElementById('join-btn')?.href || `https://discord.gg/${CODE}`;
  navigator.clipboard.writeText(url).catch(() => {});
  const t = document.getElementById('toast');
  if (!t) return;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}

// ── HELPERS ───────────────────────────────────────────────
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function animCount(id, v) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!v) { el.textContent = '—'; return; }
  let s = performance.now();
  (function step(n) {
    const p = Math.min((n - s) / 700, 1), ease = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(v * ease).toLocaleString();
    if (p < 1) requestAnimationFrame(step);
  })(s);
}

function roleBadge(username) {
  const u = username.toLowerCase();
  const m = ROLE_MAP.find(r => u.includes(r.match));
  if (!m) return '';
  return `<span class="role-badge" style="color:${m.color};background:${m.bg};border-color:${m.color}33">${m.role}</span>`;
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── INIT ──────────────────────────────────────────────────
spawnParticles();
loadData();
setInterval(loadData, 35000);