const crypto = require('crypto');
const app = require('../app.js');
const tapyrusd = require('../libs/tapyrusd').client;
const electrs = require('../libs/electrs');
const logger = require('../libs/logger');

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept'
  );
  next();
});

function internalByteOrder(hex) {
  const sha256 = text => {
    const sha256 = crypto.createHash('sha256');
    return sha256.update(Buffer.from(text, 'hex')).digest().toString('hex');
  };

  const calcHash = sha256(sha256(hex));
  const byteOrder = calcHash.match(/.{2}/g);
  let byteStr = '';
  for (let j = 31; j >= 0; j -= 1) {
    byteStr += byteOrder[j];
  }
  const header = byteStr;
  return header;
}

app.get('/blocks', async (req, res) => {
  let perPage = Number(req.query.perPage);
  const page = Number(req.query.page);

  try {
    const bestBlockHeight = await tapyrusd.getBlockCount();
    let startFromBlock = bestBlockHeight - perPage * page + 1;

    if (startFromBlock <= 0) {
      //if last page's remainder should use different value of startFromBlock and perPage
      startFromBlock = 0;
      perPage = (bestBlockHeight % perPage) + 1;
    }

    const headers = [];
    for (let i = startFromBlock; i < startFromBlock + perPage; i++) {
      const header = await electrs.blockchain.block.header(i);

      headers.push(header);
    }

    const promiseArray = headers.map(x =>
      tapyrusd.getBlock(internalByteOrder(x))
    );
    const result = await Promise.all(promiseArray);

    res.json({
      results: result,
      bestHeight: bestBlockHeight
    });
  } catch (err) {
    logger.error(
      `Error retrieving ${perPage} blocks for page#${page}. Error Message - ${err.message}`
    );
    res.status(500).send(`Error Retrieving Blocks`);
  }
});
