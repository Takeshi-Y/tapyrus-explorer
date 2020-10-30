const path = require('path');
const flatCache = require('flat-cache');
const tapyrusd = require('../libs/tapyrusd').client;
const electrs = require('../libs/electrs');
const logger = require('../libs/logger');

const loadCache = () => {
  return flatCache.load('transactionCache', path.resolve('./tmp/cache'));
};

const createCache = async () => {
  const bestBlockHeight = await tapyrusd.getBlockCount();

  const cache = loadCache();
  let cacheBestBlockHeight = cache.getKey(`bestBlockHeight`) || 0;
  if (cacheBestBlockHeight >= bestBlockHeight) {
    logger.info('Cache is up-to-date');
    return;
  }

  cacheBestBlockHeight++;
  let transactionCount = cache.getKey('transactionCount') || 0;

  while (cacheBestBlockHeight <= bestBlockHeight) {
    logger.info('current block height: ', cacheBestBlockHeight);

    const blockHash = await tapyrusd.getBlockHash(cacheBestBlockHeight);
    const block = await tapyrusd.getBlock(blockHash);

    block.tx.forEach(async txid => {
      cache.setKey(`${transactionCount++}`, txid);
      const tx = electrs.blockchain.transaction.get(txid, true);
      tx.vin.forEach(async vin => {
        if (!vin.txid) return;

        const vinTx = await electrs.blockchain.transaction.get(vin.txid, true);
        vinTx.vout.forEach(vout => {
          vout.scriptPubKey.addresses.forEach(address => {
            // flag to represent the availability of this address in the vout of original Transaction
            const addressIncluded = tx.vout.some(vout => {
              vout.scriptPubKey.addresses &&
                vout.scriptPubKey.addresses.includes(address);
            });
            if (addressIncluded) return;

            let addressTxCount = cache.getKey(`${address}_count`) || -1;
            addressTxCount++;

            cache.setKey(`${address}_${addressTxCount}`, txid);
            cache.setKey(`${address}_count`, addressTxCount);
            cache.save(true /* noPrune */);
          });
        });
      });

      tx.vout.forEach(async vout => {
        if (!vout.scriptPubKey.addresses) return;

        vout.scriptPubKey.addresses.forEach(address => {
          let addressTxCount = cache.getKey(`${address}_count`) || -1;
          addressTxCount++;

          cache.setKey(`${address}_${addressTxCount}`, txid);
          cache.setKey(`${address}_count`, addressTxCount);

          let addressReceived = cache.getKey(`${address}_received`) || 0;
          addressReceived += vout.value;
          cache.setKey(`${address}_received`, addressReceived);
          cache.save(true /* noPrune */);
        });
      });
    });

    cacheBestBlockHeight++;
  }

  cache.setKey('bestBlockHeight', bestBlockHeight);
  cache.setKey('transactionCount', transactionCount);

  logger.info('Updated cache till block height -> ', bestBlockHeight);
  logger.info('New transaction count -> ', transactionCount);

  cache.save(true /* noPrune */);
};

module.exports = {
  createCache,
  loadCache
};
