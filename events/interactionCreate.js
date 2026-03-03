const whitelist = require('../handlers/whitelist');
const rulesPublisher = require('../handlers/rulesPublisher');
const verify = require('../handlers/verify'); // 🔥 ADD THIS
const broadcast = require('../handlers/broadcast');

module.exports = (client) => {

    client.on('interactionCreate', async (interaction) => {

        try {
            await whitelist(interaction, client);
            await rulesPublisher(interaction, client);
            await verify(interaction, client);
            await broadcast(interaction, client);
        } catch (error) {
            console.error(error);
        }

    });

};