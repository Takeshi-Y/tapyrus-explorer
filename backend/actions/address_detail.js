const path = require('path');
const Jssha = require('jssha');
const log4js = require('log4js');
var flatCache = require('flat-cache');

const app = require('../app.js');

const cl = require('../libs/tapyrusd').client;
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

async function getBlockchainInfo() {
  const result = await cl.getBlockchainInfo();
  return result.headers;
}

async function getBlockWithTx(blockNum) {
  const blockHash = await cl.getBlockHash(blockNum);
  const result = await cl.getBlock(blockHash);
  return result;
}

function sha256(text) {
  const hashFunction = new Jssha('SHA-256', 'HEX');
  hashFunction.update(text);
  return hashFunction.getHash('HEX');
}

function convertP2PKHHash(p2pkh) {
  const hash = sha256(p2pkh);
  let newHash = '';
  for (let i = hash.length - 2; i >= 0; i -= 2) {
    newHash = newHash.concat(hash.slice(i, i + 2));
  }
  return newHash;
}

const createCache = function () {
  return new Promise((resolve, reject) => {
    try {
      const cache = flatCache.load(
        'transactionCache',
        path.resolve('./tmp/cache')
      );

      getBlockchainInfo().then(async bestBlockHeight => {
        let count = 0;
        let cacheBestBlockHeight = cache.getKey(`bestBlockHeight`);
        //bestBlockHeight = bestBlockHeight - 40000;

        if (!cacheBestBlockHeight) cacheBestBlockHeight = 0;
        else if (cacheBestBlockHeight == bestBlockHeight) {
          return resolve();
        } else {
          cacheBestBlockHeight++;
          count = cache.getKey(`transactionCount`);
        }
        while (cacheBestBlockHeight <= bestBlockHeight) {
          const block = await getBlockWithTx(cacheBestBlockHeight);

          for (let i = 0; i < block.nTx; i++) {
            cache.setKey(`${count++}`, block.tx[i]);

            await electrs.blockchain.transaction
              .get(block.tx[i], true)
              .then(async response => {
                const responses = [response];

                for (var vin of responses[0].vin) {
                  if (vin.txid) {
                    await electrs.blockchain.transaction
                      .get(vin.txid, true)
                      .then(response => {
                        const vinResponses = [response];

                        for (let vout of vinResponses[0].vout) {
                          for (let address of vout.scriptPubKey.addresses) {
                            //flag to represent the availability of this address in the vout of original Transaction
                            let isPresent = false;

                            for (let originalVout of responses[0]['vout']) {
                              //avoiding multiple entries of the same address for transaction cache
                              if (
                                originalVout.scriptPubKey.addresses &&
                                originalVout.scriptPubKey.addresses.indexOf(
                                  address
                                )
                              ) {
                                isPresent = true;
                                break;
                              }
                            }

                            if (isPresent) {
                              continue;
                            }

                            let addressTxCount = cache.getKey(
                              `${address}_count`
                            );

                            if (!addressTxCount && addressTxCount !== 0)
                              addressTxCount = -1;

                            addressTxCount++;
                            cache.setKey(
                              `${address}_${addressTxCount}`,
                              block.tx[i]
                            );
                            cache.setKey(`${address}_count`, addressTxCount);
                            cache.save(true /* noPrune */);
                          }
                        }
                      });
                  }
                }

                for (let vout of responses[0]['vout']) {
                  if (vout.scriptPubKey.addresses) {
                    for (let address of vout.scriptPubKey.addresses) {
                      let addressTxCount = cache.getKey(`${address}_count`);

                      if (!addressTxCount && addressTxCount !== 0)
                        addressTxCount = -1;

                      addressTxCount++;
                      cache.setKey(`${address}_${addressTxCount}`, block.tx[i]);
                      cache.setKey(`${address}_count`, addressTxCount);

                      let addressReceived = cache.getKey(`${address}_received`);
                      if (!addressReceived) addressReceived = 0;

                      addressReceived += vout.value;
                      cache.setKey(`${address}_received`, addressReceived);

                      cache.save(true /* noPrune */);
                    }
                  }
                }
              });
          }

          cacheBestBlockHeight++;
        }

        cache.setKey('bestBlockHeight', bestBlockHeight);
        cache.setKey('transactionCount', count);

        console.log('Updated cache till block height -> ', bestBlockHeight);
        console.log('New transaction count -> ', count);

        cache.save(true /* noPrune */);
        return resolve();
      });
    } catch (err) {
      return reject(err);
    }
  });
};

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
    const bestBlockHeight = await getBlockchainInfo();
    await createCache();
    const cache = flatCache.load(
      'transactionCache',
      path.resolve('./tmp/cache')
    );

    if (cache.getKey(`bestBlockHeight`) !== bestBlockHeight) {
      throw new Error('Best block height unmatch.');
    }

    const addressInfo = await cl.command([
      {
        //wallet rpc
        method: 'getAddressInfo',
        parameters: {
          address: urlAddress
        }
      }
    ]);

    const scriptPubKey = addressInfo[0].scriptPubKey;
    const revHash = convertP2PKHHash(scriptPubKey);
    const balances = await electrs.blockchain.scripthash.get_balance(revHash);
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

      const block = await cl.command([
        {
          method: 'getBlock',
          parameters: {
            blockhash: tx.blockhash
          }
        }
      ]);
      const blockHeight = block[0].height;

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
          blockheight: blockHeight,
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
