const { Client, GatewayIntentBits, ActivityType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, REST, Routes, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');

// ── CONFIG ───────────────────────────────────────────────
const TOKEN     = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_GUILD_ID;
const STATS_CH  = '1505204180674019520';
const LINKS_CH  = '1504104519749992559';
const SYS_CH    = '1505111889850404864';
const ROLE_ID   = '1505120185088999444';
const YT_KEY    = process.env.YOUTUBE_API_KEY;
const YT_ID     = process.env.YOUTUBE_CHANNEL_ID;
const GOALS     = { yt: 25, dc: 50 };

// ── SETUP ────────────────────────────────────────────────
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });
const load = f => fs.existsSync(f) ? JSON.parse(fs.readFileSync(f,'utf8')) : {};
const save = (f,d) => fs.writeFileSync(f, JSON.stringify(d,null,2));
let afk = load('./afk.json'), msgs = load('./msgs.json');

// ── UTILS ────────────────────────────────────────────────
const bar     = (n,g) => { const f=Math.round(Math.min(n/g,1)*12); return `${'█'.repeat(f)}${'░'.repeat(12-f)}`; };
const pct     = (n,g) => Math.round(Math.min(n/g,1)*100);
const fmt     = n => n!=null ? Number(n).toLocaleString() : 'N/A';
const ago     = ts => { const s=Math.floor((Date.now()-ts)/1000); return s<60?`${s}s`:s<3600?`${Math.floor(s/60)}m`:s<86400?`${Math.floor(s/3600)}h`:`${Math.floor(s/86400)}d`; };
const fetchCh = id => client.channels.fetch(id).catch(()=>null);
const embed   = (color,title) => new EmbedBuilder().setColor(color).setTitle(title).setTimestamp().setFooter({text:'⚡ Engine Grid'});
const diff    = txt => `\`\`\`diff\n${txt}\n\`\`\``;
const fix     = txt => `\`\`\`fix\n${txt}\n\`\`\``;
const ini     = txt => `\`\`\`ini\n${txt}\n\`\`\``;
const btn     = (l,u) => new ButtonBuilder().setLabel(l).setURL(u).setStyle(ButtonStyle.Link);
const row     = (...btns) => new ActionRowBuilder().addComponents(...btns);

const saveMsg = async (ch, file, payload) => {
    const id  = fs.existsSync(file) ? fs.readFileSync(file,'utf8').trim() : '';
    const msg = id ? await ch.messages.fetch(id).catch(()=>null) : null;
    if (msg) await msg.edit(payload);
    else { const m = await ch.send(payload); fs.writeFileSync(file, m.id); }
};

