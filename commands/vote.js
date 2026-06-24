// vote.js
// /vote - Votes on current poll in a rank choice voting fashion. If there are four items, 
// then the person should be able to do /vote b, d, c, a. That means item b gets 4 points, 
// d gets 3 points, c gets 2 points, and a gets 1 point. When a vote is cast, it writes the 
// poll id, the votes and their points, and the person who did the voting.

const { SlashCommandBuilder } = require('@discordjs/builders');
const { readPollsData, writePollsData } = require('../lib/pollStore');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vote')
        .setDescription('Votes on the current poll in a rank choice voting fashion')
        .addStringOption(option =>
            option.setName('choices')
            .setDescription('Your ranked choices (e.g., "b, d, c, a" or "b d c a")')
            .setRequired(true)),
    async execute(interaction) {
        let choicesInput = interaction.options.getString('choices').split(/[\s,]+/).map(choice => choice.trim().toUpperCase());
        const channelId = interaction.channelId;
        const userId = interaction.user.id;
        const globalName = interaction.user.globalName

        const pollsData = readPollsData();
        const poll = pollsData.polls.find(p => p.channelId === channelId && p.isFinalized && !p.isClosed);

        if (!poll) {
            await interaction.reply({ content: 'No finalized and open poll found in this channel.', ephemeral: true });
            return;
        }

        // Check if the poll is in sudden death round
        let previousVoteRetracted = false;
        if (poll.isSuddenDeath) {
            // Only consider sudden death votes if in sudden death round
            if (poll.suddenDeathVotes && poll.suddenDeathVotes[userId]) {
                delete poll.suddenDeathVotes[userId]; // Retract vote from sudden death round
                previousVoteRetracted = true;
            }
        } else {
            // Only consider regular votes if not in sudden death round
            if (poll.votes && poll.votes[userId]) {
                delete poll.votes[userId]; // Retract vote from regular round
                previousVoteRetracted = true;
            }
        }

        // Sudden death round specific logic
        if (poll.isSuddenDeath) {
            // Validate that all choices are in suddenDeathItems
            const validChoices = new Set(poll.suddenDeathItems.map((_, i) => String.fromCharCode(65 + i)));
            for (const choice of choicesInput) {
                if (!validChoices.has(choice)) {
                    await interaction.reply({ content: 'Invalid choices. Please vote only for the sudden death items.', ephemeral: true });
                    return;
                }
            }
        
            // Calculate points for sudden death votes
            const userVotes = {};
            choicesInput.forEach((choice, rank) => {
                const itemIndex = choice.charCodeAt(0) - 65;
                const itemId = poll.suddenDeathItems[itemIndex].id;
                userVotes[itemId] = poll.suddenDeathItems.length - rank;
            });
        
            // Record the user's sudden death votes
            if (!poll.suddenDeathVotes) {
                poll.suddenDeathVotes = {};
            }
            poll.suddenDeathVotes[userId] = userVotes;
        } else {
          // Regular voting round logic
          // Check for the correct number of votes
          if (choicesInput.length !== poll.items.length) {
              await interaction.reply({ content: `Please vote for exactly ${poll.items.length} items.`, ephemeral: true });
              return;
          }
      
          // Check for duplicate choices
          const uniqueChoices = new Set(choicesInput);
          if (uniqueChoices.size !== choicesInput.length) {
              await interaction.reply({ content: 'Duplicate choices detected. Please vote with unique choices for each item.', ephemeral: true });
              return;
          }
          
          // Validate choices and calculate points
          const totalItems = poll.items.length;
          const userVotes = {};
          let isValidChoices = true;
      
          choicesInput.forEach((choice, index) => {
              const itemIndex = choice.charCodeAt(0) - 65;
              if (itemIndex >= 0 && itemIndex < totalItems) {
                  userVotes[poll.items[itemIndex].id] = totalItems - index; // Assign points
              } else {
                  isValidChoices = false;
              }
          });
      
          // Check if all choices are valid
          if (!isValidChoices) {
              await interaction.reply({ content: 'Invalid choices. Please use the correct alphabetical signifiers.', ephemeral: true });
              return;
          }
      
          // Record votes for regular round
          if (!poll.votes) {
              poll.votes = {};
          }
          poll.votes[userId] = userVotes; // Recording votes
      }

        // Save the updated poll data
        writePollsData(pollsData);
        let replyMessage = 'Your vote has been recorded.';
        if (previousVoteRetracted) {
            replyMessage = 'Previous vote retracted, new vote submitted.';
        }
        await interaction.reply({ content: replyMessage, ephemeral: true });

        const displayName = interaction.user.globalName || interaction.user.username;
        const announcementMessage = `${displayName} has voted.`;
        try {
            await interaction.followUp({ content: announcementMessage, ephemeral: false });
        } catch (err) {
            console.error('Failed to post vote announcement:', err);
        }
    },
};
