const config = require('./config')
const jayson = require('jayson/promise');
const client = jayson.client.tcp(config.electrs);

const request = (methodName, params) => {
  return new Promise((resolve, reject) => {
    client.request(methodName, params).then((response) => {
      resolve(response.result)
    }).catch((error) => {
      reject(error)
    })
  })
}

const methods = {
  blockchain: {
    block: {
      header: (height, cp_height = 0) =>
        request('blockchain.block.header', [height, cp_height])
    },
    scripthash: {
      get_balance: scriptHash =>
        request('blockchain.scripthash.get_balance', [scriptHash])
    },
    transaction: {
      get: (tx_hash, verbose = true) =>
        request('blockchain.transaction.get', [tx_hash, verbose])
    }
  }
};

module.exports = {
  client,
  ...methods
};
