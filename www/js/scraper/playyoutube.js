/**
 * ============================================================================
 *  YTMP3 Downloader (versi browser)
 * ============================================================================
 *  @author   xemoz (xemoz_official)
 *  @license  MIT
 *  @source   sabetube.vip
 *
 *  Cari video YouTube dari kata kunci lalu ambil link MP3-nya.
 *  Backend berurutan (fallback): savetube -> ytmp3.ing
 *
 *  Pemakaian: await YTScraper.playyoutube("Alan Walker Faded", { quality: "128" })
 *
 *  Script ini untuk keperluan edukasi dan riset pribadi. Pengguna
 *  bertanggung jawab penuh atas penggunaannya.
 * ============================================================================
 */
(function (global) {
  "use strict";

  const { http } = global.YTScraper;

  function base64ToBytes(base64) {
    const binary = atob(base64.replace(/\s/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
  }

  class YouTubeSearch {
    async search(query) {
      const { data: html } = await http.get("https://www.youtube.com/results", {
        headers: {
          accept: "*/*",
          "accept-language": "en-US,en;q=0.9",
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        },
        params: { search_query: query },
        responseType: "text",
      });

      const match =
        html?.match(/var ytInitialData = (\{[\s\S]*?\});/) ||
        html?.match(/var ytInitialData\s*=\s*(\{[\s\S]*?\});\s*var/);
      if (!match) throw new Error("Gagal parse YouTube data");
      return this._parseResults(JSON.parse(match[1]));
    }

    _parseResults(json) {
      const contents =
        json.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
          ?.contents?.[0]?.itemSectionRenderer?.contents;
      if (!contents) return [];

      return contents
        .filter((c) => c.videoRenderer)
        .map((c) => {
          const d = c.videoRenderer;
          return {
            id: d.videoId,
            url: `https://www.youtube.com/watch?v=${d.videoId}`,
            title: d.title?.runs?.[0]?.text || "",
            author: d.ownerText?.runs?.[0]?.text || "",
            views: d.viewCountText?.simpleText || "",
            duration: d.lengthText?.accessibility?.accessibilityData?.label || "",
            thumbnail: d.thumbnail?.thumbnails?.slice(-1)[0]?.url || "",
            published: d.publishedTimeText?.simpleText || "",
          };
        });
    }
  }

  class SavetubeDownloader {
    constructor() {
      this.cryptoKey = "C5D58EF67A7584E4A29F6C35BBC4EB12";
    }

    async _getCdn() {
      const { data } = await http.get("https://media.savetube.vip/api/random-cdn");
      return data.cdn;
    }

    // AES-CBC via Web Crypto (butuh HTTPS atau localhost)
    async _decrypt(base64) {
      const raw = base64ToBytes(base64);
      const iv = raw.slice(0, 16);
      const encrypted = raw.slice(16);
      const key = await crypto.subtle.importKey(
        "raw",
        hexToBytes(this.cryptoKey),
        { name: "AES-CBC" },
        false,
        ["decrypt"],
      );
      const decrypted = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, key, encrypted);
      return JSON.parse(new TextDecoder().decode(decrypted));
    }

    async download(videoUrl, quality = "128") {
      const cdn = await this._getCdn();
      const { data } = await http.post(`https://${cdn}/v2/info`, { url: videoUrl });
      if (!data.status) throw new Error(data.message || "Gagal ambil info video");

      const info = await this._decrypt(data.data);
      const { data: dl } = await http.post(`https://${cdn}/download`, {
        downloadType: "audio",
        quality,
        key: info.key,
      });

      return {
        title: info.title,
        thumbnail: info.thumbnail,
        duration: info.durationLabel,
        downloadUrl: dl.data?.downloadUrl || "",
        format: "mp3",
      };
    }
  }

  class Ytmp3IngDownloader {
    async download(videoUrl) {
      const res = await http.get("https://ytmp3.ing/", { responseType: "text" });
      const cookie = res.setCookie.join("; ");
      const csrf = res.data.match(/value="([^"]+)"/)?.[1];
      if (!csrf) throw new Error("Gagal dapat CSRF token ytmp3.ing");

      const boundary = "----WebKitFormBoundaryAzbry";
      const body = `${boundary}\r\nContent-Disposition: form-data; name="url"\r\n\r\n${videoUrl}\r\n${boundary}--\r\n`;

      const response = await http.post("https://ytmp3.ing/audio", body, {
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          "x-csrftoken": csrf,
          cookie,
        },
      });

      const downloadUrl = new TextDecoder().decode(base64ToBytes(response.data.url));

      return {
        title: response.data.filename || "Unknown",
        downloadUrl,
        format: "mp3",
      };
    }
  }

  async function playyoutube(query, { quality = "128" } = {}) {
    const searcher = new YouTubeSearch();
    const results = await searcher.search(query);
    if (!results.length) throw new Error("Tidak ada hasil pencarian");

    const video = results[0];
    const videoUrl = video.url;

    const backends = [
      { name: "savetube", fn: () => new SavetubeDownloader().download(videoUrl, quality) },
      { name: "ytmp3ing", fn: () => new Ytmp3IngDownloader().download(videoUrl) },
    ];

    let lastError;
    for (const backend of backends) {
      try {
        const result = await backend.fn();
        return {
          status: true,
          created_by: "xemoz_official",
          backend: backend.name,
          video,
          download: result,
        };
      } catch (err) {
        lastError = err;
        console.error(`[FALLBACK] ${backend.name} gagal: ${err.message}`);
      }
    }

    throw new Error(`Semua backend gagal. Error terakhir: ${lastError?.message}`);
  }

  global.YTScraper.playyoutube = playyoutube;
})(window);
