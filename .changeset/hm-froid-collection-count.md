---
"@qubo/api": patch
"qubo-storefront": patch
---

Collection pages show the real product count instead of "0 produits". The category list counted products with a query whose column names Drizzle left unqualified, so every category came back as zero. A page whose category data carries no counts now hides the count line instead of printing 0.
