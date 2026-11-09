/**
 * Scraper playlist YouTube.
 * Pemakaian: await YTScraper.playlist("https://www.youtube.com/playlist?list=...")
 */
(function (global) {
  "use strict";

  const { http } = global.YTScraper;

  async function scrape(url) {
    try {
      const playlistMatch = url.match(/[?&]list=([^"&?\/\s]+)/i);
      const playlistId = playlistMatch ? playlistMatch[1] : null;

      if (!playlistId) {
        throw new Error("Must be a valid YouTube playlist URL containing a list parameter.");
      }

      const playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`;
      const { data: html } = await http.get(playlistUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
          Cookie: "SOCS=CAESEwgDEgk2MTc4OTU0NzQaAmVuIAEaBgiA_LyaBg; CONSENT=PENDING+999",
        },
        timeout: 12000,
        responseType: "text",
      });

      let data = null;
      const marker = "ytInitialData = ";
      const idx = html.indexOf(marker);
      if (idx !== -1) {
        const start = idx + marker.length;
        const scriptEnd = html.indexOf("</script>", start);
        if (scriptEnd !== -1) {
          let rawStr = html.substring(start, scriptEnd).trim();
          if (rawStr.endsWith(";")) rawStr = rawStr.slice(0, -1);
          try {
            data = JSON.parse(rawStr);
          } catch (_) {}
        }
      }

      if (!data) {
        const m =
          html.match(/ytInitialData\s*=\s*({.+?});<\/script>/s) ||
          html.match(/var ytInitialData\s*=\s*({.+?});/s);
        if (m) {
          try {
            data = JSON.parse(m[1]);
          } catch (_) {}
        }
      }

      if (!data) {
        throw new Error("Failed to extract YouTube playlist data (might be private or unavailable).");
      }

      const primarySidebar =
        data.sidebar?.playlistSidebarRenderer?.items?.[0]?.playlistSidebarPrimaryInfoRenderer;
      const secondarySidebar =
        data.sidebar?.playlistSidebarRenderer?.items?.[1]?.playlistSidebarSecondaryInfoRenderer;

      const title =
        data.header?.pageHeaderRenderer?.pageTitle ||
        (typeof data.metadata?.playlistMetadataRenderer?.title === "string"
          ? data.metadata?.playlistMetadataRenderer?.title
          : data.metadata?.playlistMetadataRenderer?.title?.runs?.[0]?.text) ||
        primarySidebar?.title?.runs?.[0]?.text ||
        primarySidebar?.title?.simpleText ||
        data.header?.playlistHeaderRenderer?.title?.simpleText ||
        "YouTube Playlist";

      const author =
        data.header?.pageHeaderRenderer?.content?.pageHeaderViewModel?.metadata?.contentMetadataViewModel?.metadataRows?.[0]?.metadataParts?.[0]?.text?.content ||
        secondarySidebar?.videoOwner?.videoOwnerRenderer?.title?.runs?.[0]?.text ||
        secondarySidebar?.videoOwner?.videoOwnerRenderer?.title?.simpleText ||
        "";

      const thumbnail =
        primarySidebar?.thumbnailRenderer?.playlistVideoThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
        data.metadata?.playlistMetadataRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
        "";

      const tracks = [];
      const seen = new Set();

      function pushTrack(id, title, author, thumbnail) {
        if (!id || !title || seen.has(id)) return;
        seen.add(id);
        tracks.push({
          id,
          title,
          author,
          thumbnail,
          url: `https://www.youtube.com/watch?v=${id}`,
        });
      }

      function extractItems(obj) {
        if (!obj || typeof obj !== "object") return;

        if (obj.playlistVideoRenderer) {
          const pvr = obj.playlistVideoRenderer;
          const id = pvr.videoId;
          pushTrack(
            id,
            pvr.title?.runs?.[0]?.text || pvr.title?.simpleText || "",
            pvr.shortBylineText?.runs?.[0]?.text || "",
            pvr.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
              `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
          );
          return;
        }

        if (obj.lockupViewModel) {
          const lvm = obj.lockupViewModel;
          const id = lvm.contentId;
          const meta = lvm.metadata?.lockupMetadataViewModel;
          pushTrack(
            id,
            meta?.title?.content || "",
            meta?.metadata?.contentMetadataViewModel?.metadataRows?.[0]?.metadataParts?.[0]?.text?.content || "",
            lvm.contentImage?.thumbnailViewModel?.image?.sources?.slice(-1)[0]?.url ||
              `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
          );
          return;
        }

        for (const key of Object.keys(obj)) {
          if (key !== "onTap" && key !== "serviceTrackingParams" && key !== "clickTrackingParams") {
            extractItems(obj[key]);
          }
        }
      }

      extractItems(data);

      if (tracks.length === 0) {
        throw new Error("No videos found in YouTube playlist.");
      }

      return {
        status: true,
        result: {
          title,
          author: author ? { name: author } : undefined,
          thumbnail,
          type: "playlist",
          itemCount: tracks.length,
          items: tracks,
        },
      };
    } catch (err) {
      return {
        status: false,
        message: err.message || "Failed to parse YouTube playlist.",
      };
    }
  }

  global.YTScraper.playlist = scrape;
})(window);
