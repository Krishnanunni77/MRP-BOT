const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    AttachmentBuilder
} = require('discord.js');

const config = require('../config');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Store pending message IDs
const pendingApplications = new Map();

// ─── Generate Ticket Image ────────────────────────────────────────────────────
function generateTicket(displayName) {
    return new Promise((resolve, reject) => {
        const outPath = path.join(os.tmpdir(), `ticket_${Date.now()}.png`);
        const scriptPath = path.join(__dirname, '../assets/generateTicket.pyscript');

        execFile('python3', [scriptPath, displayName, outPath], (err, stdout, stderr) => {
            if (err) {
                console.error('❌ Ticket generation error:', err, stderr);
                return reject(err);
            }
            if (fs.existsSync(outPath)) {
                resolve(outPath);
            } else {
                reject(new Error('Ticket file not created'));
            }
        });
    });
}

module.exports = async (interaction) => {

    // ===============================
    // APPLY BUTTON
    // ===============================
    if (interaction.isButton() && interaction.customId === 'whitelist_apply') {

        const member = interaction.member;

        if (!member.roles.cache.has(config.VERIFIED_ROLE_ID))
            return interaction.reply({ content: 'You must verify first.', ephemeral: true });

        if (member.roles.cache.has(config.WHITELISTED_ROLE_ID))
            return interaction.reply({ content: 'You are already whitelisted.', ephemeral: true });

        if (pendingApplications.has(member.id))
            return interaction.reply({ content: 'Your visa is already pending.', ephemeral: true });

        const modal = new ModalBuilder()
            .setCustomId('whitelist_modal')
            .setTitle('Mangalashery RP Visa Application');

        const fields = [
            { id: 'real_name', label: 'Real Name' },
            { id: 'age',       label: 'Age' },
            { id: 'ign',       label: 'In-Game Name (IGN)' },
            { id: 'email',     label: 'Email' },
            { id: 'rules',     label: 'Have you read the rules? (Yes/No)' }
        ];

        fields.forEach(field => {
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId(field.id)
                        .setLabel(field.label)
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                )
            );
        });

        return interaction.showModal(modal);
    }

    // ===============================
    // MODAL SUBMIT
    // ===============================
    if (interaction.isModalSubmit() && interaction.customId === 'whitelist_modal') {

        const member = interaction.member;

        await member.roles.add(config.WHITELIST_PENDING_ROLE_ID).catch(() => null);

        // Admin log embed
        const adminEmbed = new EmbedBuilder()
            .setColor('Yellow')
            .setTitle('🛂 Visa Application Review')
            .addFields(
                { name: 'Applicant',      value: `<@${member.id}>` },
                { name: 'Character Name', value: interaction.fields.getTextInputValue('ign') },
                { name: 'Real Name',      value: interaction.fields.getTextInputValue('real_name') },
                { name: 'Age',            value: interaction.fields.getTextInputValue('age') },
                { name: 'Email',          value: interaction.fields.getTextInputValue('email') },
                { name: 'Rules Accepted', value: interaction.fields.getTextInputValue('rules') }
            )
            .setTimestamp();

        const logChannel = await interaction.guild.channels.fetch(config.LOGS_CHANNEL_ID);

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`approve_${member.id}`)
                .setLabel('Approve Visa')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`reject_${member.id}`)
                .setLabel('Reject Visa')
                .setStyle(ButtonStyle.Danger)
        );

        await logChannel.send({ embeds: [adminEmbed], components: [buttons] });

        // Pending channel
        const pendingChannel = await interaction.guild.channels.fetch(config.PENDING_CHANNEL_ID);

        const pendingEmbed = new EmbedBuilder()
            .setColor('Yellow')
            .setTitle('🛂 Mangalashery Roleplay Visa')
            .setDescription(
                `Applicant: <@${member.id}>\n\n` +
                `🟡 **Your Visa for Mangalashery Roleplay is PENDING**`
            )
            .setTimestamp();

        const pendingMessage = await pendingChannel.send({ embeds: [pendingEmbed] });
        pendingApplications.set(member.id, pendingMessage.id);

        // 📩 DM — join waiting VC
        const applyDmEmbed = new EmbedBuilder()
            .setColor('Yellow')
            .setTitle('🛂 Visa Application Received!')
            .setDescription(
                `Hey <@${member.id}> 👋\n\n` +
                `Your **Mangalashery Roleplay Visa Application** has been received and is currently under review.\n\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `📋 **What's Next?**\n\n` +
                `🔊 Please join the **Waiting Voice Channel** in the server so our staff can attend to you.\n\n` +
                `<#1478031527634800742>\n\n` +
                `⏳ Our staff will be with you shortly. Please be patient!\n\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `🏙️ **MANGALASHERY ROLEPLAY** — *The city awaits!*`
            )
            .setFooter({ text: 'MANGALASHERY ROLEPLAY | GTA V RP' })
            .setTimestamp();

        member.send({ embeds: [applyDmEmbed] }).catch(() => {
            console.log(`⚠️ Could not DM ${member.user.tag} — DMs may be disabled.`);
        });

        return interaction.reply({
            content: '🟡 Your visa is now pending review. **Please check your DMs for next steps!**',
            ephemeral: true
        });
    }

    // ===============================
    // APPROVE / REJECT
    // ===============================
    if (interaction.isButton() &&
        (interaction.customId.startsWith('approve_') || interaction.customId.startsWith('reject_'))) {

        try {
            // ✅ FIX: Safe split on first underscore only
            const underscoreIndex = interaction.customId.indexOf('_');
            const action = interaction.customId.substring(0, underscoreIndex);
            const userId = interaction.customId.substring(underscoreIndex + 1);

            console.log(`[Whitelist] Action: ${action} | User: ${userId}`);

            // ✅ FIX: Defer reply immediately to prevent "interaction failed" timeout
            await interaction.deferReply({ ephemeral: true });

            const member = await interaction.guild.members.fetch(userId).catch(() => null);
            if (!member) {
                console.error(`[Whitelist] Member not found: ${userId}`);
                return interaction.editReply({ content: '❌ Member not found in server.' });
            }

            const pendingChannel  = await interaction.guild.channels.fetch(config.PENDING_CHANNEL_ID).catch(() => null);
            const approvedChannel = await interaction.guild.channels.fetch(config.APPROVED_CHANNEL_ID).catch(() => null);
            const rejectedChannel = await interaction.guild.channels.fetch(config.REJECTED_CHANNEL_ID).catch(() => null);

            const messageId = pendingApplications.get(userId);

            // Role management
            await member.roles.remove(config.WHITELIST_PENDING_ROLE_ID).catch((err) => {
                console.warn(`[Whitelist] Could not remove pending role:`, err.message);
            });

            if (action === 'approve') {
                if (config.READMISSION_ROLE_ID) {
                    await member.roles.remove(config.READMISSION_ROLE_ID).catch((err) => {
                        console.warn(`[Whitelist] Could not remove readmission role:`, err.message);
                    });
                }
                await member.roles.add(config.WHITELISTED_ROLE_ID).catch((err) => {
                    console.error(`[Whitelist] Could not add whitelisted role:`, err.message);
                });
            } else {
                if (config.READMISSION_ROLE_ID) {
                    await member.roles.add(config.READMISSION_ROLE_ID).catch((err) => {
                        console.warn(`[Whitelist] Could not add readmission role:`, err.message);
                    });
                }
            }

            // Status channel embeds
            if (action === 'approve' && approvedChannel) {
                const approvedEmbed = new EmbedBuilder()
                    .setColor('Green')
                    .setTitle('🛂 Visa Approved')
                    .setDescription(
                        `Applicant: <@${userId}>\n\n` +
                        `🟢 **Your Visa for Mangalashery Roleplay is APPROVED**\n\n` +
                        `Welcome to the city.`
                    )
                    .setTimestamp();
                await approvedChannel.send({ embeds: [approvedEmbed] });

            } else if (action === 'reject' && rejectedChannel) {
                const rejectedEmbed = new EmbedBuilder()
                    .setColor('Red')
                    .setTitle('🛂 Visa Rejected')
                    .setDescription(
                        `Applicant: <@${userId}>\n\n` +
                        `🔴 **Your Visa for Mangalashery Roleplay is REJECTED**\n\n` +
                        `You may reapply after review.`
                    )
                    .setTimestamp();
                await rejectedChannel.send({ embeds: [rejectedEmbed] });
            }

            // Edit pending message
            if (messageId && pendingChannel) {
                const message = await pendingChannel.messages.fetch(messageId).catch(() => null);
                if (message) {
                    const updatedEmbed = new EmbedBuilder()
                        .setColor('Grey')
                        .setTitle('🛂 Visa Status')
                        .setDescription(
                            `Applicant: <@${userId}>\n\n` +
                            `⚖️ **Decision has been made.**\n\n` +
                            `🔔 Please check with admins.\n\n` +
                            `Approved or Rejected by the God of Mangalashery.`
                        )
                        .setTimestamp();
                    await message.edit({ embeds: [updatedEmbed] }).catch((err) => {
                        console.warn(`[Whitelist] Could not edit pending message:`, err.message);
                    });
                } else {
                    console.warn(`[Whitelist] Pending message not found (bot may have restarted).`);
                }
            } else {
                console.warn(`[Whitelist] No pending message ID found for user ${userId} — bot may have restarted.`);
            }

            pendingApplications.delete(userId);

            // =============================================
            // 📩 DM — APPROVED with personalised ticket
            // =============================================
            if (action === 'approve') {

                const approveDmEmbed = new EmbedBuilder()
                    .setColor('Green')
                    .setTitle('🎉 Visa Approved — Welcome to the City!')
                    .setDescription(
                        `Hey <@${userId}> 🎊\n\n` +
                        `Congratulations! Your **Mangalashery Roleplay Visa** has been **APPROVED**! 🟢\n\n` +
                        `━━━━━━━━━━━━━━━━━━━━\n` +
                        `🏙️ **You are now a citizen of Mangalashery!**\n\n` +
                        `🚗 Jump into the server and start your roleplay journey.\n` +
                        `👮‍♂️ Join a faction, start a business, or create your own story!\n\n` +
                        `📌 Make sure to follow all server rules to keep your whitelist status.\n\n` +
                        `━━━━━━━━━━━━━━━━━━━━\n` +
                        `🎫 Your **MRP Entry Ticket** is attached below!\n` +
                        `🏁 **The city is waiting for you. See you in-game!**`
                    )
                    .setImage('attachment://mrp_ticket.png')
                    .setFooter({ text: 'MANGALASHERY ROLEPLAY | GTA V RP' })
                    .setTimestamp();

                try {
                    const displayName = member.displayName || member.user.username;
                    const ticketPath  = await generateTicket(displayName);
                    const ticketFile  = new AttachmentBuilder(ticketPath, { name: 'mrp_ticket.png' });

                    await member.send({ embeds: [approveDmEmbed], files: [ticketFile] });

                    // Clean up temp file
                    fs.unlink(ticketPath, () => {});

                } catch (err) {
                    console.error('⚠️ Ticket generation failed, sending DM without ticket:', err);
                    const fallbackEmbed = new EmbedBuilder()
                        .setColor('Green')
                        .setTitle('🎉 Visa Approved — Welcome to the City!')
                        .setDescription(approveDmEmbed.data.description)
                        .setFooter({ text: 'MANGALASHERY ROLEPLAY | GTA V RP' })
                        .setTimestamp();
                    await member.send({ embeds: [fallbackEmbed] }).catch(() => {
                        console.log(`⚠️ Could not DM ${member.user.tag} — DMs may be disabled.`);
                    });
                }

            // =============================================
            // 📩 DM — REJECTED
            // =============================================
            } else if (action === 'reject') {

                const rejectDmEmbed = new EmbedBuilder()
                    .setColor('Red')
                    .setTitle('❌ Visa Rejected')
                    .setDescription(
                        `Hey <@${userId}> 👋\n\n` +
                        `Unfortunately, your **Mangalashery Roleplay Visa** has been **REJECTED**. 🔴\n\n` +
                        `━━━━━━━━━━━━━━━━━━━━\n` +
                        `📋 **What can you do?**\n\n` +
                        `🔄 You may reapply after reviewing our rules carefully.\n` +
                        `📖 Make sure you have read all the server rules before reapplying.\n` +
                        `❓ If you have questions, reach out to our staff team.\n\n` +
                        `━━━━━━━━━━━━━━━━━━━━\n` +
                        `💡 *Don't give up — the city still has a place for you!*`
                    )
                    .setFooter({ text: 'MANGALASHERY ROLEPLAY | GTA V RP' })
                    .setTimestamp();

                member.send({ embeds: [rejectDmEmbed] }).catch(() => {
                    console.log(`⚠️ Could not DM ${member.user.tag} — DMs may be disabled.`);
                });
            }

            // Delete the admin log message with the buttons
            await interaction.message.delete().catch((err) => {
                console.warn(`[Whitelist] Could not delete log message:`, err.message);
            });

            return interaction.editReply({
                content: `✅ Visa ${action === 'approve' ? '**approved**' : '**rejected**'} successfully.`
            });

        } catch (err) {
            console.error('[Whitelist] Approve/Reject handler error:', err);
            // Use editReply if already deferred, else reply
            try {
                return await interaction.editReply({ content: '❌ Something went wrong. Check console logs.' });
            } catch {
                return await interaction.reply({ content: '❌ Something went wrong.', ephemeral: true });
            }
        }
    }
};
