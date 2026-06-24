// postVote.js
const { SlashCommandBuilder } = require('@discordjs/builders');
const { readPollsData } = require('../lib/pollStore');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('showvote')
        .setDescription('Shows your current votes in the active poll'),
    async execute(interaction) {
        const channelId = interaction.channelId;
        const userId = interaction.user.id;

        const pollsData = readPollsData();
        const poll = pollsData.polls.find(p => p.channelId === channelId && p.isFinalized && !p.isClosed);

        if (!poll) {
            await interaction.reply({ content: 'No finalized and open poll found in this channel.', ephemeral: true });
            return;
        }

        const votesSource = poll.isSuddenDeath ? poll.suddenDeathVotes : poll.votes;

        if (!votesSource || !votesSource[userId]) {
            await interaction.reply({ content: 'You have not voted in this poll.', ephemeral: true });
            return;
        }

        // Retrieve user's votes and map them to poll items
        const userVotes = votesSource[userId];
        const voteDetails = Object.entries(userVotes).map(([itemId, points]) => {
            const item = poll.items.find(i => i.id === itemId);
            return `${item.name}: ${points} point${points > 1 ? 's' : ''}`;
        });

        // Construct and send an embed with the vote details
        const embed = new EmbedBuilder()
            .setColor('#0099FF')
            .setTitle(`Your Current Votes${poll.isSuddenDeath ? ' (Sudden Death Round)' : ''}`)
            .setDescription(voteDetails.join('\n'))
            .setFooter({ text: `Poll: ${poll.name}` });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
