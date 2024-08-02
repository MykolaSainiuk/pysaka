# Another one?
A logger to offload the main thread of the main process in order not to affect performance.

## Why?

What do you need from a logger in Node.js world?

Obvious things:
- it must by async one (but async is very vague term) 
- it does log what you ask with any number of arguments
- it does not loose logs
  - won't loose it even if the destination (like stdout) is unavailable temporarily
- it supports json format (surprisingly not all of them do)
- *major one*-> it does not affect performance of the main process!

It is not BLAZINGLY fast logger because not that characteristic must be a key.
Look, you should do not care about speed of logging your messages, but you do care about speed/performance of your main process.

Pysaka does not eat/steal CPU time of your main thread of the main process. It delegates as much as possible, even serialization of a log message, to separate worker thread. It utilizes streams to the full because it's cheap from CPU & RAM perspective, and their are awesome in Node.js.
You are more than welcome to review the code base (it's tiny).

### Does do what I want
So open an issue on github and I will code it for you if it makes sense.

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
        name?: string;
        debugLogs?: boolean;
        tempDirPath?: string;
    };

destination - must be Writable stream! Mostly it's process.stdout, or file descriptor with write access.

fallbackSupport - flag which identifies is logs backup needed in case if destination is not available temporarily. It preserves logs in the temporary file until your main code repairs the destination. Useful much if `destination` is Socket which points to another server.

severity - aka log level: 0 - debug, 1 - info, 2 - warn, 3 - error, 4 - fatal

format - two options: "json" or "text". JSON is for exporting and performance, text is for human readability, with colors.

name - name of the logger. optional

debugLogs - flag which identifies do we need to log also debug logs of the logger itself. Internal usage mostly

tempDirPath - a path to the temporary dir where logs will be stored if the destination is not available temporarily. Makes sense only if `fallbackSupport` is true.

# How to install?

`npm i pysaka`

## How to use?

*"Usual" code example*:

    import PysakaLogger from 'pysaka';

    const logger = new PysakaLogger();

    // log your stuff

    // in the end, please, close it
    // otherwise it will prevent the main process to be closed
    await logger.close();
    // or sync way
    logger.closeSync();

## Key method logger.write()

    logger<write>('Hello world!');
or

    logger<write>('Hello world!', 'error message');
or

    logger<write>('Hello world!', { some: 'data' });

you are not obliged to specify the first argument as string however it's advised to do, especially if you use 'text' format (for better formatting).

where <write> is any of the following methods:

    logger.debug('Hello world!');
    logger.info('Hello world!');
    logger.log('Hello world!');
    logger.warn('Hello world!');
    logger.error('Hello world!');
    logger.fatal('Hello world!'); 

Voilà !
