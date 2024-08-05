# Another one?
A logger to offload the main thread of the main process in order not to affect performance.

## Description

This logger is about logging your messages using streams via a separate Worker in order to offload the main thread, so even a serialization of log messages happens in the worker (however postMessage copying takes its price still).

## Why?

What do you need from your logger in Node.js world?

Obvious things:
- it must by async one (but async is very vague term) 
- it does log what you ask, any types with any number of arguments
- it does not loose logs
  - this one won't loose it even if the destination (like stdout) is unavailable temporarily
- it supports json format (surprisingly not all of them do)
- <b>it does not affect performance of the main process!</b>

It is not BLAZINGLY fast logger because that is not key characteristic. You should not care much about speed of messages logging, however you must care about performance of your main process which executes important business logic.

Pysaka does not eat/steal much CPU time of your main thread of the main process. It delegates as much as possible (even serialization of a log message) to the separate worker thread. It utilizes Node.js Streams to the full, because it's cheap from CPU & RAM perspective (and their are awesome in Node.js).
You are more than welcome to review the code base (it's tiny).

### Features

In order to create an instance of the logger: `new PysakaLogger();`
hence the constructor expects such object as a param

    export type PysakaLoggerParams = {
        destination?: DestinationType;
        fallbackSupport?: boolean;
        severity?: SeverityLevelEnum;
        format?: PrintFormatEnum;
        name?: string;
        debugLogsOfLogger?: boolean;
        tempDirPath?: string;
        neverSpikeCPU?: boolean;
    };

In details:

destination - must be Writable stream! Mostly it's process.stdout, or file descriptor with write access, socket...

fallbackSupport - flag which identifies that logs has to be backup-ed up in case if destination is not available temporarily. It preserves logs in the temporary file until your main code repairs the destination. Useful much if `destination` is Socket which points to another unstable server.

severity - aka a log level: 0 - debug, 1 - info, 2 - warn, 3 - error, 4 - fatal

format - two options: "json" or "text". JSON is for exporting and performance, text is for human readability, with colors.

name - name of the logger. optional

debugLogsOfLogger - flag which identifies if debug logs of the logger itself should be printed. Internal usage mostly

tempDirPath - a path to the temporary dir where logs will be stored if the destination is not available temporarily. Makes sense only if `fallbackSupport` is true.

neverSpikeCPU - flag which de-prioritizes logger work (lower it) in comparison with other user code. It utilizes never busy setImmediate stage of EventLoop, ergo it has minimal affect on the main process (being executed when CPU is not busy much).

# How to install?

`npm i pysaka`

## How to use?

*"Usual" code example*:

    import PysakaLogger from 'pysaka';

    const logger = new PysakaLogger();

    // log your stuff, like
    logger.info('Logs are on, folks!');

    // in the end, please, close it
    // otherwise it will prevent the main process to be closed
    await logger.close(); // recommended way
    // or sync way
    logger.closeSync(); // only if neverSpikeCPU is false

## Key method logger.write()

    logger<write>('Hello world!');
or

    logger<write>('Hello world!', 'error message');
or

    logger<write>('Hello world!', { some: 'data' });

you are not obliged to specify the first argument as a string however it's advised to do so, especially if you use 'text' format (for optimal formatting).

where <write> is any of the following methods:

    logger.debug('Hello world!');
    logger.info('Hello world!');
    logger.log('Hello world!');
    logger.warn('Hello world!');
    logger.error('Hello world!');
    logger.fatal('Hello world!'); 

Voilà !

### Does not do what I want
So open an issue on github and I will code it for you if it makes sense.
