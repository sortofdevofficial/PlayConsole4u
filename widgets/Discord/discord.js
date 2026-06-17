const {
  Client, GatewayIntentBits, ActivityType, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, REST, Routes, SlashCommandBuilder,
  MessageFlags, PermissionFlagsBits, ChannelType, Partials
} = require('discord.js');
const http = require('http');
const fs = require('fs');
const path = require('path');
const pkg = require('./package.json');

// ── CONFIGURATION MATRIX ─────────────────────────────────
const TOKEN          = pkg.config?.TOKEN          || process.env.TOKEN || '';
const CLIENT_ID      = pkg.config?.CLIENT_ID      || process.env.CLIENT_ID || '';
const YT_KEY         = pkg.config?.YT_KEY         || process.env.YT_KEY || '';
const API_PORT       = pkg.config?.API_PORT       || 3001;
const API_KEY        = pkg.config?.API_KEY        || 'sortofdev';
const YT_ID          = 'UC8eEGtjt9tW3jpkXucPBvvA';
const OWNER_ID       = '1503283902305927278';
const OWNER_ROLE     = '1505118900948566059';

const CH = {
  sys  : '1505111889850404864',
  stats: '1505204180674019520',
  event: '1513920811151393091',
  vc   : '1503297363010130025',
};

const TARGET_CHAT_ID   = '1503297363010130024';
const LEVEL_CH         = '1515397913537151007';
const TICKET_CAT       = '1512857106733203487';
const TICKET_LOG       = '1512857103541469326';
const STAFF_ROLE       = '1512857101494517931';
const STATS_MSG        = '1507081827347861607';

const GOALS            = { yt: 100, dc: 100 };
const PER_PAGE         = 10;
const DRY_CHAT_TIMEOUT = 30 * 60 * 1000;
const MSGS_PER_LVL     = 100;

const LVL_COLORS = ['#5865F2','#2ECC71','#F59E0B','#E91E63','#9B59B6'];
const EIGHTBALL = ['It is certain.', 'Without a doubt.', 'Yes!', 'Ask again later.', 'My reply is no.'];
const DRY_CHAT_LINES = [
  "Damn, this chat is dryer than a Popeyes biscuit 💀 Let's get some words moving!",
  "Chat is dead... somebody call a medic or bring an actual topic 🚑",
  "This chat is currently dryer than a desert tumbleweed 🌵 wake up y'all!"
];

// ── STORAGE LOGIC LAYER ──────────────────────────────────
const load = (f, d = {}) => {
  try { return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d; }
  catch { return d; }
};

const save = (f, d) => {
  try { fs.writeFileSync(f, JSON.stringify(d, null, 2), 'utf8'); }
  catch (e) { console.error(`[DATABASE] Write Failure on ${f}:`, e); }
};

let counts    = load('./counts.json');
let giveaways = load('./giveaways.json');
let tickets   = { _counter: 0 };
let lastChatTimestamp = Date.now();

const log = (type, msg) => { console.log(`[${type}] [${new Date().toLocaleTimeString()}] ${msg}`); };

// ── UTILITIES & EMBEDS ───────────────────────────────────
const E = (t, c = '#5865F2') => new EmbedBuilder().setColor(c).setTitle(t).setTimestamp();
const fmt = n => Number(n || 0).toLocaleString();
const getLvl = msgs => Math.floor((msgs || 0) / MSGS_PER_LVL);
const bar = (n, g) => { const x = Math.round(Math.min(g ? n / g : 0, 1) * 10); return '█'.repeat(x) + '░'.repeat(10 - x); };
const pct = (n, g) => Math.round(Math.min(g ? n / g : 0, 1) * 100);
const gch = id => client.channels.fetch(id).catch(() => null);

function buildLvlEmbed(user, lvl, msgs) {
  const prog = msgs % MSGS_PER_LVL, color = LVL_COLORS[lvl % LVL_COLORS.length];
  return new EmbedBuilder().setColor(color)
    .setTitle(`⚡ LEVEL UP — Level ${lvl}`)
    .setDescription(`<@${user.id}> reached **Level ${lvl}**! 🎉`)
    .setThumbnail(user.displayAvatarURL({ size: 128 }))
    .addFields(
      { name: '📊 Level',    value: `**${lvl}**`, inline: true },
      { name: '💬 Messages', value: `**${fmt(msgs)}**`, inline: true },
      { name: '📈 Progress', value: `${bar(prog, MSGS_PER_LVL)} **${prog}/${MSGS_PER_LVL}**`, inline: false }
    );
}

