// retactVote.js
const { SlashCommandBuilder } = require('@discordjs/builders');
const { readPollsData, writePollsData } = require('../lib/pollStore');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('retractvote')
        .setDescription('Retracts your vote in the current poll'),
    async execute(interaction) {
        const channelId = interaction.channelId;
        const userId = interaction.user.id;

        const pollsData = readPollsData();
        const poll = pollsData.polls.find(p => p.channelId === channelId && p.isFinalized && !p.isClosed);

        if (!poll) {
            await interaction.reply({ content: 'No finalized and open poll found in this channel.', ephemeral: true });
            return;
        }

        if (!poll.votes || !poll.votes[userId]) {
            await interaction.reply({ content: 'You have not voted in this poll.', ephemeral: true });
            return;
        }

        if (poll.isSuddenDeath && poll.suddenDeathVotes && poll.suddenDeathVotes[userId]) {
          delete poll.suddenDeathVotes[userId]; // Retract vote from sudden death round
        } else if (poll.votes && poll.votes[userId]) {
            delete poll.votes[userId]; // Retract vote from regular round
        } else {
          await interaction.reply({ content: 'You have not voted in this poll.', ephemeral: true });
          return;
        }

        writePollsData(pollsData);
        await interaction.reply({ content: 'Your vote has been retracted.', ephemeral: true });
    },
};
