import {createDaemon} from './index.js'
import {logger} from './logger.js'

createDaemon()
  .start()
  .then(() => {
    logger.info('Daemon started - listening for changes in Kubernetes')
  })
  .catch((err) => {
    logger.error('Daemon failed to start: ', err)
  })
