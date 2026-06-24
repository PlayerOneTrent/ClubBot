// PM2 process configuration. Secrets are read from the environment
// (see .env / .env.example) — never hardcode tokens in this committed file.
require('dotenv').config();

module.exports = {
  apps: [{
    name: 'ClubBot',
    script: './index.js',
    ignore_watch: ['node_modules', '*.json', 'logs'],
    env: {
      DISCORD_TOKEN: process.env.DISCORD_TOKEN,
      TVDB_TOKEN: process.env.TVDB_TOKEN,
      GOOGLE_BOOKS_TOKEN: process.env.GOOGLE_BOOKS_TOKEN,
      APP_ID: process.env.APP_ID
    }
  }]
};
