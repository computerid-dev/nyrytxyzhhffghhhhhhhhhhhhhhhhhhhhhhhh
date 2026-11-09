(function () {
  "use strict";

  // Hanya dipakai di mode web. Di APK, request dikirim langsung oleh Android
  // (CapacitorHttp) sehingga proxy tidak dipakai.
  // Ganti ke URL penuh proxy kalau halaman ini dibuka dari domain lain,
  // contoh: "https://nama-project.vercel.app/proxy/proxy"
  YTScraper.config.proxyUrl = "/proxy/proxy";

  const form = document.getElementById("scrape-form");
  const toolSelect = document.getElementById("tool");
  const inputField = document.getElementById("input");
  const inputLabel = document.getElementById("input-label");
  const formatField = document.getElementById("format-field");
  const formatSelect = document.getElementById("format");
  const submitButton = document.getElementById("submit");
  const statusText = document.getElementById("status");
  const output = document.getElementById("output");
  const modeInfo = document.getElementById("mode-info");

  const MODE_LABELS = {
    native: "Mode: APK (request langsung, tanpa proxy)",
    proxy: "Mode: web (request lewat proxy server)",
    none: "Mode: tidak ada jalur HTTP",
  };

  const tools = {
    ytmp3: {
      label: "Link video YouTube",
      placeholder: "https://www.youtube.com/watch?v=...",
      needsFormat: true,
      run: (input, format) => YTScraper.ytmp3(input, format),
    },
    ytmp3gg: {
      label: "Link video YouTube",
      placeholder: "https://www.youtube.com/watch?v=...",
      needsFormat: true,
      run: (input, format) => YTScraper.ytmp3gg(input, { format }),
    },
    playlist: {
      label: "Link playlist YouTube",
      placeholder: "https://www.youtube.com/playlist?list=...",
      needsFormat: false,
      run: (input) => YTScraper.playlist(input),
    },
    playyoutube: {
      label: "Kata kunci pencarian",
      placeholder: "Alan Walker Faded",
      needsFormat: false,
      run: (input) => YTScraper.playyoutube(input),
    },
  };

  function syncToolFields() {
    const tool = tools[toolSelect.value];
    inputLabel.textContent = tool.label;
    inputField.placeholder = tool.placeholder;
    formatField.hidden = !tool.needsFormat;
  }

  function syncModeInfo() {
    modeInfo.textContent = MODE_LABELS[YTScraper.transportName()];
  }

  function setBusy(isBusy) {
    submitButton.disabled = isBusy;
    submitButton.textContent = isBusy ? "Memproses..." : "Jalankan";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const value = inputField.value.trim();
    if (!value) {
      statusText.textContent = "Isi input terlebih dahulu.";
      inputField.focus();
      return;
    }

    if (navigator.onLine === false) {
      statusText.textContent = "Tidak ada koneksi internet. Scraper butuh internet untuk mengambil data.";
      output.textContent = "";
      return;
    }

    const tool = tools[toolSelect.value];
    setBusy(true);
    statusText.textContent = "Menunggu hasil, bisa sampai beberapa detik.";
    output.textContent = "";

    try {
      const result = await tool.run(value, formatSelect.value);
      const failed = result && result.status === false;
      statusText.textContent = failed ? "Gagal." : "Berhasil.";
      output.textContent = JSON.stringify(result, null, 2);
    } catch (err) {
      statusText.textContent = "Gagal.";
      output.textContent = err.message;
    } finally {
      setBusy(false);
    }
  }

  toolSelect.addEventListener("change", syncToolFields);
  form.addEventListener("submit", handleSubmit);
  syncToolFields();
  syncModeInfo();
})();
