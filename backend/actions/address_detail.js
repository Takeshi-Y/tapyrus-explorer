const log4js = require('log4js');

const app = require('../app.js');

const { createCache, loadCache } = require('../libs/cache');
const tapyrusd = require('../libs/tapyrusd').client;
const electrs = require('../libs/electrs');

log4js.configure({
  appenders: {
    everything: { type: 'file', filename: 'logs.log' }
  },
  categories: {
    default: { appenders: ['everything'], level: 'error' }
  }
});

var logger = log4js.getLogger();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept'
  );
  next();
});

app.get('/address/:address', async (req, res) => {
  let perPage = Number(req.query.perPage);
  const page = Number(req.query.page);

  const regex = new RegExp(/^[0-9a-zA-Z]{26,35}$/);
  const urlAddress = req.params.address;

  if (!regex.test(urlAddress)) {
    logger.error(`Regex Test didn't pass for URL - /address/${urlAddress}`);

    res.status(400).send('Bad request');
    return;
  }

  try {
    await createCache();
    const cache = loadCache();

    const bestBlockHeight = await tapyrusd.getBlockCount();
    if (cache.getKey(`bestBlockHeight`) !== bestBlockHeight) {
      throw new Error('Best block height unmatch.');
    }

    const scriptHash = electrs.convertToScriptHash(urlAddress);
    const balances = await electrs.blockchain.scripthash.get_balance(
      scriptHash
    );
    const balance = (balances && balances[0] && balances[0].confirmed) || 0;

    const addressTxsCount = cache.getKey(`${urlAddress}_count`);

    let startFromTxs = addressTxsCount - perPage * page + 1;
    if (startFromTxs < 0) {
      //if last page's remainder should use different value of startFromBlock and perPage
      startFromTxs = 0;
      perPage = (addressTxsCount + 1) % perPage;
    }

    const transactions = [];
    for (let i = startFromTxs; i < startFromTxs + perPage; i++) {
      const txid = cache.getKey(`${urlAddress}_${i}`);
      const tx = await electrs.blockchain.transaction.get(txid, true);

      const block = await tapyrusd.getBlockByHash(tx.blockhash);

      const inputAddresses = [];
      tx.vin.forEach(async vin => {
        if (!vin.txid) {
          inputAddresses.push('');
          return;
        }

        const inputTx = await electrs.blockchain.transaction.get(
          vin.txid,
          true
        );
        inputTx.vout.forEach(vout => {
          vout.scriptPubKey.addresses.forEach(address => {
            inputAddresses.push(address);
          });
        });
      });

      transactions.push(
        Object.assign({}, tx, {
          blockheight: block.height,
          inputs: inputAddresses
        })
      );

      if (transactions.length == perPage) {
        res.json([
          balance,
          transactions.sort((tx1, tx2) => tx2.time - tx1.time),
          cache.getKey(`${urlAddress}_received`),
          addressTxsCount + 1
        ]);
      }
    }
  } catch (error) {
    logger.error(
      `Error retrieving information for addresss - ${urlAddress}. Error Message - ${error.message}`
    );
  }
});
