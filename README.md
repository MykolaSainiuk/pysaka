## What again?
Another logger to offload the main thread of the main process to not affect the performance.

## How to install?

`npm i pysaka`

# How to use?

    import PysakaLogger from 'pysaka';

    const logger = new PysakaLogger();

    // do your stuff

    // in the end, please, close it
    logger.close();
    // or sync way
    logger.closeSync();


Voilà !
