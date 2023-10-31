# What again?
A logger to offload the main thread of the main process to not affect performance.

## Description

This logger is about logging your messages using streams via a separate Worker in order to offload the main thread, so even a serialization of log messages happen in the worker (however postMessage copying takes its price still).

### Features

to create an instance of the logger:
`new PysakaLogger();`

the constructor accepts such object as a param

    export type PysakaLoggerParams = {
        destination?: DestinationType;
        fallbackSupport?: boolean;
        severity?: SeverityLevelEnum;
        format?: PrintFormatEnum;
        prefix?: string;
        name?: string;
        debugLogs?: boolean;
        tempDirPath?: string;
    };

destination - must be Writable stream! Mostly I expect it's process.stdout, or file descriptor with write access.

fallbackSupport - flag which identifies do we support handling of "logs" logs in case if destination is not available temporarily.

severity - aka log level: 0 - debug, 1 - info, 2 - warn, 3 - error, 4 - fatal

format - two options: "json" or "text"

prefix - prefix for each log message. optional

name - name of the logger. optional
debugLogs - flag which identifies do we need to log debug logs. optional

tempDirPath - path to the temporary directory where logs will be stored in case if destination is not available temporarily. optional

# How to install?

`npm i pysaka`

## How to use?

*"Usual" code example*:

    import PysakaLogger from 'pysaka';

    const logger = new PysakaLogger();

    // log your stuff

    // in the end, please, close it
    // otherwise it will prevent the main process to be closed
    logger.close();
    // or sync way
    logger.closeSync();

## Key method logger.write()

    logger<write>('Hello world!');
or

    logger<write>('Hello world!', 'info');
or

    logger<write>('Hello world!', 'info', { some: 'data' });

you are not obliged to specify the first argument as string however it's advised to do.

where <write> is any of the following methods:

    logger.debug('Hello world!');
    logger.info('Hello world!');
    logger.log('Hello world!');
    logger.warn('Hello world!');
    logger.error('Hello world!');
    logger.fatal('Hello world!'); 

Voilà !
