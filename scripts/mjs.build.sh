#!/bin/sh

cd ./dist/mjs/src

rm ./dirname.js
mv ./dirname.mjs ./dirname.js
mv ./index.js ./index.mjs

# rm ./worker.cjs

cd ../../../
