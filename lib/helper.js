const fs = require('fs').promises;
BigInt.prototype.toJSON = function() {
  return this.toString();
}

function getLocaleDateTime(date) {
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}-${date.getMinutes().toString().padStart(2, '0')}-${date.getSeconds().toString().padStart(2, '0')}`;
}

function parseToString(value) {
  if(typeof value === 'object') {
      return JSON.stringify(value);
  }
  return value;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function readFileOrCreate(path, initialContent) {
  try {
      // Try to read the file
      const data = await fs.readFile(path, 'utf8');
      return data;
  } catch (error) {
      if (error.code === 'ENOENT') {
          // If the file does not exist, create it and write some initial content
          await fs.writeFile(path, initialContent, 'utf8');
          return initialContent;
      } else {
          // Handle other possible errors
          console.error('An error occurred:', error);
      }
  }
}

module.exports = {
  parseToString,
  getLocaleDateTime,
  sleep,
  readFileOrCreate,
};