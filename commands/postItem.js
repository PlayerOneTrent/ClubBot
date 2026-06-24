// postPollItem.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { readPollsData } = require('../lib/pollStore');
const { searchMovie } = require('../services/movieService');
const { getBookDetails } = require('../services/bookService');
const { audibleLinks, movieTrailers } = require('../lib/stateManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('postitem')
        .setDescription('Posts detailed information about a specific poll item')
        .addStringOption(option =>
            option.setName('item')
            .setDescription('The letter of the poll item (e.g., A, B, C)')
            .setRequired(true)),
    async execute(interaction) {
        const itemLetter = interaction.options.getString('item').trim().toUpperCase();
        const itemIndex = itemLetter.charCodeAt(0) - 65; // Convert letter to index (A -> 0, B -> 1, etc.)
        const channelId = interaction.channelId;

        const pollsData = readPollsData();
        const poll = pollsData.polls.find(p => p.channelId === channelId && p.isFinalized && !p.isClosed);

        if (!poll) {
            await interaction.reply({ content: 'No poll found in this channel.', ephemeral: true });
            return;
        }

        if (!poll.isFinalized || poll.isClosed) {
            let statusMessage = poll.isClosed 
                ? 'The poll in this channel is closed.'
                : 'Current poll is not finalized.';
            await interaction.reply({ content: statusMessage, ephemeral: true });
            return;
        }

        const relevantItems = poll.isSuddenDeath ? poll.suddenDeathItems : poll.items;

        if (itemIndex < 0 || itemIndex >= relevantItems.length) {
          await interaction.reply({ content: 'Invalid poll item letter.', ephemeral: true });
          return;
        }   

        const pollItem = relevantItems[itemIndex];


        if (pollItem.type === 'movie') {
          const movieInfo = await searchMovie(pollItem.id, true);

          if (!movieInfo) {
              await interaction.reply({ content: 'Movie details not found.', ephemeral: true });
              return;
          }

          let movieDirector = 'No director listed.';
            let cast = 'No cast listed';
            let movieBackground = '';
            let genres = '';
            let runtime = 'Not listed';
            let tvdbUrl = 'https://thetvdb.com/movies/';

            if (movieInfo.runtime) {
                const hours = Math.floor(movieInfo.runtime / 60);
                const minutes = movieInfo.runtime % 60;
                runtime = `${hours > 0 ? `${hours}h ` : ''}${minutes}m`;
            }

            if (movieInfo != null) {
                movieDirector = movieInfo.director ? movieInfo.director : 'No director listed.';
                tvdbUrl += movieInfo.slug ? movieInfo.slug : ''

                if (movieInfo.runtime) {
                    const hours = Math.floor(movieInfo.runtime / 60);
                    const minutes = movieInfo.runtime % 60;
                    runtime = `${hours > 0 ? `${hours}h ` : ''}${minutes}m`;
                }
 
                movieTrailers.set(interaction.id, movieInfo.trailers);
            }

            if (movieInfo != null && movieInfo.genres && movieInfo.genres.length > 0) {
                // Assuming each genre object has a property 'name' that holds the genre's name
                genres = movieInfo.genres.map((genre, index) => 
                    genre.name + (index < movieInfo.genres.length - 1 ? '\n' : '')
                ).join('');
            } else {
                genres = 'No genres listed.';
            }
            
            // Set movie director and cast
            if (movieInfo != null && movieInfo.characters && movieInfo.characters.length > 0) {
                // Find and return the director or default if not found.
                const director = movieInfo.characters.find(character => character.peopleType === 'Director');
                movieDirector = director ? `${director.personName}` : 'No director listed.';

                // Return up to the first five actors listed in the array for the movie, and set them with linebreaks.
                const actors = movieInfo.characters.filter(character => character.peopleType === 'Actor').slice(0, 5);
                if (actors.length > 0) {
                    cast = actors.map((actor, index) => actor.personName + ' - ' + actor.name + (index < actors.length - 1 ? '\n' : '')).join('');
                }
            }
            // Check if movieInfo and its artwork array are not null and have elements
            if (movieInfo != null && movieInfo.artworks && movieInfo.artworks.length > 0) {
                // Find the first artwork of type 15 (background)
                const backgroundArtwork = movieInfo.artworks.find(artwork => artwork.type == 15);
                
                // If found, use its URL, otherwise default to movieInfo.image
                movieBackground = backgroundArtwork ? backgroundArtwork.thumbnail : movieInfo.image;
            } else {
                // If no artwork array is available, use movieInfo.image
                movieBackground = movieInfo.image;
            }
        
            // Embed
            const movieEmbed  = new EmbedBuilder()
                .setColor('#0099FF')
                .setAuthor({
                    name: movieInfo.title + ' (' + movieInfo.year + ')',
                    iconURL: 'https://thetvdb.com/images/icon.png',
                    url: tvdbUrl,
                })  
                .setDescription(pollItem.description ? pollItem.description : movieInfo.overview) 
                .setImage(movieBackground)
                .setThumbnail(movieInfo.image)
                .setTimestamp()
                .addFields(
                    {name: 'Runtime:    ⏰', value: runtime, inline: true},
                    { name: '\u200B', value: '\u200B', inline: true },
                    {name: 'Genres:    🎭', value: genres, inline: true},
                    {name: 'Director:    🎬', value: movieDirector, inline: true},
                    { name: '\u200B', value: '\u200B', inline: true },
                    {name: 'Cast:    👥', value: cast, inline: true},)
                .setFooter({ text: 'Movie information provided by TheTVDB' });
        
            // Button
            const movieRow = new ActionRowBuilder()
                            .addComponents(
                              new ButtonBuilder()
                                  .setCustomId('play_trailer')
                                  .setLabel('Send the Trailer')
                                  .setStyle(ButtonStyle.Primary)
                                  .setEmoji('▶️')
                            );
        
            await interaction.reply({ embeds: [movieEmbed], components: [movieRow] });

          } else if (pollItem.type === 'book') {
            const bookDetails = await getBookDetails(pollItem.id);

            if (!bookDetails) {
                await interaction.reply({ content: 'Book details not found.', ephemeral: true });
                return;
            }

            // Construct book embed
            const bookEmbed = new EmbedBuilder()
            .setAuthor(
                {
                    name: bookDetails.title,
                    url: bookDetails.bookUrl,
                    iconURL: 'https://books.google.com/googlebooks/images/material/book_icon_color.png',
                }
            )
            .setDescription(pollItem.description ? pollItem.description : bookDetails.description)
            .addFields(
                { name: 'Author    ✍️', value: bookDetails.authors, inline: true },
                { name: '\u200B', value: '\u200B', inline: true },
                { name: 'Categories    🏷️', value: bookDetails.categories, inline: true },
                { name: 'Page Count    📄', value: bookDetails.pageCount.toString(), inline: true },
                { name: '\u200B', value: '\u200B', inline: true },
                { name: 'Avg. Read Time    ⏳', value: bookDetails.averageReadTime, inline: true},
            )
            .setThumbnail(bookDetails.thumbnail)
            .setImage(bookDetails.image)
            .setColor('#0099FF');
            // Generate the Audible search link
            const audibleSearchLink = `https://www.audible.com/search?keywords=${encodeURIComponent(bookDetails.title + ' ' + bookDetails.authors)}`;

            // Store the interaction ID and Audible link
            audibleLinks.set(interaction.id, audibleSearchLink);

            const customEmojiId = '1193351065786142750'; 

            const bookRow = new ActionRowBuilder()
                            .addComponents(
                              new ButtonBuilder()
                                  .setLabel('Find on Audible')
                                  .setStyle(ButtonStyle.Link) // This style allows for a URL
                                  .setEmoji(customEmojiId)
                                  .setURL(audibleSearchLink) // Replace with your actual URL
                            );

            await interaction.reply({ embeds: [bookEmbed], components: [bookRow] });
        } else if (pollItem.type === 'theme') {
            const themeEmbed = new EmbedBuilder()
                .setColor('#0099FF')
                .setTitle(pollItem.name)
                .setDescription(pollItem.description ? pollItem.description : 'No description provided.')
                .setTimestamp();

            await interaction.reply({ embeds: [themeEmbed] });
        } else {
            await interaction.reply({ content: 'Unsupported poll item type.', ephemeral: true });
        }
    },
};

