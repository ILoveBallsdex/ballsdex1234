const express = require('express');

function keepAlive() {
  const app = express();

  app.get('/', (req, res) => {
    res.send('Bot is alive!');
  });

  app.listen(3000, () => {
    console.log('Keep-alive server running on port 3000');
  });
}

module.exports = { keepAlive };
