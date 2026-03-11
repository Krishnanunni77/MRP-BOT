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
                
                `You have been assigned the **Unverified** role.\n` +
                `Please complete the verification process to unlock full access to the server.\n\n` +
                
                `💼 **Opportunities Await:**\n` +
                `• Join the Police Department 👮‍♂️\n` +
                `• Start your own Business 🏪\n` +
                `• Become a Gang Leader 🔫\n` +
                `• Work in Government 🏛️\n` +
                `• Create your own RP storyline 🎭\n\n` +
                
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `🛠️ **SETTING UP YOUR JOURNEY**\n\n` +
                
                `<#1478031525957075149> | Unlock the full server by completing verification.\n\n` +
                `<#1478031526632362028> | Please read the server rules carefully before proceeding.\n\n` +
                `<#1478031526871433430> | Fill out your Whitelist form to join the action.\n\n` +
                `<#1478031527026884733> | Hop into the Waiting VC after applying; staff is on the way!\n\n` +
                
                `🏁 **The city is waiting for you!**`
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

