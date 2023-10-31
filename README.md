## What again?
Another? logger to offload the main thread of the main process to not affect performance.

## Description

This logger is about logging your messages using streams to s separate Worker in order to offload the main thread, so even a serialization of log messages happen in the worker (however postMessage copying takes its price).

In order to find out what does the logger support you are welcome to import its params via
`import type * from 'pysaka';`


## How to install?

`npm i pysaka`

# How to use?

*"Default" code example*:

    import PysakaLogger from 'pysaka';

    const logger = new PysakaLogger();

    // do your stuff

    // in the end, please, close it
    // otherwise it will prevent the main process to be closed
    logger.close();
    // or sync way
    logger.closeSync();

## Features



Voilà !
