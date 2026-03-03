const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    EmbedBuilder
} = require('discord.js');

const config = require('../config');

module.exports = async (interaction, client) => {

    // ===============================
    // SLASH COMMAND
    // ===============================
    if (interaction.isChatInputCommand() &&
        interaction.commandName === 'mrp_broadcast') {

        // Only inside master app channel
        if (interaction.channel.id !== config.MASTER_APP_CHANNEL_ID) {
            return interaction.reply({
                content: 'Use this inside master app channel only.',
                ephemeral: true
            });
        }

        // Role check
        const hasAccess = interaction.member.roles.cache.some(role =>
            config.BROADCAST_ALLOWED_ROLES.includes(role.id)
        );

        if (!hasAccess) {
            return interaction.reply({
                content: 'You do not have permission to use this.',
                ephemeral: true
            });
        }

        const dropdown = new StringSelectMenuBuilder()
            .setCustomId('broadcast_select')
            .setPlaceholder('Select target channel')
            .addOptions(
                Object.keys(config.BROADCAST_CHANNELS).map(key => ({
                    label: key.replace('_', ' ').toUpperCase(),
                    value: key
                }))
            );

        return interaction.reply({
            content: 'Select where to send the broadcast:',
            components: [new ActionRowBuilder().addComponents(dropdown)],
            ephemeral: true
        });
    }

    // ===============================
    // DROPDOWN SELECT
    // ===============================
    if (interaction.isStringSelectMenu() &&
        interaction.customId === 'broadcast_select') {

        const selected = interaction.values[0];

        client.broadcastCache = client.broadcastCache || {};
        client.broadcastCache[interaction.user.id] = selected;

        const modal = new ModalBuilder()
            .setCustomId('broadcast_modal')
            .setTitle('Enter Broadcast Message');

        const messageInput = new TextInputBuilder()
            .setCustomId('broadcast_content')
            .setLabel('Message')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(messageInput)
        );

        return interaction.showModal(modal);
    }

    // ===============================
    // MODAL SUBMIT
    // ===============================
    if (interaction.isModalSubmit() &&
        interaction.customId === 'broadcast_modal') {

        const selected = client.broadcastCache?.[interaction.user.id];
        const message = interaction.fields.getTextInputValue('broadcast_content');

        if (!selected) {
            return interaction.reply({
                content: 'No channel selected.',
                ephemeral: true
            });
        }

        const channelId = config.BROADCAST_CHANNELS[selected];
        const targetChannel = await interaction.guild.channels.fetch(channelId).catch(() => null);

        if (!targetChannel) {
            return interaction.reply({
                content: 'Target channel not found.',
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setColor('Blue')
            .setTitle('📢 Official Announcement')
            .setDescription(message)
            .setFooter({ text: `Sent by ${interaction.user.tag}` })
            .setTimestamp();

        await targetChannel.send({ embeds: [embed] });

        delete client.broadcastCache[interaction.user.id];

        return interaction.reply({
            content: 'Broadcast sent successfully.',
            ephemeral: true
        });
    }

};