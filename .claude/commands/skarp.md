---
description: Kör alla kontroller som ska vara gröna före en driftsättning
---

Kör följande i tur och ordning i projektet, och stanna vid första felet:

1. `npm test`
2. `npm run typecheck`
3. `npx eslint src tests scripts`
4. `npm run build`

Rapportera kort vad som gick igenom och vad som fallerade. Rätta ingenting
utan att först berätta vad som är fel — det kan vara avsiktligt.

Påminnelse: GitHub kör samma kontroller, men först efter att något pushats.
Det här kommandot finns för att hinna före.
