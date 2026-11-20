---
"@qubo/db": minor
"@qubo/storage": minor
"qubo-admin": patch
---

Product photos are now linked to the files in the media library, not only to their web address. Deleting a file removes it from every product gallery that uses it, and the library knows which products use each file. Each upload also stores a fingerprint, so duplicate files can be spotted later.