const buildLbEmbed = (s, page) => E('🏆 LEADERBOARD')
  .setDescription(s.slice(page * PER_PAGE, (page + 1) * PER_PAGE).map(([id, c], i) => { 
    const r = page * PER_PAGE + i + 1; 
    return `\`#${r}\` <@${id}> — **${fmt(c)}** msgs · Lv.**${getLvl(c)}**`; 
  }).join('\n') || '*No records.*')
  .setFooter({ text: `Page ${page + 1} / ${Math.max(1, Math.ceil(s.length / PER_PAGE))}` });

const buildLbBtns = (page, total) => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('lb_prev').setLabel('◀').setStyle(ButtonStyle.Primary).setDisabled(page === 0),
  new ButtonBuilder().setCustomId('lb_page').setLabel(`${page + 1}/${total}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
  new ButtonBuilder().setCustomId('lb_next').setLabel('▶').setStyle(ButtonStyle.Primary).setDisabled(page === total - 1)
);

async function getYT() {
  if (!YT_KEY) return null;
  try { const d = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${YT_ID}&key=${YT_KEY}`).then(r => r.json()); return d?.items?.[0]?.statistics?.subscriberCount ? Number(d.items[0].statistics.subscriberCount) : null; }
  catch { return null; }
}

async function updateStatsEmbed() {
  const ch = await gch(CH.stats); if (!ch) return;
  const msg = await ch.messages.fetch(STATS_MSG).catch(() => null); if (!msg) return;
  const yt = await getYT(), dc = ch.guild.memberCount;
  await msg.edit({ embeds: [E('📊 LIVE SERVER STATS').addFields(
    { name: '📺 YouTube', value: yt == null ? '`API Offline`' : `\`${fmt(yt)} / ${GOALS.yt}\`\n${bar(yt, GOALS.yt)} **${pct(yt, GOALS.yt)}%**`, inline: true },
    { name: '👥 Discord', value: `\`${fmt(dc)} / ${GOALS.dc}\`\n${bar(dc, GOALS.dc)} **${pct(dc, GOALS.dc)}%**`, inline: true }
  )] }).catch(() => {});
}

// ── DISCORD CLIENT ENGINE ────────────────────────────────
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates]
});

client.once('ready', async () => {
  log('SYS', `Logged into Discord infrastructure as ${client.user.tag}`);
  client.user.setActivity('!cmds | Engine Control', { type: ActivityType.Watching });

  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    const cmds = [
      new SlashCommandBuilder().setName('ping').setDescription('Check latency status specs'),
      new SlashCommandBuilder().setName('leaderboard').setDescription('Display ranking list data')
    ];
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: cmds });
  } catch (err) { log('ERR', 'Failed registering commands: ' + err.message); }

  setInterval(updateStatsEmbed, 300000);
  setInterval(() => { save('./counts.json', counts); }, 30000);

  setInterval(async () => {
    if (Date.now() - lastChatTimestamp >= DRY_CHAT_TIMEOUT) {
      const dryCh = await gch(TARGET_CHAT_ID);
      if (dryCh) { dryCh.send({ content: DRY_CHAT_LINES[Math.floor(Math.random() * DRY_CHAT_LINES.length)] }).catch(() => {}); lastChatTimestamp = Date.now(); }
    }
  }, 60000);
});

