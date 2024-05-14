const fs = require('fs');

const defaultLogs = '';

const createFile = (file) => {
    // check if file exists
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, defaultLogs);
    }
};

module.exports = {
    createFile
};