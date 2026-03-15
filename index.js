process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const config = require('./config');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel]
});

client.rulesCache = {};
client.selectedRulesChannel = {};

require('./events/ready')(client);
require('./events/interactionCreate')(client);
require('./handlers/welcome')(client);

// ─── Birthday & Referral Checker (runs hourly) ────────────────────────────
const { startBirthdayChecker } = require('./handlers/birthdayReferral');
client.once('ready', () => startBirthdayChecker(client));

client.login(config.TOKEN);
