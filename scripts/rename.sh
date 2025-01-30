#!/bin/sh

source_dir="${1:-./dist/src}"
target_extension="${2:-mjs}"

cd $source_dir || exit

# Find all ".js" files in the root directory and iterate through them
find . -maxdepth 1 -type f -name "*.js" | while read -r file; do
    new_name="${file%.js}.$target_extension"
    # echo "Renaming: $file -> $new_name"
    mv "$file" "$new_name"
done
