#!/bin/sh

cd ./dist/cjs/src

rm ./dirname.mjs
rm ./dirname.js
mv ./dirname.cjs ./dirname.js

rm ./worker.mjs
rm ./worker.d.mts

cd ../../../
./scripts/rename.sh ./dist/cjs/src cjs

# Fix internal require() paths: add .cjs extension to relative imports, then fix any doubles
find ./dist/cjs/src -name "*.cjs" | while read -r file; do
  sed -i '' -E 's/require\("(\.[^"]+)"\)/require("\1.cjs")/g' "$file"
  sed -i '' -E "s/require\('(\.[^']+)'\)/require('\1.cjs')/g" "$file"
  sed -i '' -E 's/\.cjs\.cjs"/\.cjs"/g' "$file"
  sed -i '' -E "s/\\.cjs\\.cjs'/\\.cjs'/g" "$file"
done