client.on('messageCreate', async msg => {
  if (msg.author.bot || !msg.guild) return;
  if (msg.channel.id === TARGET_CHAT_ID) { lastChatTimestamp = Date.now(); }

  const content = msg.content.trim();
  const isPrefixed = /^[?!-]/.test(content);

  if (!isPrefixed && content.length > 0) {
    const next = (counts[msg.author.id] || 0) + 1;
    counts[msg.author.id] = next;

    if (next % MSGS_PER_LVL === 0) {
      const currentLvl = Math.floor(next / MSGS_PER_LVL);
      const lvlCh = await gch(LEVEL_CH);
      if (lvlCh) { await lvlCh.send({ embeds: [buildLvlEmbed(msg.author, currentLvl, next)] }).catch(() => {}); }
    }
  }

  if (!isPrefixed) return;
  const args = content.slice(1).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  if (command === 'ping') return msg.reply(`🏓 Latency Matrix: \`${client.ws.ping}ms\``);
  if (command === '8ball') return msg.reply(`🎱 ${EIGHTBALL[Math.floor(Math.random() * EIGHTBALL.length)]}`);
  if (command === 'lb' || command === 'leaderboard') {
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return msg.reply({ embeds: [buildLbEmbed(sorted, 0)], components: [buildLbBtns(0, Math.max(1, Math.ceil(sorted.length / PER_PAGE)))] });
  }
});

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'ping') return interaction.reply({ content: `🏓 Latency is \`${client.ws.ping}ms\``, flags: MessageFlags.Ephemeral });
      if (interaction.commandName === 'leaderboard') {
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        return interaction.reply({ embeds: [buildLbEmbed(sorted, 0)], components: [buildLbBtns(0, Math.max(1, Math.ceil(sorted.length / PER_PAGE)))] });
      }
    }

    if (interaction.isButton()) {
      if (interaction.customId.startsWith('lb_')) {
        await interaction.deferUpdate();
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const match = (interaction.message.embeds[0]?.footer?.text || '').match(/Page (\d+) \/ (\d+)/);
        if (!match) return;
        let page = parseInt(match[1]) - 1;
        if (interaction.customId === 'lb_prev') page--;
        if (interaction.customId === 'lb_next') page++;
        await interaction.message.edit({ embeds: [buildLbEmbed(sorted, page)], components: [buildLbBtns(page, parseInt(match[2]))] }).catch(() => {});
      }
    }
  } catch (err) { console.error('[INTERACTION ERROR]', err); }
});

if (TOKEN) { client.login(TOKEN); } else { console.error('[CRITICAL] Missing Discord Token in configuration.'); }

// ── INTEGRATED HTTP TELEMETRY SERVER ─────────────────────
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = url.pathname;

  // Serve absolute root favicon immediately if requested
  if (p === '/favicon.png' || p === '/favicon.ico') {
    const faviconPath = path.join(__dirname, 'favicon.png');
    if (fs.existsSync(faviconPath)) {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      return res.end(fs.readFileSync(faviconPath));
    }
    res.writeHead(404); return res.end();
  }

  // Cross-Origin Header Settings
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(200); return res.end(); }

  const authKey = url.searchParams.get('key') || req.headers['authorization'];
  if (authKey !== API_KEY) {
    res.writeHead(401);
    return res.end(JSON.stringify({ error: 'Unauthorized endpoint access verification failure.' }));
  }

  if (p === '/api/data') {
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return res.end(JSON.stringify({
      serverName: "Engine Grid",
      totalMessages: sorted.reduce((acc, curr) => acc + curr[1], 0),
      memberCount: client.guilds.cache.first()?.memberCount || sorted.length,
      leaderboard: sorted.slice(0, 50).map(([id, val], idx) => ({ rank: idx + 1, id, messages: val, level: Math.floor(val / 100) })),
      activeGiveaways: Object.values(giveaways).filter(g => !g.ended)
    }));
  }

  if (p === '/user') {
    const uid = url.searchParams.get('id');
    if (!uid) { res.writeHead(400); return res.end(JSON.stringify({ error: 'Missing target User ID parameter.' })); }
    
    const userMsgs = counts[uid] || 0;
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const rankPos = sorted.findIndex(([id]) => id === uid);

    return res.end(JSON.stringify({
      id: uid,
      messages: userMsgs,
      level: Math.floor(userMsgs / 100),
      rank: rankPos !== -1 ? rankPos + 1 : 'Unranked'
    }));
  }

  res.writeHead(404);
  return res.end(JSON.stringify({ error: 'Routing path not found.' }));
});

server.listen(API_PORT, () => {
  console.log(`[HTTP SERVER] Data API engine safely listening on port :${API_PORT}`);
});