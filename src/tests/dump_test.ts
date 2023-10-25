import { PysakaLogger } from '../logger';

const logger = new PysakaLogger();

logger.log('-------------------->');

let i = 0;

const id = setInterval(() => {
  logger.log('step: ', i, '    ' + '*'.repeat(1e3));
  i++;
  if (i === 10) {
    process.stdout.cork();
  }
  if (i === 70) {
    process.stdout.uncork();
  }
  if (i === 110) {
    process.stdout.cork();
  }
  if (i === 170) {
    process.stdout.uncork();
  }
  if (i === 180) {
    clearInterval(id);
  }
}, 50);

logger.log('<--------------------');
