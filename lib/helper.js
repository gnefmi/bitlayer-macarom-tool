const fs = require('fs').promises;

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
  readFileOrCreate
};