const config = require('../config');

module.exports = async (interaction) => {

    if (!interaction.isButton()) return;
    if (interaction.customId !== 'verify_button') return;

    try {
        const member = interaction.member;

        const verifiedRole = interaction.guild.roles.cache.get(config.VERIFIED_ROLE_ID);
        const unverifiedRole = interaction.guild.roles.cache.get(config.UNVERIFIED_ROLE_ID);

        if (!verifiedRole) {
            return interaction.reply({
                content: 'Verified role not found.',
                ephemeral: true
            });
        }

        // 🚫 Already verified
        if (member.roles.cache.has(config.VERIFIED_ROLE_ID)) {
            return interaction.reply({
                content: 'You are already verified.',
                ephemeral: true
            });
        }

        // ✅ Add VERIFIED role
        await member.roles.add(verifiedRole);

        // 🔥 Remove UNVERIFIED role
        if (unverifiedRole && member.roles.cache.has(unverifiedRole.id)) {
            await member.roles.remove(unverifiedRole).catch(() => null);
        }

        return interaction.reply({
            content: 'You are now verified. Unverified role removed.',
            ephemeral: true
        });

    } catch (error) {
        console.error(error);

        if (!interaction.replied) {
            await interaction.reply({
                content: 'Verification failed. Check bot permissions.',
                ephemeral: true
            });
        }
    }
};