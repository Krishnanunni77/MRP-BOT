const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const config = require('../config');

module.exports = (client) => {

    client.once('ready', async () => {
        console.log(`Logged in as ${client.user.tag}`);

        const guild = await client.guilds.fetch(config.GUILD_ID).catch(() => null);
        if (!guild) return console.log('Guild not found.');

        /*
        --------------------------------------------------
        Register Slash Command
        --------------------------------------------------
        */
        await guild.commands.create({
            name: 'mrp_rules_set',
            description: 'Publish rules to selected channel'
        });

        /*
        --------------------------------------------------
        VERIFY BUTTON SETUP
        --------------------------------------------------
        */
        const verifyChannel = await guild.channels.fetch(config.VERIFY_CHANNEL_ID).catch(() => null);

        if (verifyChannel) {

            const messages = await verifyChannel.messages.fetch({ limit: 50 }).catch(() => null);

            const verifyExists = messages?.some(msg =>
                msg.components?.some(row =>
                    row.components?.some(btn => btn.customId === 'verify_button')
                )
            );

            if (!verifyExists) {
                const verifyButton = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('verify_button')
                        .setLabel('✅ Verify Now')
                        .setStyle(ButtonStyle.Success)
                );

                await verifyChannel.send({
                    content: 'Click below to verify and gain access:',
                    components: [verifyButton]
                });
            }
        }

        /*
        --------------------------------------------------
        WHITELIST APPLY BUTTON SETUP
        --------------------------------------------------
        */
        const applyChannel = await guild.channels.fetch(config.APPLY_CHANNEL_ID).catch(() => null);

        if (applyChannel) {

            const messages = await applyChannel.messages.fetch({ limit: 50 }).catch(() => null);

            const applyExists = messages?.some(msg =>
                msg.components?.some(row =>
                    row.components?.some(btn => btn.customId === 'whitelist_apply')
                )
            );

            if (!applyExists) {
                const applyButton = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('whitelist_apply')
                        .setLabel('📩 Apply for Whitelist')
                        .setStyle(ButtonStyle.Primary)
                );

                await applyChannel.send({
                    content: 'Click below to apply for whitelist:',
                    components: [applyButton]
                });
            }
        }

        console.log('Ready setup completed.');


        await guild.commands.create({
    name: 'mrp_broadcast',
    description: 'Send broadcast message to selected channel'
});

    });

};