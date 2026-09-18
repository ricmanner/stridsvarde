---
description: Klickar igenom appen som alla fem demokonton och larmar om något brister
---

Kör `npm run rundtur` mot den driftsatta demon, eller mot adressen användaren
anger (`npm run rundtur -- http://localhost:3000`).

Rundturen loggar in som varje demokonto, öppnar varje sida och flik och
kontrollerar att inget är tomt, att webbläsaren inte rapporterar fel, att
rubrikerna finns, att ingen enskild persons benämning läcker in i en befälsvy,
och att exportfilen ser rimlig ut.

Sammanfatta utfallet. Vid anmärkning: ta reda på om det är ett verkligt fel i
appen eller en felaktig förväntan i `scripts/rundtur.mjs` innan du ändrar
något — det har varit det senare flera gånger.

Kör den här före varje uppvisning.
