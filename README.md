# Another one?

A zero-dependency logger to offload the main thread of the main process in order not to affect performance.

## Description

This logger is about logging your messages using streams via a separate Worker in order to offload the main thread, so even a custom serialization of log messages happens in the separate worker.

## Why?

*What do you need from your logger in Node.js world?*

Such apparent things:
- it has te be by async one (but async is a vague term)

  - it does not loose logs

- it does log what you ask: any types, any number/order of arguments

- it does support json format (surprisingly not all known loggers do)

- <b>it does not affect performance of the main process</b>

  - bcz logs are important but less than business logic


## How to install?

`npm i pysaka`

## How to use?

*"Usual" code example*:

    import PysakaLogger from 'pysaka';

    const logger = new PysakaLogger();

    // log your stuff
    logger.info('some text', 'another text + json later', {
        foo: 'bar',
        'some extra': { a: false, b: [1, 2] },
    });

    // in the end, please, close it - otherwise it will prevent the main process to be closed
    await logger.close(); // recommended way
    // or sync way
    logger.closeSync(); // only if neverSpikeCPU is false

### Key method is logger.write()

    logger<write>('Hello world!');
or

    logger<write>('Hello world!', 'error message');
or

    logger<write>('Hello world!', { some: 'data' });

<ins>Note</ins>: you are not obliged to specify the first argument as a string however it's advised to do so, especially if you use 'text' format (for optimal formatting).

### How use thru modules?

There are few ways how to approach a logger usage

## Available methods

Where <write> is any of the following methods:

    logger.debug('Hello world!');
    logger.info('Hello world!');
    logger.log('Hello world!');
    logger.warn('Hello world!');
    logger.error('Hello world!');
    logger.fatal('Hello world!'); 

Voilà !

## Speed

This is not BLAZINGLY fast logger because simply because is not key characteristic (and you code in Node.js, come on). 
You should not care much about the speed of messages logging, however you must care about performance of your main process which executes an important business logic.

Pysaka does not eat/steal much CPU time of your main thread of the main process. It delegates as much as possible (even serialization of a log message) to the separate worker thread (albeit, postMessage() copying takes its price still). It utilizes Node.js Streams to the full, because it's cheap from CPU & RAM perspective (and their are awesome in Node.js).
You are more than welcome to review the code base (it's tiny).

### Setup

In order to create an instance of the logger: `new PysakaLogger();`
hence the constructor expects such object as a param

    export type PysakaLoggerParams = {
        destination?: DestinationType;
        severity?: SeverityLevelEnum;
        format?: PrintFormatEnum;
        name?: string;
        debugLogsOfLogger?: boolean;
        neverSpikeCPU?: boolean;
    };

In details:

- `destination` - must be Writable stream! Mostly it's process.stdout, or file descriptor with write access, socket...

- `fallbackSupport` - flag which identifies that logs has to be backup-ed up in case if destination is not available temporarily. It preserves logs in the temporary file until your main code repairs the destination. Useful much if `destination` is Socket which points to another unstable server.

- `severity` - aka a log level: 0 - debug, 1 - info, 2 - warn, 3 - error, 4 - fatal

- `format` - two options: "json" or "text".
  - JSON - for post-reexporting to monitoring tools
  - text - for human readability, with colors.

- `name` - a name of the logger. optional

- `debugLogsOfLogger` - a flag which identifies if the debug logs of the logger itself should be printed. Internal usage mostly

- `neverSpikeCPU` - a flag which de-prioritizes logger work (lower it) in comparison with other user code. It utilizes never busy setImmediate stage of EventLoop, ergo it has minimal affect on the main process (being executed when CPU is not busy much).

### Does not do what I want

So open an issue on github and I will code it for you if it makes sense.
