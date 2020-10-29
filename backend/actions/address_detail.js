const path = require('path');
const Jssha = require('jssha');
const log4js = require('log4js');
var flatCache = require('flat-cache');

const app = require('../app.js');

const cl = require('../libs/tapyrusd').client;
const electrs = require('../libs/electrs');
const elect = electrs.client;

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

async function getBalance(scriptPubKey) {
  const revHash = convertP2PKHHash(scriptPubKey);
  const balance = await electrs.blockchain.scripthash.get_balance(revHash);

  return { result: balance };
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

app.get('/address/:address', (req, res) => {
  var perPage = Number(req.query.perPage);
  var page = Number(req.query.page);

  const regex = new RegExp(/^[0-9a-zA-Z]{26,35}$/);
  const urlAddress = req.params.address;

  if (!regex.test(urlAddress)) {
    logger.error(`Regex Test didn't pass for URL - /address/${urlAddress}`);

    res.status(400).send('Bad request');
    return;
  }

  getBlockchainInfo()
    .then(async bestBlockHeight => {
      createCache().then(async () => {
        const cache = flatCache.load(
          'transactionCache',
          path.resolve('./tmp/cache')
        );
        //bestBlockHeight = bestBlockHeight - 40000;

        // bitcoin-cli listreceivedbyaddress 0 true true  bcrt1q83ttww2z7d20gwsze4eq9py5s45j48y7smvtdc
        cl.command([
          {
            //wallet rpc
            method: 'getAddressInfo',
            parameters: {
              address: urlAddress
            }
          }
        ])
          .then(async responses => {
            if (cache.getKey(`bestBlockHeight`) === bestBlockHeight) {
              let transactions = [];
              const scriptPubKey = responses[0].scriptPubKey;

              const balance = await getBalance(scriptPubKey);
              if (balance.result.length === 0) {
                responses[0] = 0;
              } else responses[0] = balance.result[0].confirmed;

              const addressTransCount = cache.getKey(`${urlAddress}_count`);

              var startFromTrans = addressTransCount - perPage * page + 1;

              if (startFromTrans < 0) {
                //if last page's remainder should use different value of startFromBlock and perPage
                startFromTrans = 0;
                perPage = (addressTransCount + 1) % perPage;
              }

              for (let i = startFromTrans; i < startFromTrans + perPage; i++) {
                const transId = cache.getKey(`${urlAddress}_${i}`);
                await electrs.blockchain.transaction
                  .get(transId, true)
                  .then(response => {
                    const transResponse = [response];

                    cl.command([
                      {
                        method: 'getBlock',
                        parameters: {
                          blockhash: transResponse[0].blockhash
                        }
                      }
                    ]).then(async blockResponse => {
                      transResponse[0]['blockheight'] = blockResponse[0].height;

                      let results = [];

                      for (var vin of transResponse[0].vin) {
                        if (vin.txid) {
                          await electrs.blockchain.transaction
                            .get(vin.txid, true)
                            .then(response => {
                              const vinResponses = [response];

                              for (let vout of vinResponses[0].vout) {
                                for (let address of vout.scriptPubKey.addresses)
                                  results.push(address);
                              }
                            });
                        } else {
                          results.push('');
                        }
                      }
                      transResponse[0]['inputs'] = results;

                      transactions.push(transResponse[0]);
                      if (transactions.length == perPage) {
                        transactions = transactions.sort(
                          (transaction1, transaction2) =>
                            transaction2.time - transaction1.time
                        );
                        responses[3] = addressTransCount + 1;
                        responses[1] = transactions;
                        responses[2] = cache.getKey(`${urlAddress}_received`);
                        res.json(responses);
                      }
                    });
                  });
              }
            }
          })
          .catch(err => {
            logger.error(
              `Error retrieving information for addresss - ${urlAddress}. Error Message - ${err.message}`
            );
          });
      });
    })
    .catch(err => {
      logger.error(
        `Error retrieving information for addresss - ${urlAddress}. Error Message - ${err.message}`
      );
    });
});
