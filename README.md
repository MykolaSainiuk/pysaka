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

  - bcz logs are important but less important than business logic


## How to install?

`npm i pysaka`

## How to use?

*"Usual" code example*:

    import PysakaLogger from 'pysaka';

    const logger = new PysakaLogger();

    logger.log('Hello world!');

    // log your stuff
    logger.info('some text', 'another text + json later', {
        foo: 'bar',
        'some extra': { a: false, b: [1, 2] },
    });

    logger.error(new Error('Some error'));

    // in the end, please, close it - otherwise it will prevent the main process to be closed
    await logger.close();

<ins>Note</ins>: you are not obliged to specify the first argument as a string however it's advised to do so, especially if you use 'text' format (for optimal formatting).
Why? Bcz the very first argument will be considered as a message, and it's better to have it as a string, others - data or errors, depends on severity level.

### How to import?

You can get `PysakaLogger` consturctor, create your own instance of the logger and use it in your project. In such case it's much suggested to create a separate `util/logger.ts` file and export the logger instance from there for convenience.

    import PysakaLogger from 'pysaka';

    const logger = new PysakaLogger();

    export default logger;

to be able to import like this

    import logger from './util/logger';

<ins>Price</ins>: each new instance of PysakaLogger creates a new Worker thread, so it's better to have only few unique ones and reuse wisely, like we did with RAM in 90s. 

### Why close?

This method

    await logger.close();

performs graceful shutdown of the logger: it flushes the buffer and closes the streams. It's important to call it in the end of the main process execution, otherwise the main process may hang or/and logs are lost in its way to destination stream.

    process.once('beforeExit', async () => {
        // any of your logic in order to gracefully shutdown the app
        await logger.close();
    });

In case if you brutally kill the process (e.g. `process.exit(1)`), the logger will catch it and perform the resources cleanup (buy calling a destructor), however unflushed logs can be lost in such case.

In any other case of kill signals or uncaught exceptions, the logger will catch them and perform the graceful shutdown with guaranteed logs delivery.

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

## Setup

In order to create an instance of the logger: `new PysakaLogger();`
hence the constructor expects such object as a param

    export type PysakaLoggerParams = {
        destination?: DestinationType;
        severity?: SeverityLevelEnum;
        format?: PrintFormatEnum;
        prefix?: string;
        internalLogs?: boolean;
    };

In details:

- `destination` - must be Writable stream! Mostly it's process.stdout, or file descriptor with write access, net socket or custom Writable stream. Default is process.stdout.

- `severity` - aka a log level: 0 - debug, 1 - info, 2 - warn, 3 - error, 4 - fatal

- `format` - two options: "json" or "text"
  - JSON - for post-reexporting into monitoring tools (default format)
  - text - for human readability, with colors

- `prefix` - a name of the logger (optional): will be pre-inserted for each log message. Default is empty string.

- `internalLogs` - a flag which identifies if the debug logs of the logger itself should be printed. Internal usage mostly

## Does not do what I want

So open an issue on github and I will code it for you if it makes sense.
