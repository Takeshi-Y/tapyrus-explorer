const app = require('../app.js');
const log4js = require('log4js');

const cl = require('../libs/tapyrusd').client;

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

app.get('/transaction/:txid', (req, res) => {
  const regex = new RegExp(/^[0-9a-fA-F]{64}$/);
  const urlTxid = req.params.txid;

  if (!regex.test(urlTxid)) {
    logger.error(`Regex Test didn't pass for URL - /transaction/${urlTxid}`);

    res.status(400).send('Bad request');
    return;
  }

   electrs.blockchain.transaction
     .get(urlTxid, true)
     .then(async response => {
       let results = [];

       for (var vin of response.vin) {
         if (vin.txid) {
           await electrs.blockchain.transaction
             .get(vin.txid, true)
             .then(response => {
               results.push(response);
             });
         } else {
           results.push({});
         }
       }
       response.vinRaw = results;
       res.json(response);
     })
     .catch(err => {
       logger.error(
         `Error retrieving information for transaction - ${urlTxid}. Error Message - ${err.message}`
       );
     });
});

app.get('/transaction/:txid/rawData', (req, res) => {
  const regex = new RegExp(/^[0-9a-fA-F]{64}$/);
  const urlTxid = req.params.txid;

  if (!regex.test(urlTxid)) {
    logger.error(
      `Regex Test didn't pass for URL - /transaction/${urlTxid}/rawData`
    );

    res.status(400).send('Bad request');
    return;
  }

  electrs.blockchain.transaction
    .get(urlTxid, false)
    .then(response => {
      res.json(response);
    })
    .catch(err => {
      logger.error(
        `Error retrieving rawdata for transaction - ${urlTxid}. Error Message - ${err.message}`
      );
    });
});

app.get('/transaction/:txid/get', (req, res) => {
  const urlTxid = req.params.txid;
  const regex = new RegExp(/^[0-9a-fA-F]{64}$/);

  if (!regex.test(urlTxid)) {
    logger.error(
      `Regex Test didn't pass for URL - /transaction/${urlTxid}/get`
    );

    res.status(400).send('Bad request');
    return;
  }

  electrs.blockchain.transaction
    .get(urlTxid, true)
    .then(response => {
      res.json(response);
    })
    .catch(err => {
      logger.error(
        `Error calling the method gettransaction for transaction - ${urlTxid}. Error Message - ${err.message}`
      );
    });
});
