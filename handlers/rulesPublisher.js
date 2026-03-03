const {
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} = require('discord.js');

const config = require('../config');

module.exports = async (interaction, client) => {

    // ===============================
    // SLASH COMMAND (mrp_rules_set)
    // ===============================
    if (interaction.isChatInputCommand() &&
        interaction.commandName === 'mrp_rules_set') {

        // Restrict to publisher channel
        if (interaction.channel.id !== config.RULES_PUBLISHER_CHANNEL_ID) {
            return interaction.reply({
                content: 'Use this command only inside the rules publisher channel.',
                ephemeral: true
            });
        }

        const modal = new ModalBuilder()
            .setCustomId('rules_modal')
            .setTitle('Publish Rules');

        const rulesInput = new TextInputBuilder()
            .setCustomId('rules_content')
            .setLabel('Enter Rules Text')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(rulesInput)
        );

        return interaction.showModal(modal);
    }

    // ===============================
    // MODAL SUBMIT
    // ===============================
    if (interaction.isModalSubmit() &&
        interaction.customId === 'rules_modal') {

        const rulesText = interaction.fields.getTextInputValue('rules_content');

        // Ensure cache exists
        if (!client.rulesCache) client.rulesCache = {};
        if (!client.selectedRulesChannel) client.selectedRulesChannel = {};

        client.rulesCache[interaction.user.id] = rulesText;

        const dropdown = new StringSelectMenuBuilder()
            .setCustomId('rules_select')
            .setPlaceholder('Select rule category')
            .addOptions([
                { label: '📗 Discord Rules', value: 'discord' },
                { label: '📗 Basic Rules', value: 'basic' },
                { label: '📗 Robbery Rules', value: 'robbery' },
                { label: '📗 Government Rules', value: 'government' },
                { label: '📗 Family Rules', value: 'family' },
                { label: '📗 Court Rules', value: 'court' },
                { label: '📗 FRP Punishments', value: 'frp' }
            ]);

        const publishBtn = new ButtonBuilder()
            .setCustomId('publish_rules')
            .setLabel('📢 Publish')
            .setStyle(ButtonStyle.Success);

        return interaction.reply({
            content: 'Select where to publish:',
            components: [
                new ActionRowBuilder().addComponents(dropdown),
                new ActionRowBuilder().addComponents(publishBtn)
            ],
            ephemeral: true
        });
    }

    // ===============================
    // DROPDOWN SELECT
    // ===============================
    if (interaction.isStringSelectMenu() &&
        interaction.customId === 'rules_select') {

        if (!client.selectedRulesChannel) client.selectedRulesChannel = {};

        client.selectedRulesChannel[interaction.user.id] = interaction.values[0];

        return interaction.reply({
            content: `Selected: ${interaction.values[0]}`,
            ephemeral: true
        });
    }

    // ===============================
    // PUBLISH BUTTON
    // ===============================
    if (interaction.isButton() &&
        interaction.customId === 'publish_rules') {

        const userId = interaction.user.id;

        const rulesText = client.rulesCache?.[userId];
        const selected = client.selectedRulesChannel?.[userId];

        if (!rulesText || !selected) {
            return interaction.reply({
                content: 'Missing rule text or channel selection.',
                ephemeral: true
            });
        }

        const channelId = config.RULE_CHANNELS[selected];
        const targetChannel = await interaction.guild.channels.fetch(channelId).catch(() => null);

        if (!targetChannel) {
            return interaction.reply({
                content: 'Target channel not found.',
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('📜 Server Rules')
            .setDescription(rulesText)
            .setColor('Blue')
            .setTimestamp();

        // Send rules
        await targetChannel.send({ embeds: [embed] });

        // Clear cache
        delete client.rulesCache[userId];
        delete client.selectedRulesChannel[userId];

        // Remove dropdown & button after publish
        await interaction.update({
            content: 'Rules published successfully.',
            components: []
        });
    }
};