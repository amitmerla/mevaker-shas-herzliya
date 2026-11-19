#!/bin/sh
# Rebuilds js/corpus.js: the full text of every document, split into passages for the agent's retrieval (RAG).
# Run after adding or changing a document:  sh tools/build-corpus.sh
# PDFs with a text layer are read automatically. Scanned PDFs, images and videos need docs/text/<doc id>.txt.
set -e
cd "$(dirname "$0")/.."
node -e "import('./js/data.js').then(m=>process.stdout.write(JSON.stringify(m.DOCS.map(d=>({id:d.id,file:d.file||''})))))" \
  | swift tools/extract.swift "$PWD" 2>/dev/null > /tmp/mevaker-pages.json
node tools/build-corpus.mjs /tmp/mevaker-pages.json
