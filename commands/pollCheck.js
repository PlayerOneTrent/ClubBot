// pollCheck.js
const { SlashCommandBuilder } = require('@discordjs/builders');
const { readPollsData } = require('../lib/pollStore');

const getDisplayName = async (client, userId) => {
  try {
    const user = await client.users.fetch(userId);
    return user.globalName || user.username;
  } catch (e) {
    return `Unknown User (${userId})`;
  }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pollcheck')
    .setDescription('Checks the status of the current poll and provides appropriate information'),

  async execute(interaction) {
    const channelId = interaction.channelId;
    const pollsData = readPollsData();
    const poll = pollsData.polls.find(p => p.channelId === channelId && p.isClosed === false);

    if (!poll) {
      await interaction.reply({ content: 'No poll found in this channel.', ephemeral: true });
      return;
    }

    // Poll is active and accepting submissions
    if (!poll.isFinalized && !poll.isClosed) {
      if (poll.items && poll.items.length > 0) {
        const uniqueUserNames = [...new Set(poll.items.map(item => item.userName || 'Unknown User'))];
        await interaction.reply({ content: `Users who have submitted:\n${uniqueUserNames.join('\n')}` });
      } else {
        await interaction.reply({ content: 'No one has submitted anything yet.' });
      }
      return;
    }

    // Poll is finalized and accepting votes
    if (poll.isFinalized && !poll.isClosed) {
      if (poll.isSuddenDeath) {
        if (poll.suddenDeathVotes && Object.keys(poll.suddenDeathVotes).length > 0) {
          const names = await Promise.all(
            Object.keys(poll.suddenDeathVotes).map(userId =>
              getDisplayName(interaction.client, userId)
            )
          );
          await interaction.reply({ content: `Sudden Death Round! Users who have voted:\n${names.join('\n')}` });
        } else {
          await interaction.reply({ content: 'No one has voted in the Sudden Death round yet.' });
        }
      } else {
        if (poll.votes && Object.keys(poll.votes).length > 0) {
          const names = await Promise.all(
            Object.keys(poll.votes).map(userId =>
              getDisplayName(interaction.client, userId)
            )
          );
          await interaction.reply({ content: `Users who have voted:\n${names.join('\n')}` });
        } else {
          await interaction.reply({ content: 'No one has voted yet.' });
        }
      }
      return;
    }

    await interaction.reply({ content: 'There is currently no active poll to check.' });
  },
};
