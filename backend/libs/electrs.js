const config = require('./config');
const jayson = require('jayson/promise');
const client = jayson.client.tcp(config.electrs);
const bitcoin = require('bitcoinjs-lib');
const crypto = require('crypto');

const request = (methodName, params) => {
  return new Promise((resolve, reject) => {
    client
      .request(methodName, params)
      .then(response => {
        resolve(response.result);
      })
      .catch(error => {
        reject(error);
      });
  });
};

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

const convertToScriptHash = address => {
  const p2pkh = bitcoin.payments.p2pkh({ address });
  const buf = Buffer.from(p2pkh.output, 'hex');
  const sha256 = crypto.createHash('sha256');

  return sha256.update(buf).digest().reverse().toString('hex');
};

module.exports = {
  client,
  convertToScriptHash,
  ...methods
};
