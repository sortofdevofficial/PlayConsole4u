const {
  Client, GatewayIntentBits, ActivityType, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, REST, Routes, SlashCommandBuilder,
  MessageFlags, PermissionFlagsBits, ChannelType, Partials,
  ModalBuilder, TextInputBuilder, TextInputStyle,
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
const TICKET_PANEL     = '1512853476676210758';
const STAFF_ROLE       = '1512857101494517931';
const STATS_MSG        = '1507081827347861607';
const EVENT_MSG        = '1513920811151393091';
const ROLE_PANEL_MSG   = '1514627549949464688';

const VOUCHES_CH       = '1513419177757769920';
const VOUCH_EMOJI      = '1513423932437434449';

const ROLE_ITEMS = {
  role_18plus       : { id: '1515037895738654840', name: '18+',           emoji: '🔞', style: ButtonStyle.Danger },
  role_18minus      : { id: '1515037724371976303', name: '18-',           emoji: '🧸', style: ButtonStyle.Success },
  role_male         : { id: '1515036286753443912', name: 'Male',          emoji: '♂️', style: ButtonStyle.Primary },
  role_female       : { id: '1515036608099909794', name: 'Female',        emoji: '♀️', style: ButtonStyle.Danger },
  role_animal       : { id: '1515037311648403627', name: 'Animal',        emoji: '🐾', style: ButtonStyle.Primary },
  role_other        : { id: '1515037184963645632', name: 'Other',         emoji: '🌀', style: ButtonStyle.Secondary },
  role_gw_ping      : { id: '1514628155237728360', name: 'Giveaway Ping', emoji: '🎁', style: ButtonStyle.Success },
  role_chat_revival : { id: '1513906451557515447', name: 'Chat Revival',  emoji: '✨', style: ButtonStyle.Primary }
};

const GOALS            = { yt: 100, dc: 100 };
const PER_PAGE         = 10;
const WARN_RESET       = 30 * 86400000;
const DRY_CHAT_TIMEOUT = 30 * 60 * 1000;
const MSGS_PER_LVL     = 100;

const LVL_COLORS = ['#5865F2','#2ECC71','#F59E0B','#E91E63','#9B59B6','#E74C3C','#1ABC9C','#3498DB','#FF6B35','#FFD700'];
const EIGHTBALL = ['It is certain.','Without a doubt.','Yes!','Most likely.','Signs point to yes.','Ask again later.','Cannot predict now.',"Don't count on it.",'My reply is no.','Very doubtful.'];
const JOKES     = ["Why do programmers wear glasses? They can't C#!","How do you comfort a JS bug? You console it.","Why did the dev go broke? They used all their cache."];
const DRY_CHAT_LINES = [
  "Damn, this chat is dryer than a Popeyes biscuit 💀 Let's get some words moving!",
  "Chat is dead... somebody call a medic or bring an actual topic 🚑",
  "Hello? Anyone alive here or did Thanos snap this entire channel? 😭",
  "This chat is currently dryer than a desert tumbleweed 🌵 wake up y'all!"
];

// ── DATA STORAGE PERSISTENCE ─────────────────────────────
const load = (f, d = {}) => {
  try { return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d; }
  catch { return d; }
};

const save = (f, d) => {
  try { fs.writeFileSync(f, JSON.stringify(d, null, 2), 'utf8'); }
  catch (e) { console.error(`[DATABASE] Save Failure on ${f}:`, e); }
};

let counts    = load('./counts.json');
let giveaways = load('./giveaways.json');
let warns     = load('./warns.json');

let afk = {};
let tickets = { _counter: 0 };
let levelsEnabled = true;
let levelsMsgEnabled = true;
let lastChatTimestamp = Date.now();

const log = (type, msg) => { console.log(`[${type}] [${new Date().toLocaleTimeString()}] ${msg}`); };

// ── UTILITIES & EMBEDS ───────────────────────────────────
const E = (t, c = '#5865F2') => new EmbedBuilder().setColor(c).setTitle(t).setTimestamp();
const fmt = n => Number(n || 0).toLocaleString();
const getLvl = msgs => Math.floor((msgs || 0) / MSGS_PER_LVL);
const bar = (n, g) => { const x = Math.round(Math.min(g ? n / g : 0, 1) * 10); return '█'.repeat(x) + '░'.repeat(10 - x); };
const pct = (n, g) => Math.round(Math.min(g ? n / g : 0, 1) * 100);
const gch = id => client.channels.fetch(id).catch(() => null);
const hasOwnerRole = m => m?.roles?.cache?.has(OWNER_ROLE) || m?.id === OWNER_ID;

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

const MEDALS = ['👑', '🥈', '🥉'];
const buildLbEmbed = (s, page) => E('🏆 LEADERBOARD')
  .setDescription(s.slice(page * PER_PAGE, (page + 1) * PER_PAGE).map(([id, c], i) => { 
    const r = page * PER_PAGE + i + 1; 
    return `${r <= 3 ? `${MEDALS[r - 1]} **#${r}**` : `\`#${r}\``} <@${id}> — **${fmt(c)}** msgs · Lv.**${getLvl(c)}**`; 
  }).join('\n') || '*No records.*')
  .setFooter({ text: `Page ${page + 1} / ${Math.max(1, Math.ceil(s.length / PER_PAGE))}` });

const buildLbBtns = (page, total) => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('lb_prev').setLabel('◀').setStyle(ButtonStyle.Primary).setDisabled(page === 0),
  new ButtonBuilder().setCustomId('lb_page').setLabel(`${page + 1}/${total}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
  new ButtonBuilder().setCustomId('lb_next').setLabel('▶').setStyle(ButtonStyle.Primary).setDisabled(page === total - 1)
);

function buildGwEmbed(gw) {
  const ended = !!gw.ended, p = gw.participants || [];
  const winText = ended ? (gw.winnerIds?.length ? gw.winnerIds.map(id => `<@${id}>`).join(', ') : '*No valid entries*') : `**${gw.winners}** winner(s)`;
  return new EmbedBuilder().setColor(ended ? '#2ECC71' : gw.color || '#F1C40F')
    .setTitle(ended ? '🏁 GIVEAWAY ENDED' : '🎉 GIVEAWAY')
    .setDescription(`### 🎁 ${gw.prize}\n\n> 👑 **Host:** <@${gw.hostId}>\n> 🏆 **Winners:** ${winText}\n> 👥 **Entries:** \`${p.length}\``);
}

const validGw = (gw, mem) => {
  if (!mem) return false;
  if (gw.blacklistRole && mem.roles.cache.has(gw.blacklistRole)) return false;
  if (gw.reqRole && !mem.roles.cache.has(gw.reqRole)) return false;
  if (gw.reqMsgs > 0 && (counts[mem.id] || 0) < gw.reqMsgs) return false;
  return true;
};

// ── AUTOMATED SYSTEMS ────────────────────────────────────
async function endGiveaway(mid) {
  const gw = giveaways[mid]; if (!gw || gw.ended) return false;
  const guild = await client.guilds.fetch(gw.guildId).catch(() => null);
  const ch = await client.channels.fetch(gw.channelId).catch(() => null);
  if (!guild || !ch) return false;

  const valid = [];
  for (const uid of gw.participants || []) { const m = await guild.members.fetch(uid).catch(() => null); if (validGw(gw, m)) valid.push(uid); }
  const winners = valid.sort(() => Math.random() - .5).slice(0, gw.winners);
  
  gw.ended = true; gw.winnerIds = winners;
  const msg = await ch.messages.fetch(mid).catch(() => null);
  if (msg) await msg.edit({ embeds: [buildGwEmbed(gw)], components: [] }).catch(() => {});
  
  await ch.send({ content: winners.length ? `🎊 Congrats ${winners.map(id => `<@${id}>`).join(', ')}! You won **${gw.prize}**!` : `🏁 Giveaway for **${gw.prize}** ended with no valid entries.` }).catch(() => {});
  save('./giveaways.json', giveaways);
  return true;
}

async function createTicket(guild, user, reason) {
  tickets._counter = (tickets._counter || 0) + 1;
  const num = tickets._counter;
  
  const ch = await guild.channels.create({
    name: `ticket-${user.username.slice(0, 10)}-${num}`, type: ChannelType.GuildText, parent: TICKET_CAT,
    permissionOverwrites: [
      { id: guild.id, deny: ['ViewChannel'] },
      { id: user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles'] },
      { id: STAFF_ROLE, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages'] }
    ],
    topic: `Ticket Owner: ${user.id} | Opened by ${user.tag} | Reason: ${reason} | Number: ${num}`
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_close').setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim').setEmoji('✋').setStyle(ButtonStyle.Secondary)
  );

  await ch.send({ content: `<@${user.id}> | <@&${STAFF_ROLE}>`, embeds: [E(`🎫 Welcome to Ticket #${num}`).setDescription(`Hello ${user}, please state your issue clearly.\n\n💀 *Creating fake tickets will result in an immediate ban.*`)], components: [row] });
  return { ok: true, channel: ch };
}

async function closeTicket(ch, closedBy, guild) {
  const topic = ch.topic || '';
  const match = topic.match(/Ticket Owner:\s*(\d+)/);
  const userId = match ? match[1] : null;
  const ticketNum = topic.match(/Number:\s*(\d+)/)?.[1] || '?';

  const msgs = await ch.messages.fetch({ limit: 100 }).catch(() => null);
  const transcript = msgs ? [...msgs.values()].reverse().map(m => `[${new Date(m.createdTimestamp).toUTCString()}] ${m.author.tag}: ${m.content}`).join('\n') : '';
  const logCh = await guild.channels.fetch(TICKET_LOG).catch(() => null);

  if (logCh) {
    await logCh.send({
      embeds: [E(`📋 Ticket #${ticketNum} Terminated`).addFields({ name: 'Owner', value: userId ? `<@${userId}>` : 'Unknown', inline: true }, { name: 'Closed By', value: `<@${closedBy.id}>`, inline: true })],
      files: [{ attachment: Buffer.from(transcript, 'utf8'), name: `transcript-ticket-${ticketNum}.txt` }]
    }).catch(() => {});
  }

  await ch.send({ content: '💀 Deleting channel room in 5 seconds...' });
  setTimeout(() => ch.delete().catch(() => {}), 5000);
}

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

// ── DISCORD BOT GATEWAY CLIENT ───────────────────────────
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessageReactions],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

client.once('ready', async () => {
  log('SYS', `Logged into Discord Network as ${client.user.tag}`);
  client.user.setActivity('!cmds | Engine Control', { type: ActivityType.Watching });

  // Deploy Slash Commands Infrastructure
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    const cmds = [
      new SlashCommandBuilder().setName('ping').setDescription('Check latency status specs'),
      new SlashCommandBuilder().setName('purge').setDescription('Bulk delete safety margins').addIntegerOption(o => o.setName('amount').setDescription('Count').setRequired(true)),
      new SlashCommandBuilder().setName('rank').setDescription('Check profile rank cards').addUserOption(o => o.setName('target').setDescription('User')),
      new SlashCommandBuilder().setName('leaderboard').setDescription('Display ranking list data')
    ];
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: cmds });
  } catch (err) { log('ERR', 'Failed registering slash commands: ' + err.message); }

  setInterval(updateStatsEmbed, 300000);
  setInterval(() => { save('./counts.json', counts); }, 30000);

  setInterval(async () => {
    if (Date.now() - lastChatTimestamp >= DRY_CHAT_TIMEOUT) {
      const dryCh = await gch(TARGET_CHAT_ID);
      if (dryCh) { dryCh.send({ content: DRY_CHAT_LINES[Math.floor(Math.random() * DRY_CHAT_LINES.length)] }).catch(() => {}); lastChatTimestamp = Date.now(); }
    }
  }, 60000);
});