// ── FETCHERS ─────────────────────────────────────────────
const getYT = async () => {
    const d = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${YT_ID}&key=${YT_KEY}`).then(r=>r.json()).catch(()=>null);
    return d?.items?.[0] ? parseInt(d.items[0].statistics.subscriberCount) : null;
};

// ── STATS ────────────────────────────────────────────────
async function updateStats() {
    const [yt, ch] = await Promise.all([getYT(), fetchCh(STATS_CH)]);
    if (!ch) return;
    const dc = ch.guild.memberCount;
    const e = embed('#5865F2','📡  𝗟𝗜𝗩𝗘  𝗡𝗘𝗧𝗪𝗢𝗥𝗞  𝗖𝗢𝗨𝗡𝗧')
        .setDescription(diff('+ ENGINE GRID ONLINE — all systems operational'))
        .addFields(
            { name: fix(' 📺 YOUTUBE '), value: diff(`+ Count : ${fmt(yt)}\n+ Goal  : ${GOALS.yt}\n+ Gap   : ${Math.max(0,GOALS.yt-(yt??0))}`) + ini(`[ ${bar(yt??0,GOALS.yt)} ] ${pct(yt??0,GOALS.yt)}%`), inline: false },
            { name: fix(' 👥 DISCORD '), value: diff(`+ Count : ${fmt(dc)}\n+ Goal  : ${GOALS.dc}\n+ Gap   : ${Math.max(0,GOALS.dc-dc)}`)        + ini(`[ ${bar(dc,GOALS.dc)} ] ${pct(dc,GOALS.dc)}%`),    inline: false }
        );
    await saveMsg(ch, './msgId.txt', { embeds:[e] });
}

// ── LINKS ────────────────────────────────────────────────
async function updateLinks() {
    const ch = await fetchCh(LINKS_CH);
    if (!ch) return;
    const e = embed('#5865F2','🌐  𝗘𝗡𝗚𝗜𝗡𝗘  𝗚𝗥𝗜𝗗  —  𝗔𝗟𝗟  𝗟𝗜𝗡𝗞𝗦')
        .setDescription(
            diff('+ 🎮 PLAYCONSOLE4U — lag-free browser gaming\n+ 📺 YOUTUBE       — dev drops & tutorials\n+ 💬 DISCORD       — community hub\n+ ⭐ DISBOARD      — bump & review us') +
            fix('  👤 SOCIALS  — Reddit · Twitter/X · Instagram\n  📘 FACEBOOK — Personal · Official Page')
        );
    await saveMsg(ch, './linksId.txt', {
        embeds: [e],
        components: [
            row(btn('🎮 Play Now','https://sortofdevofficial.github.io/PlayConsole4u'), btn('📺 YouTube','https://www.youtube.com/@sortofdev0'), btn('💬 Discord','https://discord.gg/dS4pgC9J5H'), btn('⭐ Disboard','https://disboard.org/server/1503297362246897694')),
            row(btn('🟠 Reddit','https://www.reddit.com/user/DisplayNo9869/'), btn('🔴 r/sortofdev','https://www.reddit.com/r/sortofdev/'), btn('🐦 Twitter/X','https://x.com/sortofdev'), btn('📸 Instagram','https://www.instagram.com/sortofdev0/')),
            row(btn('📘 FB Profile','https://www.facebook.com/profile.php?id=61590314788644'), btn('📘 FB Page','https://www.facebook.com/profile.php?id=61590356186955'))
        ]
    });
}

// ── ROLE SYNC ─────────────────────────────────────────────
async function syncRoles() {
    for (const [,g] of await client.guilds.fetch()) {
        const guild = await g.fetch();
        const role  = await guild.roles.fetch(ROLE_ID).catch(()=>null);
        if (!role) continue;
        const members = await guild.members.fetch();
        for (const [,m] of members.filter(m=>!m.roles.cache.has(ROLE_ID)&&!m.user.bot))
            await m.roles.add(role).catch(()=>{});
    }
}

// ── SLASH COMMANDS ────────────────────────────────────────
const cmds = [
    new SlashCommandBuilder().setName('ping').setDescription('Bot latency'),
    new SlashCommandBuilder().setName('stats').setDescription('Live YouTube & Discord stats'),
    new SlashCommandBuilder().setName('forceupdate').setDescription('Force refresh embeds'),
    new SlashCommandBuilder().setName('commands').setDescription('All commands list'),
    new SlashCommandBuilder().setName('serverinfo').setDescription('Server info'),
    new SlashCommandBuilder().setName('userinfo').setDescription('User info').addUserOption(o=>o.setName('user').setDescription('Target').setRequired(false)),
    new SlashCommandBuilder().setName('avatar').setDescription('Get avatar').addUserOption(o=>o.setName('user').setDescription('Target').setRequired(false)),
    new SlashCommandBuilder().setName('messages').setDescription('Message count').addUserOption(o=>o.setName('user').setDescription('Target').setRequired(false)),
    new SlashCommandBuilder().setName('leaderboard').setDescription('Top chatters'),
    new SlashCommandBuilder().setName('afk').setDescription('Set AFK').addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(false)),
].map(c=>c.toJSON());

// ── BOOT ──────────────────────────────────────────────────
client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} online`);
    await new REST({version:'10'}).setToken(TOKEN).put(Routes.applicationCommands(CLIENT_ID), {body:cmds});
    console.log('✅ Slash commands registered');

    let i=0;
    setInterval(()=>client.user.setActivity([
        {name:'Milestone Goals 🎯',type:ActivityType.Watching},
        {name:`${client.guilds.cache.reduce((a,g)=>a+g.memberCount,0)} Devs 💻`,type:ActivityType.Custom},
        {name:'/commands for help',type:ActivityType.Playing}
    ][i++%3]),15000);

    await Promise.all([syncRoles(), updateStats(), updateLinks()]);
    setInterval(updateStats, 10*60*1000);
    setInterval(syncRoles,    5*60*1000);
    setInterval(updateLinks, 60*60*1000);
});

