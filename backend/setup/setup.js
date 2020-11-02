const { createCache } = require('../libs/cache');

createCache().catch(error => {
  logger.error(error.message);
});
