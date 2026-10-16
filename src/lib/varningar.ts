/*
 * Varningen som stod fem gånger i befälsvyn — väg B, Richards beslut den 16
 * oktober.
 *
 * Märket "2 kategorier i rött", den dagliga notisen "kritisk nivå", de röda
 * märkena i kategorilistan, rutan Tröskelvärden och Befälsrådet sa samma sak.
 * Veckosammanfattningen blev den femte den 15 oktober. I telefonen tryckte
 * notisen ner allt en halv skärm.
 *
 * Gömt, inte borttaget. Sätt `true` för att få tillbaka. Notiserna skapas
 * fortfarande i databasen (queries/alerts.ts) och syns igen direkt. Kvar i
 * vyn: märket överst, de röda märkena i listan, veckosammanfattningen och
 * Befälsrådet — det enda som säger vad befälet kan göra.
 */

/**
 * Rutan "Tröskelvärden — kräver åtgärd". Den upprepade de röda raderna i
 * kategorilistan precis ovanför. Meningen om att gränserna är preliminära
 * står i stället under kategorilistan.
 */
export const VISA_TROSKELRUTA = false;

/**
 * Den dagliga notisen "… ligger på kritisk nivå". Den kom tillbaka varje dag
 * så länge läget var rött och sa inget nytt — och en gul ruta som visar samma
 * sak varje dag lär befälet att klicka bort gula rutor. Notisen om låg
 * svarsfrekvens står kvar: den säger något som inte syns annars.
 */
export const VISA_DAGLIG_LARMNOTIS = false;
