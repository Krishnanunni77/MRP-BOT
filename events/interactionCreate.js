const whitelist = require('../handlers/whitelist');
const rulesPublisher = require('../handlers/rulesPublisher');
const verify = require('../handlers/verify');
const broadcast = require('../handlers/broadcast');
const birthdayReferral = require('../handlers/birthdayReferral');

module.exports = (client) => {

    client.on('interactionCreate', async (interaction) => {

        try {
            await whitelist(interaction, client);
            await rulesPublisher(interaction, client);
            await verify(interaction, client);
            await broadcast(interaction, client);
            await birthdayReferral(interaction, client);
        } catch (error) {
            console.error(error);
        }

    });

};
