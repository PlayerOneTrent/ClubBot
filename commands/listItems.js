const { SlashCommandBuilder } = require('@discordjs/builders');
const { readPollsData } = require('../lib/pollStore');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('listitems')
        .setDescription('Lists all items in the finalized poll'),
    async execute(interaction) {
        const channelId = interaction.channelId;
        const pollsData = readPollsData();

        const poll = pollsData.polls.find(p => p.channelId === channelId && p.isFinalized && !p.isClosed);
        if (!poll) {
            await interaction.reply({ content: 'No finalized poll found in this channel or the poll is closed.', ephemeral: true });
            return;
        }

        const itemsToDisplay = poll.isSuddenDeath ? poll.suddenDeathItems : poll.items;

        // Create and send the embed
        const embed = new EmbedBuilder()
            .setColor('#0099FF')
            .setTitle(`Poll Items: ${poll.name}`)
            .setDescription('Here are the items in the current poll:')
            .addFields(itemsToDisplay.map((item, index) => ({ name: `${String.fromCharCode(65 + index)}. ${item.name}`, value: '\u200B' })))
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: false });
    },
};
