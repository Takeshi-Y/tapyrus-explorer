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

app.get('/block/:blockHash', async (req, res) => {
  const regex = new RegExp(/^[0-9a-fA-F]{64}$/);
  const urlBlockHash = req.params.blockHash;

  if (!regex.test(urlBlockHash)) {
    logger.error(`Regex Test didn't pass for URL - /block/${urlBlockHash}`);

    res.status(400).send('Bad request');
    return;
  }

  try {
    const blockInfo = await tapyrusd.getBlock(urlBlockHash);

    res.json({
      blockHash: blockInfo.hash,
      ntx: blockInfo.nTx,
      height: blockInfo.height,
      timestamp: blockInfo.time,
      proof: blockInfo.proof,
      sizeBytes: blockInfo.size,
      version: blockInfo.features,
      merkleRoot: blockInfo.merkleroot,
      immutableMerkleRoot: blockInfo.immutablemerkleroot,
      previousBlock: blockInfo.previousblockhash,
      nextBlock: blockInfo.nextblockhash
    });
  } catch (err) {
    logger.error(
      `Error retrieving information for block  - ${urlBlockHash}. Error Message - ${err.message}`
    );
  }
});

// bitcoin-cli getblock ${blockHash} 0
app.get('/block/:blockHash/raw', async (req, res) => {
  const regex = new RegExp(/^[0-9a-fA-F]{64}$/);
  const urlBlockHash = req.params.blockHash;

  if (!regex.test(urlBlockHash)) {
    logger.error(`Regex Test didn't pass for URL - /block/${urlBlockHash}/raw`);

    res.status(400).send('Bad request');
    return;
  }

  try {
    const blockInfo = await tapyrusd.getBlock(urlBlockHash, 0);

    res.json(blockInfo);
  } catch (error) {
    logger.error(
      `Error retrieving raw data for block  - ${urlBlockHash}. Error Message - ${error.message}`
    );
  }
});

// bitcoin-cli getblock ${blockHash} 2
app.get('/block/:blockHash/txns', async (req, res) => {
  const regex = new RegExp(/^[0-9a-fA-F]{64}$/);
  const urlBlockHash = req.params.blockHash;

  if (!regex.test(urlBlockHash)) {
    logger.error(
      `Regex Test didn't pass for URL - /block/${urlBlockHash}/txns`
    );

    res.status(400).send('Bad request');
    return;
  }

  try {
    const blockInfo = await tapyrusd.getBlock(urlBlockHash, 2);

    blockInfo.tx.forEach(tx => {
      tx.vinRaw = tx.vin.map(async vin => {
        if (!vin.txid) return {};

        return await electrs.blockchain.transaction.get(vin.txid, true);
      });
    });

    res.json(blockInfo);
  } catch (error) {
    logger.error(
      `Error retrieving txns for block  - ${urlBlockHash}. Error Message - ${error.message}`
    );
  }
});
