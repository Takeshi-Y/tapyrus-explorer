var flatCache = require('flat-cache');
const path = require('path');
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

async function getBlockchainInfo() {
  const result = await cl.getBlockchainInfo();
  return result.headers;
}

async function getBlockWithTx(blockNum) {
  const blockHash = await cl.getBlockHash(blockNum);
  const result = await cl.getBlock(blockHash);
  return result;
}

const createCache = function () {
  try {
    const cache = flatCache.load(
      'transactionCache',
      path.resolve('./tmp/cache')
    );

    getBlockchainInfo().then(async bestBlockHeight => {
      //bestBlockHeight = bestBlockHeight - 41300;

      let count = 0;
      let cacheBestBlockHeight = cache.getKey(`bestBlockHeight`);

      if (!cacheBestBlockHeight) cacheBestBlockHeight = 0;
      else if (cacheBestBlockHeight >= bestBlockHeight) {
        console.log('Cache is up-to-date');
        return;
      } else {
        cacheBestBlockHeight++;
        count = cache.getKey(`transactionCount`);
      }

      while (cacheBestBlockHeight <= bestBlockHeight) {
        console.log(cacheBestBlockHeight);
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
                      const vinResponses = [response];;

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

                          let addressTxCount = cache.getKey(`${address}_count`);

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
      cache.save(true /* noPrune */);

      console.log('Updated cache till block height -> ', bestBlockHeight);
      console.log('New transaction count -> ', count);
    });
  } catch (err) {
    console.log(`Error caching trasactions. Error Message - ${err.message}`);
    logger.error(`Error caching trasactions. Error Message - ${err.message}`);
  }
};

createCache();
