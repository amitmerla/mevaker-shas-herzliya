# Hand-written text for documents without a text layer

Scanned PDFs, images and videos have no text the builder can read (macOS OCR has no Hebrew).
Put their text here as `<doc id>.txt`. Separate pages with a line `--- עמ׳ N ---`.
Then run `tools/build-corpus.sh`. Emails and phone numbers are removed by the builder;
leave home addresses and ID numbers out of these files.
