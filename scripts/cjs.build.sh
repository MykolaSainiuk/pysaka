#!/bin/sh

cd ./dist/cjs/src

rm ./dirname.mjs
rm ./dirname.js
mv ./dirname.cjs ./dirname.js

rm ./worker.mjs
rm ./worker.d.mts

cd ../../../
./scripts/rename.sh ./dist/cjs/src cjs
