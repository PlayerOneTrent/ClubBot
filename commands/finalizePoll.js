const { SlashCommandBuilder } = require('@discordjs/builders');
const { readPollsData, writePollsData } = require('../lib/pollStore');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('finalizepoll')
        .setDescription('Finalizes the current poll, shuffles items, and allows voting'),
    async execute(interaction) {
        const channelId = interaction.channelId;
        const pollsData = readPollsData();

        const poll = pollsData.polls.find(p => p.channelId === channelId && !p.isFinalized && !p.isClosed);
        if (!poll) {
            await interaction.reply({ content: 'No active poll found in this channel or the poll is already finalized/closed.', ephemeral: true });
            return;
        }

        // Shuffle poll items
        poll.items = poll.items.sort(() => Math.random() - 0.5);
        poll.isFinalized = true;

        writePollsData(pollsData);

        // Create and send the embed
        const embed = new EmbedBuilder()
            .setColor('#0099FF')
            .setTitle(`Poll Finalized: ${poll.name}`)
            .setDescription('The poll has been finalized, and items have been shuffled. Here are the items to vote on:')
            .addFields(poll.items.map((item, index) => ({ name: `${String.fromCharCode(65 + index)}. ${item.name}`, value: '\u200B' })))
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: false });
    },
};
