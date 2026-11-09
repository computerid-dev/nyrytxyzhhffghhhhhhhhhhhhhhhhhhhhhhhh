/**
 * Pemeriksaan akhir: pastikan semua scraper sudah termuat.
 * Muat file ini paling terakhir, setelah http.js, ytmp3.js, ytmp3gg.js,
 * playlist.js, dan playyoutube.js.
 */
(function (global) {
  "use strict";

  const scrapers = ["ytmp3", "ytmp3gg", "playlist", "playyoutube"];
  const missing = scrapers.filter((name) => typeof global.YTScraper?.[name] !== "function");

  if (missing.length > 0) {
    console.warn(`YTScraper: scraper belum termuat: ${missing.join(", ")}. Cek urutan <script>.`);
  }
})(window);
