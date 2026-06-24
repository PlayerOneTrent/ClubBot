// addBookItem.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { readPollsData, writePollsData } = require('../lib/pollStore');
const { searchBooks, getBookDetails } = require('../services/bookService');
const { audibleLinks } = require('../lib/stateManager');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function axiosWithBackoff(requestFn, { retries = 3 } = {}) {
  let attempt = 0;

  while (true) {
    try {
      return await requestFn();
    } catch (err) {
      const status = err?.response?.status;

      if (status !== 429 || attempt >= retries) throw err;

      const retryAfterHeader = err.response.headers?.['retry-after'];
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : null;

      const backoffMs = retryAfterMs ?? (500 * Math.pow(2, attempt) + Math.floor(Math.random() * 250));
      await sleep(backoffMs);

      attempt++;
    }
  }
}


module.exports = {
    data: new SlashCommandBuilder()
        .setName('addbook')
        .setDescription('Adds a book to the poll')
        .addStringOption(option => 
            option.setName('book')
            .setDescription('Type to find your pick and select from the list.')
            .setRequired(true)
            .setAutocomplete(true))
        .addStringOption(option =>
            option.setName('customdescription')
            .setDescription('Custom description of the book (optional)')
            .setRequired(false)),
    async execute(interaction) {
        const bookId = interaction.options.getString('book');
        const customDescription = interaction.options.getString('customdescription');
        const channelId = interaction.channelId;
        const userId = interaction.user.id;
        const globalName = interaction.user.globalName
        console.log("User: ", interaction.user)
        console.log("Book Id: ", bookId)

        const bookDetails = await getBookDetails(bookId);
        if (!bookDetails) {
            await interaction.reply({ content: 'Book not found.', ephemeral: true });
            return;
        }

        const pollsData = readPollsData();

        // Find an active (not finalized and not closed) poll in this channel
        const poll = pollsData.polls.find(p => p.channelId === channelId && !p.isFinalized && !p.isClosed);

        if (!poll) {
            await interaction.reply({ content: 'No poll found in this channel.', ephemeral: true });
            return;
        }

        if (poll.isFinalized && poll.isClosed) {
            await interaction.reply({ content: 'The poll in this channel is closed and cannot be modified.', ephemeral: true });
            return;
        }

        if (poll.isFinalized && !poll.isClosed) {
            await interaction.reply({ content: 'The poll in this channel is finalized and no longer accepting new items.', ephemeral: true });
            return;
        }

        // Check if the book already exists in the poll
        const bookAlreadyExists = poll.items.some(item => item.id === bookId && item.type === 'book');
        if (bookAlreadyExists) {
            await interaction.reply({ content: `That book already exists in the poll. Submit another one!`, ephemeral: true });
            return;
        }

        // Add book to the poll
        poll.items.push({
            id: bookId,
            type: 'book',
            name: bookDetails.title,
            description: customDescription || bookDetails.description,
            votes: {},
            addedBy: userId,
            userName: globalName
        });

        writePollsData(pollsData);

        const audibleSearchLink = `https://www.audible.com/search?keywords=${encodeURIComponent(bookDetails.title + ' ' + bookDetails.authors)}`;
        audibleLinks.set(interaction.id, audibleSearchLink);
        
        const bookEmbed = new EmbedBuilder()
            .setColor('#0099FF')
            .setAuthor({ name: bookDetails.title, url: bookDetails.bookUrl, iconURL: 'https://books.google.com/googlebooks/images/material/book_icon_color.png' })
            .setDescription(customDescription || bookDetails.description)
            .setThumbnail(bookDetails.thumbnail)
            .setImage(bookDetails.image)
            .addFields(
              { name: 'Author    ✍️', value: bookDetails.authors, inline: true },
              { name: '\u200B', value: '\u200B', inline: true },
              { name: 'Categories    🏷️', value: bookDetails.categories, inline: true },
              { name: 'Page Count    📄', value: bookDetails.pageCount.toString(), inline: true },
              { name: '\u200B', value: '\u200B', inline: true },
              { name: 'Avg. Read Time    ⏳', value: bookDetails.averageReadTime, inline: true},
          )
            .setFooter({ text: 'Book information provided by Google Books' });
        
        const customEmojiId = '1193351065786142750'; 
        const bookRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('Find on Audible')
                    .setStyle(ButtonStyle.Link)
                    .setURL(audibleSearchLink)
                    .setEmoji(customEmojiId)
            );
        
        // Instead of using `reply` again, use `followUp` for the announcement message
        await interaction.reply({ content: `The following has been added to the poll:`, ephemeral: true, embeds: [bookEmbed], components: [bookRow] });

        const announcementMessage = `${globalName} has added to the poll.`;
        await interaction.followUp({ content: announcementMessage, ephemeral: false });
    },
    async autocomplete(interaction) {
    const q = interaction.options.getFocused(true).value?.trim() ?? '';

    if (q.length < 3) {
        await interaction.respond([]);
        return;
    }

    const suggestions = await searchBooks(q);
    await interaction.respond(suggestions.slice(0, 5).map(b => ({ name: b.title, value: b.id })));
    }
};
