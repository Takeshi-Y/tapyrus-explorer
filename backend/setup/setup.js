const { createCache } = require('../libs/cache');
const logger = require('../libs/logger');

createCache().catch(error => {
  logger.error(error.message);
});
