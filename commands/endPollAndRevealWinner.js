// endPollAndRevealWinner.js

const { SlashCommandBuilder } = require('@discordjs/builders');
const { readPollsData, writePollsData } = require('../lib/pollStore');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getBookDetails } = require('../services/bookService');
const { searchMovie } = require('../services/movieService');
const { audibleLinks, movieTrailers } = require('../lib/stateManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('endpollandrevealwinner')
        .setDescription('Ends the poll and reveals the winner of the voting!'),
    async execute(interaction) {
        const channelId = interaction.channelId;
        const pollsData = readPollsData();
        const poll = pollsData.polls.find(p => p.channelId === channelId && p.isFinalized && !p.isClosed);
        const totalSuddenDeathVotes = {};
        const totalRegularVotes = {};

        if (!poll) {
            await interaction.reply({ content: 'No finalized and open poll found in this channel.', ephemeral: true });
            return;
        }

        const votesSource = poll.isSuddenDeath ? poll.suddenDeathVotes : poll.votes;

        if (!votesSource || Object.keys(votesSource).length === 0) {
            await interaction.reply({ content: "There are no votes for the current active poll.", ephemeral: true });
            return;
        }

        const voteCounts = {};
        Object.entries(votesSource).forEach(([userId, userVotes]) => {
            for (const itemId in userVotes) {
                voteCounts[itemId] = (voteCounts[itemId] || 0) + userVotes[itemId];
            }
        });

        // Find the item with the highest vote count
        let maxVotes = 0;
        let winningItemId = null;
        for (const itemId in voteCounts) {
            if (voteCounts[itemId] > maxVotes) {
                maxVotes = voteCounts[itemId];
                winningItemId = itemId;
            }
        }

        // Check for tie
        const tiedItems = Object.entries(voteCounts)
        .filter(([itemId, count]) => count === maxVotes)
        .map(([itemId]) => poll.items.find(item => item.id === itemId));

        if (tiedItems.length > 1) {
            if (poll.isSuddenDeath) {
                delete poll.suddenDeathVotes;
                await interaction.reply({ content: 'Tie again! Please discuss and we\'ll try again.' });
            } else {
                poll.isSuddenDeath = true;
                poll.suddenDeathItems = tiedItems; // Copying the entire item objects

                const embed = new EmbedBuilder()
                .setColor('#0099FF')
                .setTitle(`Sudden Death Round: ${poll.name}`)
                .setDescription('It\'s a tie! Sudden death round initiated with the tied items:')
                .addFields(tiedItems.map((item, index) => ({
                name: `${String.fromCharCode(65 + index)}. ${item.name}`,
                value: truncateString(item.description, 1024)
                })))
                .setTimestamp();

                await interaction.reply({ embeds: [embed], ephemeral: false });
            }
            poll.isClosed = false;
            writePollsData(pollsData);
            return;
        }

        const winner = poll.items.find(item => item.id === winningItemId);

        if (!winner) {
            // Handle where winner is not found
            await interaction.reply({ content: "Error: Winner not found. Please check the poll data.", ephemeral: true });
            return;
        }

        poll.isSuddenDeath = false;
        
        let winnerDetails, row;
        if (winner.type === 'book') {
            winnerDetails = await getBookDetails(winner.id);
        
            const audibleSearchLink = `https://www.audible.com/search?keywords=${encodeURIComponent(winnerDetails.title + ' ' + winnerDetails.authors)}`;
            audibleLinks.set(interaction.id, audibleSearchLink);
        
            const customEmojiId = '1193351065786142750'; 
        
            row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('Find on Audible')
                        .setStyle(ButtonStyle.Link)
                        .setURL(audibleSearchLink)
                        .setEmoji(customEmojiId)
                );
        } else if (winner.type === 'movie') {
            winnerDetails = await searchMovie(winner.id, true);
        
            movieTrailers.set(interaction.id, winnerDetails.trailers);
            row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('play_trailer')
                        .setLabel('Send the Trailer')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('▶️')
                );
        } else if (winner.type === 'theme') {
            winnerDetails = {
                title: winner.name,
                description: winner.description || 'No description provided.',
                thumbnail: null,
                image: null,
                url: null,
            };
            row = []; // no buttons
        }
                
        poll.isClosed = true;
       
        const winnerUrl =
        winner.type === 'book'
            ? winnerDetails.bookUrl
            : winner.type === 'movie'
            ? (winnerDetails.slug ? `https://thetvdb.com/movies/${winnerDetails.slug}` : null)
            : null;

        const rawDescription =
        (winner.description && winner.description.trim().length > 0)
            ? winner.description
            : (winnerDetails.overview && winnerDetails.overview.trim().length > 0)
            ? winnerDetails.overview
            : (winnerDetails.description && winnerDetails.description.trim().length > 0)
                ? winnerDetails.description
                : null;

        const descriptionText = rawDescription ? truncateString(rawDescription, 4096) : null;

        const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle(winnerDetails.title)
        .setAuthor({ name: `The ${poll.name} winner is:` })
        .setDescription(descriptionText);

        if (winnerUrl) embed.setURL(winnerUrl);
        if (winnerDetails.thumbnail) embed.setThumbnail(winnerDetails.thumbnail);
        if (winnerDetails.image) embed.setImage(winnerDetails.image);

        // Sum up sudden death votes for each item
        if (poll.suddenDeathVotes) {
            Object.values(poll.suddenDeathVotes).forEach(userVotes => {
                for (const itemId in userVotes) {
                    totalSuddenDeathVotes[itemId] = (totalSuddenDeathVotes[itemId] || 0) + userVotes[itemId];
                }
            });
        }

        Object.values(poll.votes).forEach(userVotes => {
            for (const itemId in userVotes) {
                totalRegularVotes[itemId] = (totalRegularVotes[itemId] || 0) + userVotes[itemId];
            }
        });

        // Create an array to store items with their total scores
        let itemsWithScores = poll.items.map(item => {
            const suddenDeathScore = totalSuddenDeathVotes[item.id] || 0;
            const originalScore = totalRegularVotes[item.id] || 0;
            return {
                id: item.id,
                name: item.name,
                suddenDeathScore: suddenDeathScore,
                originalScore: originalScore,
                totalScore: suddenDeathScore + originalScore,
                isSuddenDeathItem: poll.suddenDeathItems.some(sdItem => sdItem.id === item.id)
            };
        });

        // Sort the items by total score in descending order
        itemsWithScores.sort((a, b) => b.totalScore - a.totalScore);

        // Add fields to the embed with ordinal ranks
        itemsWithScores.forEach((item, index) => {
            const rank = index + 1;
            const ordinalRank = rank + getOrdinalSuffix(rank);
            const scoreText = item.isSuddenDeathItem ?
                `Sudden Death Score: ${item.suddenDeathScore}, Original Score: ${item.originalScore}` : 
                `Score: ${item.originalScore}`;
            const fieldName = `${ordinalRank} - ${item.name}` + (item.id === winner.id ? " (Winner)" : "");
            embed.addFields({ name: fieldName, value: scoreText, inline: false });
        });

        poll.isClosed = true;
        writePollsData(pollsData);
        
        if (row && row.length) {
            await interaction.reply({ embeds: [embed], components: [row] });
        } else {
            await interaction.reply({ embeds: [embed] });
        }
    },
};

function getOrdinalSuffix(i) {
    const j = i % 10,
        k = i % 100;
    if (j === 1 && k !== 11) {
        return "st";
    }
    if (j === 2 && k !== 12) {
        return "nd";
    }
    if (j === 3 && k !== 13) {
        return "rd";
    }
    return "th";
}

function truncateString(str, length) {
    if (str.length <= length) return str;
    return str.slice(0, length - 3) + '...';
}