// ── MEMBER EVENTS ─────────────────────────────────────────
client.on('guildMemberAdd', async m => {
    if (m.user.bot) return;
    const role = await m.guild.roles.fetch(ROLE_ID).catch(()=>null);
    if (role) await m.roles.add(role).catch(()=>{});
    const ch = await fetchCh(SYS_CH);
    if (ch) await ch.send({ embeds:[embed('#2ECC71','```diff\n+ NEW MEMBER\n```')
        .setDescription(`> ✅ Welcome ${m}! You're member **#${m.guild.memberCount}**. Lock in. 🚀`)
        .addFields({name:fix(' Tag '),value:`\`\`\`\n${m.user.tag}\n\`\`\``,inline:true},{name:fix(' ID '),value:`\`\`\`\n${m.id}\n\`\`\``,inline:true})
        .setThumbnail(m.user.displayAvatarURL({size:256})).setFooter({text:`Members: ${m.guild.memberCount}`})] });
    await updateStats();
});

client.on('guildMemberRemove', async m => {
    const ch = await fetchCh(SYS_CH);
    if (ch) await ch.send({ embeds:[embed('#E74C3C','```diff\n- MEMBER LEFT\n```')
        .setDescription(`> ❌ **${m.user.tag}** left the grid. 🫡`)
        .addFields({name:fix(' Tag '),value:`\`\`\`\n${m.user.tag}\n\`\`\``,inline:true},{name:fix(' ID '),value:`\`\`\`\n${m.id}\n\`\`\``,inline:true})
        .setThumbnail(m.user.displayAvatarURL({size:256})).setFooter({text:`Members: ${m.guild.memberCount}`})] });
    await updateStats();
});

client.on('guildMemberUpdate', async (o,n) => {
    if (o.premiumSince||!n.premiumSince) return;
    const ch = await fetchCh(SYS_CH);
    if (ch) await ch.send({ embeds:[embed('#E91E63',fix(' 💎 SERVER BOOSTED '))
        .setDescription(`> 🚀 ${n} just boosted! 👑\n`+diff(`+ Tier   : ${n.guild.premiumTier}\n+ Boosts : ${n.guild.premiumSubscriptionCount}`))] });
});

// ── MESSAGE TRACKER + AFK ─────────────────────────────────
client.on('messageCreate', async msg => {
    if (msg.author.bot || !msg.guild) return;
    const key = `${msg.guild.id}-${msg.author.id}`;

    // AFK return
    if (afk[key]) {
        delete afk[key]; save('./afk.json', afk);
        const r = await msg.reply(diff('+ Welcome back! AFK removed.')).catch(()=>null);
        if (r) setTimeout(()=>r.delete().catch(()=>{}), 4000);
    }

    // Ping AFK check
    for (const [,u] of msg.mentions.users) {
        const k = `${msg.guild.id}-${u.id}`;
        if (afk[k]) await msg.reply(fix(` 💤 ${u.tag} is AFK`) + diff(`+ Reason : ${afk[k].reason}\n+ Since  : ${ago(afk[k].since)} ago`)).catch(()=>{});
    }

    // Count
    msgs[key] = (msgs[key]||0)+1;
    if (msgs[key]%50===0) save('./msgs.json', msgs);
});

