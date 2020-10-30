const log4js = require('log4js');
const app = require('../app.js');
const electrs = require('../libs/electrs');

log4js.configure({
  appenders: {
    everything: { type: 'file', filename: 'logs.log' }
  },
  categories: {
    default: { appenders: ['everything'], level: 'error' }
  }
});
const logger = log4js.getLogger();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept'
  );
  next();
});

app.get('/transaction/:txid', async (req, res) => {
  const regex = new RegExp(/^[0-9a-fA-F]{64}$/);
  const urlTxid = req.params.txid;

  if (!regex.test(urlTxid)) {
    logger.error(`Regex Test didn't pass for URL - /transaction/${urlTxid}`);

    res.status(400).send('Bad request');
    return;
  }

  try {
    const tx = await electrs.blockchain.transaction.get(urlTxid, true);

    tx.vinRaw = tx.vin.map(async vin => {
      if (!vin.txid) return {};

      return await electrs.blockchain.transaction.get(vin.txid, true);
    });

    res.json(tx);
  } catch (error) {
    logger.error(
      `Error retrieving information for transaction - ${urlTxid}. Error Message - ${error.message}`
    );
  }
});

app.get('/transaction/:txid/rawData', async (req, res) => {
  const regex = new RegExp(/^[0-9a-fA-F]{64}$/);
  const urlTxid = req.params.txid;

  if (!regex.test(urlTxid)) {
    logger.error(
      `Regex Test didn't pass for URL - /transaction/${urlTxid}/rawData`
    );

    res.status(400).send('Bad request');
    return;
  }

  try {
    const tx = await electrs.blockchain.transaction.get(urlTxid, false);

    res.json(tx);
  } catch (error) {
    logger.error(
      `Error retrieving rawdata for transaction - ${urlTxid}. Error Message - ${error.message}`
    );
  }
});

app.get('/transaction/:txid/get', async (req, res) => {
  const urlTxid = req.params.txid;
  const regex = new RegExp(/^[0-9a-fA-F]{64}$/);

  if (!regex.test(urlTxid)) {
    logger.error(
      `Regex Test didn't pass for URL - /transaction/${urlTxid}/get`
    );

    res.status(400).send('Bad request');
    return;
  }

  try {
    const tx = await electrs.blockchain.transaction.get(urlTxid, true);

    res.json(tx);
  } catch (error) {
    logger.error(
      `Error calling the method gettransaction for transaction - ${urlTxid}. Error Message - ${error.message}`
    );
  }
});
