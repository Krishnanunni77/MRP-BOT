const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder
} = require('discord.js');

const config = require('../config');

// ─── In-Memory Storage (replace with DB for persistence) ───────────────────
// Structure: { userId: { birthday: 'DD-MM', year: 'YYYY', registeredAt: Date } }
const birthdayRegistry = new Map();

// Structure: { code: { ownerId, uses: [], createdAt } }
const referralCodes = new Map();

// Structure: { userId: referralCode } — who was referred by whom
const referralUses = new Map();

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateCode(userId) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'MRP-';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

function formatDate(dd, mm) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${dd} ${months[parseInt(mm) - 1]}`;
}

function isTodayBirthday(birthday) {
    const [dd, mm] = birthday.split('-');
    const now = new Date();
    return parseInt(dd) === now.getDate() && parseInt(mm) === (now.getMonth() + 1);
}

// ─── Setup: Post user-facing buttons in people channels ─────────────────────

async function setupBirthdayReferralPanels(guild) {

    // ── Birthday Registration Channel ──
    const bdayChannel = await guild.channels.fetch(config.BIRTHDAY_CHANNEL_ID).catch(() => null);
    if (bdayChannel) {
        const msgs = await bdayChannel.messages.fetch({ limit: 30 }).catch(() => null);
        const exists = msgs?.some(m => m.components?.some(r => r.components?.some(b => b.customId === 'birthday_register')));

        if (!exists) {
            const embed = new EmbedBuilder()
                .setColor('#FF69B4')
                .setTitle('🎂 Birthday Registration')
                .setDescription(
                    `Register your birthday and get a special gift from the admin on your big day!\n\n` +
                    `**How it works:**\n` +
                    `🎁 Register your birthday below\n` +
                    `📋 Admin will review your registration\n` +
                    `🎉 On your birthday, admin gets notified and rewards you!\n\n` +
                    `> You can only register once. Make sure your date is correct.`
                )
                .setFooter({ text: 'MANGALASHERY ROLEPLAY | Birthday System' })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('birthday_register')
                    .setLabel('🎂 Register Birthday')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('birthday_view')
                    .setLabel('📅 View My Birthday')
                    .setStyle(ButtonStyle.Secondary)
            );

            await bdayChannel.send({ embeds: [embed], components: [row] });
        }
    }

    // ── Referral Channel ──
    const refChannel = await guild.channels.fetch(config.REFERRAL_CHANNEL_ID).catch(() => null);
    if (refChannel) {
        const msgs = await refChannel.messages.fetch({ limit: 30 }).catch(() => null);
        const exists = msgs?.some(m => m.components?.some(r => r.components?.some(b => b.customId === 'referral_generate')));

        if (!exists) {
            const embed = new EmbedBuilder()
                .setColor('#00CED1')
                .setTitle('🔗 Referral System')
                .setDescription(
                    `Invite your friends and earn rewards!\n\n` +
                    `**How it works:**\n` +
                    `🔑 Generate your unique referral code\n` +
                    `📤 Share it with friends\n` +
                    `✅ When they use your code, admin gets notified\n` +
                    `🏆 Earn rewards for every successful referral!\n\n` +
                    `> Each person gets one referral code. Share wisely!`
                )
                .setFooter({ text: 'MANGALASHERY ROLEPLAY | Referral System' })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('referral_generate')
                    .setLabel('🔑 Get My Code')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('referral_use')
                    .setLabel('✅ Use a Code')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('referral_stats')
                    .setLabel('📊 My Stats')
                    .setStyle(ButtonStyle.Secondary)
            );

            await refChannel.send({ embeds: [embed], components: [row] });
        }
    }
}

// ─── Birthday Check Loop (runs every hour) ──────────────────────────────────

function startBirthdayChecker(client) {
    const check = async () => {
        try {
            const guild = await client.guilds.fetch(config.GUILD_ID).catch(() => null);
            if (!guild) return;

            const adminChannel = await guild.channels.fetch(config.BIRTHDAY_ADMIN_CHANNEL_ID).catch(() => null);
            if (!adminChannel) return;

            for (const [userId, data] of birthdayRegistry.entries()) {
                if (!data.approved) continue;
                if (data.notifiedToday) continue;
                if (!isTodayBirthday(data.birthday)) continue;

                const member = await guild.members.fetch(userId).catch(() => null);
                if (!member) continue;

                const embed = new EmbedBuilder()
                    .setColor('#FFD700')
                    .setTitle('🎉 Birthday Alert!')
                    .setDescription(
                        `**${member.displayName}** (<@${userId}>) has a birthday today!\n\n` +
                        `🎂 **Date:** ${formatDate(...data.birthday.split('-'))}\n` +
                        `📅 **Registered on:** <t:${Math.floor(new Date(data.registeredAt).getTime() / 1000)}:D>\n\n` +
                        `Please give them a birthday gift! 🎁`
                    )
                    .setThumbnail(member.user.displayAvatarURL())
                    .setFooter({ text: 'MRP Birthday System' })
                    .setTimestamp();

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`bday_gifted_${userId}`)
                        .setLabel('✅ Gift Given')
                        .setStyle(ButtonStyle.Success)
                );

                await adminChannel.send({ embeds: [embed], components: [row] });

                // Mark as notified today (reset next day)
                birthdayRegistry.set(userId, { ...data, notifiedToday: true });

                // 🎉 Announce in GENERAL channel with full MRP team wish
                const generalChannel = await guild.channels.fetch(config.BROADCAST_CHANNELS.ɢᴇɴᴇʀᴀʟ).catch(() => null);
                if (generalChannel) {
                    const [dd, mm] = data.birthday.split('-');
                    const wishEmbed = new EmbedBuilder()
                        .setColor('#FFD700')
                        .setTitle('🎂 Happy Birthday! 🎉')
                        .setDescription(
                            `╔══════════════════════════╗\n` +
                            `🎊  **BIRTHDAY WISHES**  🎊\n` +
                            `╚══════════════════════════╝\n\n` +
                            `Hey <@${userId}> 🎂\n\n` +
                            `**The entire MRP Team is wishing you a very\n` +
                            `Happy Birthday! 🥳🎉**\n\n` +
                            `🌟 May this year bring you unlimited fun,\n` +
                            `adventures, and epic RP moments in the city! 🚗🔥\n\n` +
                            `From all of us at **MANGALASHERY ROLEPLAY** —\n` +
                            `we're glad to have you in our community! ❤️\n\n` +
                            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                            `🎂 **Date:** ${formatDate(dd, mm)}\n` +
                            `🏙️ **Server:** MANGALASHERY ROLEPLAY\n` +
                            `━━━━━━━━━━━━━━━━━━━━━━━━━━`
                        )
                        .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
                        .setImage('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdWJ5aGF5a2kxMm95M2JpNnB4NTljenZweHpjenJ3aGYwNGI3cmtjayZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/g5R9dok94mrIvplmZd/giphy.gif')
                        .setFooter({ text: '🎉 MRP Team | MANGALASHERY ROLEPLAY', iconURL: member.guild.iconURL() })
                        .setTimestamp();

                    await generalChannel.send({
                        content: `@everyone 🎂 Today is <@${userId}>'s Birthday! Let's celebrate! 🥳`,
                        embeds: [wishEmbed]
                    });
                }
            }

            // Reset notifiedToday at midnight
            const now = new Date();
            if (now.getHours() === 0 && now.getMinutes() < 5) {
                for (const [userId, data] of birthdayRegistry.entries()) {
                    if (data.notifiedToday) {
                        birthdayRegistry.set(userId, { ...data, notifiedToday: false });
                    }
                }
            }
        } catch (err) {
            console.error('Birthday checker error:', err);
        }
    };

    // Run immediately then every hour
    check();
    setInterval(check, 60 * 60 * 1000);
}

