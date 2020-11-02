const path = require('path');
const flatCache = require('flat-cache');
const tapyrusd = require('../libs/tapyrusd').client;
const electrs = require('../libs/electrs');
const logger = require('../libs/logger');

async function getBlockchainInfo() {
  const result = await tapyrusd.getBlockchainInfo();
  return result.headers;
}

async function getBlockWithTx(blockNum) {
  const blockHash = await tapyrusd.getBlockHash(blockNum);
  const result = await tapyrusd.getBlock(blockHash);
  return result;
}

const loadCache = () => {
  return flatCache.load('transactionCache', path.resolve('./tmp/cache'));
};

const createCache = async () => {
  return new Promise((resolve, reject) => {
    const cache = loadCache();

    getBlockchainInfo()
      .then(async bestBlockHeight => {
        let count = 0;
        let cacheBestBlockHeight = cache.getKey(`bestBlockHeight`);

        if (!cacheBestBlockHeight) cacheBestBlockHeight = 0;
        else if (cacheBestBlockHeight >= bestBlockHeight) {
          logger.info('Cache is up-to-date');
          return resolve(true);
        } else {
          cacheBestBlockHeight++;
          count = cache.getKey(`transactionCount`);
        }

        while (cacheBestBlockHeight <= bestBlockHeight) {
          logger.info('CurrentBlockHeight: ', cacheBestBlockHeight);
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
              })
              .catch(error => {
                reject(error);
              });
          }
          cacheBestBlockHeight++;
        }

        cache.setKey('bestBlockHeight', bestBlockHeight);
        cache.setKey('transactionCount', count);
        cache.save(true /* noPrune */);

        logger.info('Updated cache till block height -> ', bestBlockHeight);
        logger.info('New transaction count -> ', count);

        resolve(true);
      })
      .catch(error => {
        reject(error);
      });
  });
};

module.exports = {
  createCache,
  loadCache
};
