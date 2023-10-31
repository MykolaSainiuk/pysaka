## What again?
Another logger to offload the main thread of the main process to not affect the performance of the main process & main thread

## How to install?

`npm i pysaka`

# How to use?

    import PysakaLogger from 'pysaka';

    const logger = new PysakaLogger();

    // do your stuff

    // in the end, please, close it
    // otherwise it will prevent the main process to be closed
    logger.close();
    // or sync way
    logger.closeSync();

Voilà !
