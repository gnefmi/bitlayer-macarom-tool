const fs = require('fs');
const { config } = require('../config');
const { parseToString } = require('./helper');

const logFile = fs.createWriteStream(config.logFilePath, { flags: 'a' });

const Logger = {
  log: function(...args) {
    console.log(...args);
    args.forEach(arg => logFile.write(`${parseToString(arg)}\n`));
  },
  logError: function(...args) {
    console.error(...args);
    logFile.write(`ERROR: ${args.map(v => v.toString()).join('\n')}\n`);
  },
}

module.exports = Logger;