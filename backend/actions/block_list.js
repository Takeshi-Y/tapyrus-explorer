const Jssha = require('jssha');

const app = require('../app.js');

const cl = require('../libs/tapyrusd').client;
const electrs = require('../libs/electrs');

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept'
  );
  next();
});

var log4js = require('log4js');
var logger = log4js.getLogger();
logger.level = 'ERRORS';

function getBlock(blockHash) {
  const ret = cl.getBlock(blockHash);
  return ret;
}

function sha256(text) {
  const hashFunction = new Jssha('SHA-256', 'HEX');
  hashFunction.update(text);
  return hashFunction.getHash('HEX');
}

function internalByteOrder(hex) {
  const calcHash = sha256(sha256(hex));
  const byteOrder = calcHash.match(/.{2}/g);
  let byteStr = '';
  for (let j = 31; j >= 0; j -= 1) {
    byteStr += byteOrder[j];
  }
  const header = byteStr;
  return header;
}

async function getBlockchainInfo() {
  const result = await cl.getBlockchainInfo();
  return result.headers;
}

app.get('/blocks', (req, res) => {
  try {
    var perPage = Number(req.query.perPage);
    var page = Number(req.query.page);

    getBlockchainInfo()
      .then(async bestBlockHeight => {
        var startFromBlock = bestBlockHeight - perPage * page + 1;

        if (startFromBlock <= 0) {
          //if last page's remainder should use different value of startFromBlock and perPage
          startFromBlock = 0;
          perPage = (bestBlockHeight % perPage) + 1;
        }

        let headers = [];
        for (let i = startFromBlock; i < startFromBlock + perPage; i++) {
          const header = await electrs.blockchain.block.header(i);

          headers.push(header);
        }

        const promiseArray = headers.map(x => getBlock(internalByteOrder(x)));
        const result = await Promise.all(promiseArray);
        res.json({
          results: result,
          bestHeight: bestBlockHeight
        });
      })
      .catch(err => {
        logger.error(
          `Error retrieving ${perPage} blocks for page#${page}. Error Message - ${err.message}`
        );
      });
  } catch (err) {
    logger.error(
      `Error retrieving ${perPage} blocks for page#${page}. Error Message - ${err.message}`
    );
    res.status(500).send(`Error Retrieving Blocks`);
  }
});
