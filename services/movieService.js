// Using the Freemium Model for TVDB API calls.
// Ability to search movies all thanks to TVDB and its API.
// movieService.js

const axios = require('axios');
require('dotenv').config();

async function searchMovie(query, isId) {
    console.log("Query: ", query);
    const token = process.env.TVDB_TOKEN;
    let url;
    let extendedMovie = {};

    if (isId) {
        // If query is an ID, use the extended movie endpoint
        url = `https://api4.thetvdb.com/v4/movies/${query}/extended`;
    } else {
        // If query is a string, use the search endpoint
        url = `https://api4.thetvdb.com/v4/search?query=${encodeURIComponent(query)}&type=movie`;
    }

    try {
        const response = await axios.get(url, {
            headers: {
                'accept': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const data = response.data;
        console.log("Movie Data: ", data)
        console.log("Here?")

        // Handling response from /movies/{id}/extended
        if (isId && data) {
            extendedMovie = data.data;
            let translation = 'eng';
            if (extendedMovie.nameTranslations && !extendedMovie.nameTranslations.includes('eng')) {
                translation = extendedMovie.nameTranslations[0];
            }
            console.log("Translations: ", extendedMovie.nameTranslations)
            const translationsUrl = `https://api4.thetvdb.com/v4/movies/${query}/translations/${translation}`;
            const translationResponse = await axios.get(translationsUrl, {
                headers: {
                    'accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            const translationData = translationResponse.data.data;
            extendedMovie.title = translationData && translationData.name ? translationData.name : extendedMovie.name ? extendedMovie.name : 'No title listed.';
            extendedMovie.overview = translationData && translationData.overview ? translationData.overview : extendedMovie.overview ? entendedMovie.overview : 'Overview not present in English.';
        } 
        // Handling response from /search
        else if (!isId && data && data.data.length > 0) {
            const movie = data.data[0];

            const extendedUrl = `https://api4.thetvdb.com/v4/movies/${movie.tvdb_id}/extended`;

            const extendedResponse = await axios.get(extendedUrl, {
                headers: {
                    'accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            extendedMovie = extendedResponse.data.data;
            extendedMovie.title = extendedMovie.translations && extendedMovie.translations.eng ? extendedMovie.translations.eng : extendedMovie.name ? extendedMovie.name : 'No title listed.';
            extendedMovie.overview = extendedMovie.overviews && extendedMovie.overviews.eng ? extendedMovie.overviews.eng : extendedMovie.overview ? entendedMovie.overview : 'Overview not present in English.';
        } else {
            return 'No movies found.';
        }

        return extendedMovie;

    } catch (error) {
        console.error('Error searching for movie:', error);
        return 'An error occurred while searching for the movie.';
    }
}

async function searchMovieSuggestions(query) {
    const token = process.env.TVDB_TOKEN;
    const url = `https://api4.thetvdb.com/v4/search?query=${encodeURIComponent(query)}&type=movie&limit=7`;

    try {
        const response = await axios.get(url, {
            headers: { 
                'accept': 'application/json',
                'Authorization': `Bearer ${token}` 
            }
        });

        const data = response.data;
        if (data && data.data.length > 0) {
            return data.data.slice(0, 7).map(movie => {
                let titleWithYear = (movie.translations && movie.translations.eng ? movie.translations.eng : movie.name) + (movie.year ? ` (${movie.year})` : '');
                titleWithYear = titleWithYear.length > 100 ? titleWithYear.substring(0, 97) + '...' : titleWithYear;
                return { title: titleWithYear, value: movie.tvdb_id };
            });
        } else {
            return [];
        }
    } catch (error) {
        console.error('Error searching for movie suggestions:', error);
        return [];
    }
}

module.exports = { searchMovie, searchMovieSuggestions };