// ── TEXT CHAT PREFIX COMMAND ENGINE ──────────────────────
client.on('messageCreate', async msg => {
  if (msg.author.bot || !msg.guild) return;

  if (msg.channel.id === VOUCHES_CH) { await msg.react(VOUCH_EMOJI).catch(() => {}); }
  if (msg.channel.id === TARGET_CHAT_ID) { lastChatTimestamp = Date.now(); }

  const content = msg.content.trim();
  const isPrefixed = /^[?!-]/.test(content);

  // Level Tracking Pipeline
  if (levelsEnabled && !isPrefixed && content.length > 0) {
    const next = (counts[msg.author.id] || 0) + 1;
    counts[msg.author.id] = next;

    if (next % MSGS_PER_LVL === 0) {
      const currentLvl = Math.floor(next / MSGS_PER_LVL);
      if (levelsMsgEnabled) {
        const lvlCh = await gch(LEVEL_CH);
        if (lvlCh) { await lvlCh.send({ embeds: [buildLvlEmbed(msg.author, currentLvl, next)] }).catch(() => {}); }
      }
    }
  }

  if (!isPrefixed) return;
  const args = content.slice(1).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  // Prefix Command Logic Block
  if (command === 'ping') return msg.reply(`🏓 Latency Matrix: \`${client.ws.ping}ms\``);
  if (command === '8ball') return msg.reply(`🎱 ${EIGHTBALL[Math.floor(Math.random() * EIGHTBALL.length)]}`);
  if (command === 'joke') return msg.reply(`😂 ${JOKES[Math.floor(Math.random() * JOKES.length)]}`);
  if (command === 'cmds') return msg.reply('📋 **Available Commands:** `!ping`, `!8ball`, `!joke`, `!lb`, `/purge`, `/rank`');
  if (command === 'lb' || command === 'leaderboard') {
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return msg.reply({ embeds: [buildLbEmbed(sorted, 0)], components: [buildLbBtns(0, Math.max(1, Math.ceil(sorted.length / PER_PAGE)))] });
  }
});

