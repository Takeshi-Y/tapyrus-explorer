const log4js = require('log4js');
const { createCache } = require('../libs/cache');

log4js.configure({
  appenders: {
    everything: { type: 'file', filename: 'logs.log' }
  },
  categories: {
    default: { appenders: ['everything'], level: 'error' }
  }
});
const logger = log4js.getLogger();

createCache()
  .then()
  .catch(error => {
    logger.error(`Error caching trasactions. Error Message - ${error.message}`);
  });
