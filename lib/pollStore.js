//pollStore.js

const fs = require('fs');
const path = require('path');
// polls.json lives at the project root; this module sits in lib/
const pollsFilePath = path.join(__dirname, '..', 'polls.json');

const readPollsData = () => {
    if (!fs.existsSync(pollsFilePath)) {
        fs.writeFileSync(pollsFilePath, JSON.stringify({ polls: [] }));
    }
    let data = JSON.parse(fs.readFileSync(pollsFilePath, 'utf8'));
    
    // Ensure data has a polls property and it is an array
    if (!data.polls || !Array.isArray(data.polls)) {
        data.polls = [];
    }

    return data;
};

const writePollsData = (data) => {
    fs.writeFileSync(pollsFilePath, JSON.stringify(data, null, 2));
};

module.exports = { readPollsData, writePollsData };