// ── SLASH INTERACTION ROUTERS & BUTTON CHANNELS ──────────
client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'ping') {
        return interaction.reply({ content: `🏓 Latency is \`${client.ws.ping}ms\``, flags: MessageFlags.Ephemeral });
      }
      if (interaction.commandName === 'leaderboard') {
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        return interaction.reply({ embeds: [buildLbEmbed(sorted, 0)], components: [buildLbBtns(0, Math.max(1, Math.ceil(sorted.length / PER_PAGE)))] });
      }
      if (interaction.commandName === 'purge') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) return interaction.reply({ content: '❌ Missing permissions.', flags: MessageFlags.Ephemeral });
        const amt = interaction.options.getInteger('amount');
        await interaction.channel.bulkDelete(Math.min(amt, 100), true);
        return interaction.reply({ content: `🧹 Deleted up to ${amt} messages.`, flags: MessageFlags.Ephemeral });
      }
      if (interaction.commandName === 'rank') {
        const target = interaction.options.getUser('target') || interaction.user;
        const msgs = counts[target.id] || 0;
        return interaction.reply({ embeds: [E(`👤 Profiler Card: ${target.username}`).addFields({ name: 'Level', value: `${getLvl(msgs)}`, inline: true }, { name: 'Messages', value: `${msgs}`, inline: true })] });
      }
    }

    if (interaction.isButton()) {
      // Leaderboard Pages Router
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

      // Tickets Pipeline Logic
      if (interaction.customId === 'ticket_close') { 
        await interaction.deferReply(); 
        await closeTicket(interaction.channel, interaction.user, interaction.guild); 
      }
      if (interaction.customId === 'ticket_claim') {
        if (!interaction.member.roles.cache.has(STAFF_ROLE)) return interaction.reply({ content: '❌ Only staff can claim tickets.', flags: MessageFlags.Ephemeral });
        await interaction.reply({ content: `✋ <@${interaction.user.id}> has claimed this ticket support line.` });
      }

      // Role Panel Toggles
      if (interaction.customId.startsWith('role_')) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const item = ROLE_ITEMS[interaction.customId];
        if (!item) return interaction.editReply('❌ Role template missing.');
        const role = interaction.guild.roles.cache.get(item.id);
        if (!role) return interaction.editReply('❌ Role file not configured on server.');
        
        if (interaction.member.roles.cache.has(role.id)) {
          await interaction.member.roles.remove(role);
          await interaction.editReply(`➖ Removed role: **${item.name}**`);
        } else {
          await interaction.member.roles.add(role);
          await interaction.editReply(`➕ Added role: **${item.name}**`);
        }
      }
    }
  } catch (err) { console.error('[INTERACTION SYSTEM EXCEPTION]', err); }
});

if (TOKEN) { client.login(TOKEN); } else { console.error('[CRITICAL ERROR] Bot Token key missing inside execution targets.'); }

// ── INTEGRATED HTTP TELEMETRY WEBSERVER ──────────────────
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = url.pathname;

  // Root Favicon serving logic
  if (p === '/favicon.png' || p === '/favicon.ico') {
    const faviconPath = path.join(__dirname, 'favicon.png');
    if (fs.existsSync(faviconPath)) {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      return res.end(fs.readFileSync(faviconPath));
    }
    res.writeHead(404); return res.end();
  }

  // CORS Access Headers configurations
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(200); return res.end(); }

  const authKey = url.searchParams.get('key') || req.headers['authorization'];
  if (authKey !== API_KEY) {
    res.writeHead(401);
    return res.end(JSON.stringify({ error: 'Unauthorized credentials verification token mismatch.' }));
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
    if (!uid) { res.writeHead(400); return res.end(JSON.stringify({ error: 'Missing target client lookup identification.' })); }
    
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
  return res.end(JSON.stringify({ error: 'Route endpoint context not found.' }));
});

server.listen(API_PORT, () => {
  console.log(`[DATA ENGINE SERVER] API streaming dashboard safely listening on port :${API_PORT}`);
});