// ── INTERACTIONS ──────────────────────────────────────────
client.on('interactionCreate', async i => {
    if (!i.isChatInputCommand()) return;
    const { commandName: cmd } = i;

    if (cmd==='ping') {
        await i.reply(fix(' Pinging... '));
        return i.editReply(diff(`+ Pong!\n+ Bot : ${Date.now()-i.createdTimestamp}ms\n+ API : ${Math.round(client.ws.ping)}ms`));
    }

    if (cmd==='stats') {
        await i.deferReply();
        const yt = await getYT(); const dc = i.guild?.memberCount;
        return i.editReply(diff(`+ YouTube : ${fmt(yt)} subs\n+ Discord : ${fmt(dc)} members`)+ini(`[ YT: ${bar(yt??0,GOALS.yt)} ] ${pct(yt??0,GOALS.yt)}%\n[ DC: ${bar(dc??0,GOALS.dc)} ] ${pct(dc??0,GOALS.dc)}%`));
    }

    if (cmd==='forceupdate') {
        await i.deferReply({ephemeral:true});
        await Promise.all([updateStats(),updateLinks()]);
        return i.editReply(diff('+ Force refreshed!'));
    }

    if (cmd==='commands') {
        return i.reply({ embeds:[embed('#5865F2','⚡  𝗔𝗟𝗟  𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦')
            .addFields(
                {name:fix(' 📊 INFO '),     value:diff('+ /ping\n+ /stats\n+ /serverinfo\n+ /userinfo\n+ /avatar\n+ /messages\n+ /leaderboard'),inline:true},
                {name:fix(' 💤 AFK '),      value:diff('+ /afk [reason]'),inline:true},
                {name:fix(' 🔧 ADMIN '),    value:diff('+ /forceupdate'),inline:true}
            )] });
    }

    if (cmd==='serverinfo') {
        const g = i.guild;
        return i.reply({ embeds:[embed('#5865F2',fix(' 🌐 SERVER INFO '))
            .setThumbnail(g.iconURL({size:512}))
            .addFields(
                {name:fix(' Name '),    value:`\`\`\`\n${g.name}\n\`\`\``,inline:true},
                {name:fix(' Members '), value:diff(`+ ${g.memberCount}`),inline:true},
                {name:fix(' Boost '),   value:ini(`[ Tier ${g.premiumTier} — ${g.premiumSubscriptionCount} boosts ]`),inline:true},
                {name:fix(' Owner '),   value:`<@${g.ownerId}>`,inline:true},
                {name:fix(' Created '), value:`<t:${Math.floor(g.createdTimestamp/1000)}:R>`,inline:true}
            )] });
    }

    if (cmd==='userinfo') {
        const t = i.options.getMember('user')||i.member;
        const k = `${i.guild.id}-${t.id}`;
        return i.reply({ embeds:[embed('#5865F2',fix(' 👤 USER INFO '))
            .setThumbnail(t.user.displayAvatarURL({size:256}))
            .addFields(
                {name:fix(' Tag '),      value:`\`\`\`\n${t.user.tag}\n\`\`\``,inline:true},
                {name:fix(' ID '),       value:`\`\`\`\n${t.id}\n\`\`\``,inline:true},
                {name:fix(' Messages '), value:diff(`+ ${fmt(msgs[k]??0)}`),inline:true},
                {name:fix(' Joined '),   value:`<t:${Math.floor(t.joinedTimestamp/1000)}:R>`,inline:true},
                {name:fix(' Created '),  value:`<t:${Math.floor(t.user.createdTimestamp/1000)}:R>`,inline:true},
                {name:fix(' Roles '),    value:t.roles.cache.filter(r=>r.id!==i.guild.id).map(r=>`<@&${r.id}>`).join(' ')||'None',inline:false}
            )] });
    }

    if (cmd==='avatar') {
        const t = i.options.getUser('user')||i.user;
        return i.reply({ embeds:[embed('#5865F2',fix(` 🖼️ ${t.tag}'s Avatar `)).setImage(t.displayAvatarURL({size:512,forceStatic:false}))] });
    }

    if (cmd==='messages') {
        const t = i.options.getUser('user')||i.user;
        const k = `${i.guild.id}-${t.id}`;
        return i.reply({ embeds:[embed('#5865F2',fix(' 💬 MESSAGE COUNT '))
            .setThumbnail(t.displayAvatarURL({size:256}))
            .addFields({name:fix(` ${t.tag} `),value:diff(`+ ${fmt(msgs[k]??0)} messages sent`),inline:false})] });
    }

    if (cmd==='leaderboard') {
        const top = Object.entries(msgs).filter(([k])=>k.startsWith(i.guild.id)).map(([k,v])=>({id:k.split('-')[1],v})).sort((a,b)=>b.v-a.v).slice(0,10);
        const medals = ['🥇','🥈','🥉'];
        return i.reply({ embeds:[embed('#5865F2',fix(' 🏆 LEADERBOARD '))
            .setDescription(top.length ? top.map((e,idx)=>`${medals[idx]||`\`#${idx+1}\``} <@${e.id}> — **${fmt(e.v)}** messages`).join('\n') : 'No data yet.')] });
    }

    if (cmd==='afk') {
        const reason = i.options.getString('reason')||'No reason given';
        afk[`${i.guild.id}-${i.user.id}`] = { reason, since:Date.now() };
        save('./afk.json', afk);
        return i.reply(diff(`+ AFK set!\n+ Reason : ${reason}\n+ Auto-removed when you send a message.`));
    }
});

client.login(TOKEN);