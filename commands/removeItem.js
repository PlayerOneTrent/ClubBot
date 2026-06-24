// removePollItem.js

const { SlashCommandBuilder } = require('@discordjs/builders');
const { readPollsData, writePollsData } = require('../lib/pollStore');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removeitem')
        .setDescription('Removes the most recent item you added to the current poll'),
    async execute(interaction) {
        const channelId = interaction.channelId;
        const userId = interaction.user.id; // Get the ID of the user who invoked the command
        const globalName = interaction.user.globalName
        const pollsData = readPollsData();
        const poll = pollsData.polls.find(p => p.channelId === channelId && !p.isFinalized && !p.isClosed);

        if (!poll) {
            await interaction.reply({ content: 'No active poll found in this channel or the poll is already finalized/closed.', ephemeral: true });
            return;
        }

        // Find the last item added by the user and get its index
        let userLastItemIndex = -1;
        let removedItemTitle = '';

        for (let i = poll.items.length - 1; i >= 0; i--) {
            if (poll.items[i].addedBy === userId) {
                userLastItemIndex = i;
                removedItemTitle = poll.items[i].name;
                break;
            }
        }

        if (userLastItemIndex === -1) {
            await interaction.reply({ content: 'You have no submitted items to remove in this poll.', ephemeral: true });
            return;
        }

        // Remove the item
        poll.items.splice(userLastItemIndex, 1);

        writePollsData(pollsData);
        await interaction.reply({ content: `Your most recent poll item "${removedItemTitle}" has been removed.`, ephemeral: true });

        const announcementMessage = `${globalName} has removed their last item from the poll.`;
        await interaction.followUp({ content: announcementMessage, ephemeral: false });
    },
};
