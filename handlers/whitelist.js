const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

const config = require('../config');

// Store pending message IDs
const pendingApplications = new Map();

module.exports = async (interaction) => {

    // ===============================
    // APPLY BUTTON
    // ===============================
    if (interaction.isButton() && interaction.customId === 'whitelist_apply') {

        const member = interaction.member;

        // Must be verified first
        if (!member.roles.cache.has(config.VERIFIED_ROLE_ID))
            return interaction.reply({ content: 'You must verify first.', ephemeral: true });

        // Already whitelisted
        if (member.roles.cache.has(config.WHITELISTED_ROLE_ID))
            return interaction.reply({ content: 'You are already whitelisted.', ephemeral: true });

        // Already pending
        if (pendingApplications.has(member.id))
            return interaction.reply({ content: 'Your visa is already pending.', ephemeral: true });

        const modal = new ModalBuilder()
            .setCustomId('whitelist_modal')
            .setTitle('Mangalashery RP Visa Application');

        const fields = [
            { id: 'real_name', label: 'Real Name' },
            { id: 'age', label: 'Age' },
            { id: 'ign', label: 'In-Game Name (IGN)' },
            { id: 'email', label: 'Email' },
            { id: 'rules', label: 'Have you read the rules? (Yes/No)' }
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

        // Add pending role
        await member.roles.add(config.WHITELIST_PENDING_ROLE_ID).catch(() => null);

        // ======================
        // ADMIN LOG EMBED
        // ======================
        const adminEmbed = new EmbedBuilder()
            .setColor('Yellow')
            .setTitle('🛂 Visa Application Review')
            .addFields(
                { name: 'Applicant', value: `<@${member.id}>` },
                { name: 'Character Name', value: interaction.fields.getTextInputValue('ign') },
                { name: 'Real Name', value: interaction.fields.getTextInputValue('real_name') },
                { name: 'Age', value: interaction.fields.getTextInputValue('age') },
                { name: 'Email', value: interaction.fields.getTextInputValue('email') },
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

        // ======================
        // PENDING CHANNEL EMBED (Simple)
        // ======================
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

        // Store message ID
        pendingApplications.set(member.id, pendingMessage.id);

        return interaction.reply({
            content: '🟡 Your visa is now pending review.',
            ephemeral: true
        });
    }

    // ===============================
    // APPROVE / REJECT
    // ===============================
    if (interaction.isButton() &&
        (interaction.customId.startsWith('approve_') || interaction.customId.startsWith('reject_'))) {

        const [action, userId] = interaction.customId.split('_');
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        if (!member) return;

        const pendingChannel = await interaction.guild.channels.fetch(config.PENDING_CHANNEL_ID);
        const approvedChannel = await interaction.guild.channels.fetch(config.APPROVED_CHANNEL_ID);
        const rejectedChannel = await interaction.guild.channels.fetch(config.REJECTED_CHANNEL_ID);

        const messageId = pendingApplications.get(userId);

        // ======================
        // ROLE MANAGEMENT
        // ======================
        await member.roles.remove(config.WHITELIST_PENDING_ROLE_ID).catch(() => null);

        if (action === 'approve') {
            await member.roles.remove(config.READMISSION_ROLE_ID).catch(() => null);
            await member.roles.add(config.WHITELISTED_ROLE_ID).catch(() => null);
        } else {
            await member.roles.add(config.READMISSION_ROLE_ID).catch(() => null);
        }

        // ======================
        // SEND FINAL STATUS TO CORRECT CHANNEL
        // ======================
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

        // ======================
        // EDIT PENDING MESSAGE
        // ======================
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

                await message.edit({ embeds: [updatedEmbed] });
            }
        }

        pendingApplications.delete(userId);

        await interaction.message.delete().catch(() => null);

        return interaction.reply({
            content: `Visa ${action === 'approve' ? 'approved' : 'rejected'}.`,
            ephemeral: true
        });

        }
};