// ─── Main Interaction Handler ────────────────────────────────────────────────

module.exports = async (interaction, client) => {

    // ── BIRTHDAY REGISTER BUTTON ──
    if (interaction.isButton() && interaction.customId === 'birthday_register') {
        if (birthdayRegistry.has(interaction.user.id)) {
            return interaction.reply({
                content: '❌ You have already registered your birthday!',
                ephemeral: true
            });
        }

        const modal = new ModalBuilder()
            .setCustomId('birthday_modal')
            .setTitle('🎂 Birthday Registration');

        const dayInput = new TextInputBuilder()
            .setCustomId('bday_day')
            .setLabel('Day (01-31)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g. 15')
            .setMinLength(1)
            .setMaxLength(2)
            .setRequired(true);

        const monthInput = new TextInputBuilder()
            .setCustomId('bday_month')
            .setLabel('Month (01-12)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g. 08')
            .setMinLength(1)
            .setMaxLength(2)
            .setRequired(true);

        const yearInput = new TextInputBuilder()
            .setCustomId('bday_year')
            .setLabel('Year of Birth (optional, for age)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g. 2000')
            .setMinLength(4)
            .setMaxLength(4)
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder().addComponents(dayInput),
            new ActionRowBuilder().addComponents(monthInput),
            new ActionRowBuilder().addComponents(yearInput)
        );

        return interaction.showModal(modal);
    }

    // ── BIRTHDAY MODAL SUBMIT ──
    if (interaction.isModalSubmit() && interaction.customId === 'birthday_modal') {
        const day = interaction.fields.getTextInputValue('bday_day').padStart(2, '0');
        const month = interaction.fields.getTextInputValue('bday_month').padStart(2, '0');
        const year = interaction.fields.getTextInputValue('bday_year') || null;

        const dd = parseInt(day), mm = parseInt(month);
        if (isNaN(dd) || isNaN(mm) || dd < 1 || dd > 31 || mm < 1 || mm > 12) {
            return interaction.reply({ content: '❌ Invalid date! Please enter a valid day (01-31) and month (01-12).', ephemeral: true });
        }

        const birthday = `${day}-${month}`;

        birthdayRegistry.set(interaction.user.id, {
            birthday,
            year,
            approved: false,
            notifiedToday: false,
            registeredAt: new Date()
        });

        // Send to admin review channel
        const guild = interaction.guild;
        const adminChannel = await guild.channels.fetch(config.BIRTHDAY_ADMIN_CHANNEL_ID).catch(() => null);

        if (adminChannel) {
            const embed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('📋 New Birthday Registration')
                .setDescription(
                    `**User:** <@${interaction.user.id}> (${interaction.user.tag})\n` +
                    `**Birthday:** ${formatDate(day, month)}${year ? ` (Born: ${year})` : ''}\n` +
                    `**Registered:** <t:${Math.floor(Date.now() / 1000)}:R>`
                )
                .setThumbnail(interaction.user.displayAvatarURL())
                .setFooter({ text: `User ID: ${interaction.user.id}` })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`bday_approve_${interaction.user.id}`)
                    .setLabel('✅ Approve')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`bday_reject_${interaction.user.id}`)
                    .setLabel('❌ Reject')
                    .setStyle(ButtonStyle.Danger)
            );

            await adminChannel.send({ embeds: [embed], components: [row] });
        }

        return interaction.reply({
            content: `✅ Your birthday (**${formatDate(day, month)}**) has been submitted for review! Admin will approve it shortly. 🎂`,
            ephemeral: true
        });
    }

    // ── VIEW MY BIRTHDAY ──
    if (interaction.isButton() && interaction.customId === 'birthday_view') {
        const data = birthdayRegistry.get(interaction.user.id);
        if (!data) {
            return interaction.reply({ content: '❌ You haven\'t registered your birthday yet! Click **Register Birthday** to get started.', ephemeral: true });
        }
        const [dd, mm] = data.birthday.split('-');
        return interaction.reply({
            content: `🎂 Your registered birthday: **${formatDate(dd, mm)}**\n📋 Status: ${data.approved ? '✅ Approved' : '⏳ Pending Review'}`,
            ephemeral: true
        });
    }

    // ── ADMIN: APPROVE BIRTHDAY ──
    if (interaction.isButton() && interaction.customId.startsWith('bday_approve_')) {
        if (!config.BROADCAST_ALLOWED_ROLES.some(r => interaction.member.roles.cache.has(r))) {
            return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        }
        const userId = interaction.customId.replace('bday_approve_', '');
        const data = birthdayRegistry.get(userId);
        if (!data) return interaction.reply({ content: '❌ Registration not found.', ephemeral: true });

        birthdayRegistry.set(userId, { ...data, approved: true });

        await interaction.update({
            embeds: [
                EmbedBuilder.from(interaction.message.embeds[0])
                    .setColor('#00FF00')
                    .setTitle('✅ Birthday Approved')
                    .setFooter({ text: `Approved by ${interaction.user.tag}` })
            ],
            components: []
        });

        // DM user
        const guild = interaction.guild;
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member) {
            member.send(`🎉 Your birthday registration has been **approved** by the MRP admins! You'll receive a special gift on your birthday. 🎂`).catch(() => null);
        }

        return;
    }

    // ── ADMIN: REJECT BIRTHDAY ──
    if (interaction.isButton() && interaction.customId.startsWith('bday_reject_')) {
        if (!config.BROADCAST_ALLOWED_ROLES.some(r => interaction.member.roles.cache.has(r))) {
            return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        }
        const userId = interaction.customId.replace('bday_reject_', '');
        birthdayRegistry.delete(userId);

        await interaction.update({
            embeds: [
                EmbedBuilder.from(interaction.message.embeds[0])
                    .setColor('#FF0000')
                    .setTitle('❌ Birthday Rejected')
                    .setFooter({ text: `Rejected by ${interaction.user.tag}` })
            ],
            components: []
        });

        const guild = interaction.guild;
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member) {
            member.send(`❌ Your birthday registration was rejected by MRP admins. Please re-register with a valid date.`).catch(() => null);
        }

        return;
    }

    // ── ADMIN: MARK GIFT GIVEN ──
    if (interaction.isButton() && interaction.customId.startsWith('bday_gifted_')) {
        if (!config.BROADCAST_ALLOWED_ROLES.some(r => interaction.member.roles.cache.has(r))) {
            return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        }
        const userId = interaction.customId.replace('bday_gifted_', '');

        await interaction.update({
            embeds: [
                EmbedBuilder.from(interaction.message.embeds[0])
                    .setColor('#00FF00')
                    .setTitle('🎁 Gift Given!')
                    .setFooter({ text: `Gift given by ${interaction.user.tag}` })
            ],
            components: []
        });

        return;
    }

    // ── REFERRAL: GENERATE CODE ──
    if (interaction.isButton() && interaction.customId === 'referral_generate') {
        // Check if user already has a code
        let existingCode = null;
        for (const [code, data] of referralCodes.entries()) {
            if (data.ownerId === interaction.user.id) {
                existingCode = code;
                break;
            }
        }

        if (existingCode) {
            return interaction.reply({
                content: `🔑 You already have a referral code: **\`${existingCode}\`**\nShare it with friends to earn rewards!`,
                ephemeral: true
            });
        }

        const code = generateCode(interaction.user.id);
        referralCodes.set(code, {
            ownerId: interaction.user.id,
            uses: [],
            createdAt: new Date()
        });

        return interaction.reply({
            content: `✅ Your unique referral code has been generated!\n\n🔑 **Code: \`${code}\`**\n\nShare this with friends. When they use it, you earn rewards! 🏆`,
            ephemeral: true
        });
    }

    // ── REFERRAL: USE A CODE ──
    if (interaction.isButton() && interaction.customId === 'referral_use') {
        if (referralUses.has(interaction.user.id)) {
            return interaction.reply({ content: '❌ You have already used a referral code!', ephemeral: true });
        }

        // Check if user owns a code (can't use their own)
        const modal = new ModalBuilder()
            .setCustomId('referral_use_modal')
            .setTitle('✅ Use Referral Code');

        const codeInput = new TextInputBuilder()
            .setCustomId('ref_code_input')
            .setLabel('Enter Referral Code')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g. MRP-AB1234')
            .setMinLength(4)
            .setMaxLength(12)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(codeInput));
        return interaction.showModal(modal);
    }

    // ── REFERRAL USE MODAL SUBMIT ──
    if (interaction.isModalSubmit() && interaction.customId === 'referral_use_modal') {
        const inputCode = interaction.fields.getTextInputValue('ref_code_input').toUpperCase().trim();

        if (referralUses.has(interaction.user.id)) {
            return interaction.reply({ content: '❌ You have already used a referral code!', ephemeral: true });
        }

        const codeData = referralCodes.get(inputCode);
        if (!codeData) {
            return interaction.reply({ content: '❌ Invalid referral code! Please double-check and try again.', ephemeral: true });
        }

        if (codeData.ownerId === interaction.user.id) {
            return interaction.reply({ content: '❌ You cannot use your own referral code!', ephemeral: true });
        }

        // Register the use
        codeData.uses.push({ userId: interaction.user.id, usedAt: new Date() });
        referralUses.set(interaction.user.id, inputCode);

        // Notify admin referral review channel
        const guild = interaction.guild;
        const adminRefChannel = await guild.channels.fetch(config.REFERRAL_ADMIN_CHANNEL_ID).catch(() => null);

        if (adminRefChannel) {
            const owner = await guild.members.fetch(codeData.ownerId).catch(() => null);
            const embed = new EmbedBuilder()
                .setColor('#00CED1')
                .setTitle('🔗 New Referral Used!')
                .setDescription(
                    `**Code:** \`${inputCode}\`\n` +
                    `**Code Owner:** <@${codeData.ownerId}>${owner ? ` (${owner.user.tag})` : ''}\n` +
                    `**Used By:** <@${interaction.user.id}> (${interaction.user.tag})\n` +
                    `**Time:** <t:${Math.floor(Date.now() / 1000)}:R>\n\n` +
                    `**Total Uses of this code:** ${codeData.uses.length}`
                )
                .setThumbnail(interaction.user.displayAvatarURL())
                .setFooter({ text: 'MRP Referral System' })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`ref_reward_${codeData.ownerId}_${interaction.user.id}`)
                    .setLabel('🏆 Give Reward to Referrer')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`ref_deny_${interaction.user.id}`)
                    .setLabel('❌ Deny / Invalidate')
                    .setStyle(ButtonStyle.Danger)
            );

            await adminRefChannel.send({ embeds: [embed], components: [row] });
        }

        return interaction.reply({
            content: `✅ Referral code **\`${inputCode}\`** applied successfully! The code owner will be rewarded. 🎉`,
            ephemeral: true
        });
    }

    // ── REFERRAL STATS ──
    if (interaction.isButton() && interaction.customId === 'referral_stats') {
        let myCode = null;
        let myUses = 0;
        for (const [code, data] of referralCodes.entries()) {
            if (data.ownerId === interaction.user.id) {
                myCode = code;
                myUses = data.uses.length;
                break;
            }
        }

        const usedCode = referralUses.get(interaction.user.id) || null;

        let msg = `📊 **Your Referral Stats**\n\n`;
        msg += myCode
            ? `🔑 **Your Code:** \`${myCode}\`\n👥 **Total Referrals:** ${myUses}\n`
            : `🔑 **Your Code:** Not generated yet\n`;
        msg += usedCode
            ? `\n✅ **You used code:** \`${usedCode}\``
            : `\n⬜ **You haven't used any code yet**`;

        return interaction.reply({ content: msg, ephemeral: true });
    }

    // ── ADMIN: GIVE REWARD TO REFERRER ──
    if (interaction.isButton() && interaction.customId.startsWith('ref_reward_')) {
        if (!config.BROADCAST_ALLOWED_ROLES.some(r => interaction.member.roles.cache.has(r))) {
            return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        }

        const parts = interaction.customId.replace('ref_reward_', '').split('_');
        const referrerId = parts[0];
        const referredId = parts[1];

        await interaction.update({
            embeds: [
                EmbedBuilder.from(interaction.message.embeds[0])
                    .setColor('#00FF00')
                    .setTitle('🏆 Reward Given!')
                    .setFooter({ text: `Rewarded by ${interaction.user.tag}` })
            ],
            components: []
        });

        // DM referrer
        const guild = interaction.guild;
        const referrer = await guild.members.fetch(referrerId).catch(() => null);
        if (referrer) {
            referrer.send(`🏆 You've been rewarded for a successful referral! Someone joined using your code. Keep sharing to earn more! 🎉`).catch(() => null);
        }

        return;
    }

    // ── ADMIN: DENY REFERRAL ──
    if (interaction.isButton() && interaction.customId.startsWith('ref_deny_')) {
        if (!config.BROADCAST_ALLOWED_ROLES.some(r => interaction.member.roles.cache.has(r))) {
            return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        }

        const userId = interaction.customId.replace('ref_deny_', '');
        referralUses.delete(userId);

        // Remove from code uses
        for (const [code, data] of referralCodes.entries()) {
            data.uses = data.uses.filter(u => u.userId !== userId);
        }

        await interaction.update({
            embeds: [
                EmbedBuilder.from(interaction.message.embeds[0])
                    .setColor('#FF0000')
                    .setTitle('❌ Referral Invalidated')
                    .setFooter({ text: `Denied by ${interaction.user.tag}` })
            ],
            components: []
        });

        return;
    }

};

module.exports.setupBirthdayReferralPanels = setupBirthdayReferralPanels;
module.exports.startBirthdayChecker = startBirthdayChecker;
