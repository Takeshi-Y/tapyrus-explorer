const environment = require('../environments/environment');
const config = require(environment.CONFIG);

const client = jayson.client.tcp(config.electrs);

function getRawTransaction(txid) {
  return new Promise(resolve => {
    client
      .request('blockchain.transaction.get', [txid, true])
      .then(response => {
        resolve([response.result]);
      });
  });
}

module.exports = {
  client
};
