const defaultConfig = {
  tapyrusd: {
    network: 'mainnet',
    username: process.env.TAPYRUSD_RPC_USER || 'rpcuser',
    password: process.env.TAPYRUSD_RPC_PASSWORD || 'rpcpassword',
    host: process.env.TAPYRUSD_RPC_HOST || 'localhost',
    port: process.env.TAPYRUSD_RPC_PORT || 2377
  },
  electrs: {
    host: process.env.ELECTRS_RPC_HOST || 'localhost',
    port: process.env.ELECTRS_RPC_PORT || 50001
  }
};

let config = defaultConfig;

try {
  const environment = require('../environments/environment');
  const environmentConfig = require(environment.CONFIG);

  config = Object.assign({}, defaultConfig, environmentConfig);
} catch (_) {
  config = defaultConfig;
}

module.exports = config;
