const path = require('path');
const app = require('../app.js');
const log4js = require('log4js');
const flatCache = require('flat-cache');

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

async function getBlockchainInfo() {
  const result = await cl.getBlockchainInfo();
  return result.headers;
}

async function getTxCount() {
  const result = await cl.getChainTxStats();
  return result.txcount;
}

async function getBlockWithTx(blockNum) {
  const blockHash = await cl.getBlockHash(blockNum);
  const result = await cl.getBlock(blockHash);
  return result;
}

async function getMemTx() {
  const result = await cl.getRawMempool();
  const list = result.map(tx => electrs.blockchain.transaction.get(tx, true));

  const memTxArray = await Promise.all(list);

  const memEntryArray = memTxArray.map(trans => {
    const response = cl.command([
      {
        method: 'getmempoolentry',
        parameters: {
          txid: trans.txid
        }
      }
    ]);
    return response;
  });

  const entryPromiseArray = await Promise.all(memEntryArray);
  const finalArray = memTxArray.map((trans, idx) => {
    trans.time = entryPromiseArray[idx][0].time;
    return trans;
  });

  return finalArray.sort((a, b) => b.time - a.time);
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

app.get('/transactions', (req, res) => {
  //Return a List of transactions
  try {
    var perPage = Number(req.query.perPage);
    var page = Number(req.query.page);

    getTxCount().then(txCount => {
      getBlockchainInfo().then(async bestBlockHeight => {
        //bestBlockHeight = bestBlockHeight - 40000;

        createCache().then(async () => {
          const cache = flatCache.load(
            'transactionCache',
            path.resolve('./tmp/cache')
          );

          let count = 0,
            transList = [];
          const memTxList = await getMemTx();
          if (memTxList.length > perPage * (page - 1)) {
            let j = perPage * (page - 1);
            while (j < memTxList.length) {
              let amount = 0;
              memTxList[j].vout.forEach(vout => {
                amount += vout.value;
              });
              memTxList[j].amount = amount;
              memTxList[j].confirmations = 0;
              transList.push(memTxList[j]);
              j++;
              count++;
              if (count == perPage) {
                break;
              }
            }
          }

          if (cache.getKey(`bestBlockHeight`) === bestBlockHeight) {
            const transactionCount = txCount;
            var startingTrans = transactionCount - perPage * page;

            if (startingTrans < 0) {
              //if last page's remainder should use different value of startingTrans and perPage
              startingTrans = 0;
              perPage = transactionCount % perPage;
            }

            for (let i = startingTrans + perPage - 1; i >= startingTrans; i--) {
              let amount = 0;
              const trans = await electrs.blockchain.transaction
                .get(cache.getKey(i), true)

              trans.vout.forEach(vout => {
                amount += vout.value;
              });
              trans.amount = amount;
              transList.push(trans);
              count++;
              if (count == perPage) {
                break;
              }
            }
            res.json({
              results: transList,
              txCount
            });
            return;
          } else {
            throw "Cache's best Block Height is not updated";
          }
        });
      });
    });
  } catch (err) {
    logger.error(
      `Error retrieving ${perPage} transactions for page#${page}. Error Message - ${err.message}`
    );
    res.status(500).send(`Error Retrieving Blocks`);
  }
});
