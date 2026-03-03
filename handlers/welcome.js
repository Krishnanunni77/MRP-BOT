const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const config = require('../config');
const path = require('path');

module.exports = (client) => {

    client.on('guildMemberAdd', async (member) => {

        try {

            // 🔥 AUTO ASSIGN UNVERIFIED ROLE
            const unverifiedRole = member.guild.roles.cache.get(config.UNVERIFIED_ROLE_ID);
            if (unverifiedRole) {
                await member.roles.add(unverifiedRole).catch(() => null);
            }

            // Fetch welcome channel
            const channel = await member.guild.channels.fetch(config.WELCOME_CHANNEL_ID).catch(() => null);
            if (!channel) return;

            // Load local GIF
            const filePath = path.join(__dirname, '../assets/welcome.gif');
            const attachment = new AttachmentBuilder(filePath, { name: 'welcome.gif' });

            const embed = new EmbedBuilder()
                .setColor('Gold')
                .setTitle('🎉 Welcome to Mangalashery RolePlay')
                .setDescription(
                    `Hey <@${member.id}> 👋\n\n` +
                    `Welcome to **Mangalashery RolePlay – GTA V RP Server** 🚗🔥\n\n` +
                    `💼 **Things You Can Do:**\n` +
                    `• Join the Police Department 👮‍♂️\n` +
                    `• Start your own Business 🏪\n` +
                    `• Become a Gang Leader 🔫\n` +
                    `• Work in Government 🏛️\n` +
                    `• Create your own RP storyline 🎭\n\n` +
                    `📌 **Next Steps:**\n` +
                    `• Verify yourself\n` +
                    `• Read the rules carefully\n` +
                    `• Apply for whitelist\n\n` +
                    `You have been given the **Unverified** role.\n` +
                    `Please verify to unlock full access.\n\n` +
                    `We’re excited to see your RP journey begin! 🚀`
                )
                .setImage('attachment://welcome.gif')
                .setFooter({ text: 'Mangalashery RolePlay | GTA V RP Server' })
                .setTimestamp();

            await channel.send({
                content: `<@${member.id}>`,
                embeds: [embed],
                files: [attachment]
            });

        } catch (error) {
            console.error('Welcome message error:', error);
        }

    });

};