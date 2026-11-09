/**
 * Klien HTTP kecil untuk YTScraper.
 *
 * Browser tidak boleh mengatur header Origin, Referer, User-Agent, Cookie
 * dan terblokir CORS. Karena itu ada dua jalur pengiriman:
 *
 *   1. NATIVE (mode APK): lewat plugin CapacitorHttp. Request dikirim oleh
 *      Android langsung ke server tujuan, tanpa CORS dan tanpa proxy,
 *      jadi aplikasi tidak butuh server sendiri (offline dari sisi hosting).
 *   2. PROXY (mode web): lewat proxy server (proxy/proxy.js), seperti semula.
 *
 * Bentuk API-nya sengaja dibuat mirip axios supaya kode scraper aslinya
 * tetap mudah dibaca.
 */
(function (global) {
  "use strict";

  const YTScraper = (global.YTScraper = global.YTScraper || {});

  const config = {
    proxyUrl: "/proxy/proxy",
    timeout: 15000,
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function getNativeHttp() {
    const cap = global.Capacitor;
    if (!cap || typeof cap.isNativePlatform !== "function" || !cap.isNativePlatform()) {
      return null;
    }
    const plugin = cap.Plugins && cap.Plugins.CapacitorHttp;
    return plugin && typeof plugin.request === "function" ? plugin : null;
  }

  function transportName() {
    if (getNativeHttp()) return "native";
    if (config.proxyUrl) return "proxy";
    return "none";
  }

  function buildUrl(url, params) {
    if (!params) return url;
    const query = new URLSearchParams(params).toString();
    if (!query) return url;
    return url + (url.includes("?") ? "&" : "?") + query;
  }

  function parseBody(text, responseType) {
    if (responseType === "text") return text;
    try {
      return JSON.parse(text);
    } catch (_) {
      return text;
    }
  }

  function findHeader(headers, name) {
    const wanted = name.toLowerCase();
    const key = Object.keys(headers || {}).find((k) => k.toLowerCase() === wanted);
    return key ? headers[key] : undefined;
  }

  // Android menggabungkan beberapa Set-Cookie jadi satu string dipisah koma.
  function splitSetCookie(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    return String(value).split(/,(?=\s*[^;,=\s]+=)/).map((part) => part.trim());
  }

  function normalizeBodyText(data) {
    if (typeof data === "string") return data;
    if (data === undefined || data === null) return "";
    return JSON.stringify(data);
  }

  async function sendNative(plugin, { url, method, headers, body, timeout }) {
    const limit = timeout || config.timeout;
    let response;
    try {
      response = await plugin.request({
        url,
        method,
        headers: headers || {},
        data: body,
        responseType: "text",
        connectTimeout: limit,
        readTimeout: limit,
      });
    } catch (err) {
      throw new Error(`Gagal menghubungi ${url}: ${err && err.message ? err.message : err}`);
    }

    return {
      status: response.status,
      headers: { "content-type": findHeader(response.headers, "content-type") || "" },
      setCookie: splitSetCookie(findHeader(response.headers, "set-cookie")),
      body: normalizeBodyText(response.data),
    };
  }

  async function sendProxy({ url, method, headers, body, timeout }) {
    if (!config.proxyUrl) {
      throw new Error(
        "Tidak ada jalur HTTP. Mode APK butuh plugin native (CapacitorHttp); mode web butuh proxyUrl.",
      );
    }

    const limit = timeout || config.timeout;
    const controller = new AbortController();
    // Sedikit lebih lama dari batas di proxy supaya error dari proxy yang muncul duluan
    const timer = setTimeout(() => controller.abort(), limit + 3000);

    try {
      const response = await fetch(config.proxyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, method, headers, body, timeout: limit }),
        signal: controller.signal,
      });
      const envelope = await response.json();
      if (envelope.error) throw new Error(envelope.error);
      return envelope;
    } catch (err) {
      if (err.name === "AbortError") throw new Error(`Request timeout: ${url}`);
      if (err instanceof TypeError || err instanceof SyntaxError) {
        throw new Error(`Proxy tidak dapat dihubungi (${config.proxyUrl}): ${err.message}`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async function send(request) {
    const native = getNativeHttp();
    const envelope = native ? await sendNative(native, request) : await sendProxy(request);

    if (envelope.status < 200 || envelope.status >= 300) {
      throw new Error(`Request gagal dengan status ${envelope.status}: ${request.url}`);
    }

    return {
      status: envelope.status,
      headers: envelope.headers || {},
      setCookie: envelope.setCookie || [],
      data: parseBody(envelope.body, request.responseType),
    };
  }

  function create(defaults = {}) {
    const merge = (options = {}) => ({
      ...defaults,
      ...options,
      headers: { ...defaults.headers, ...options.headers },
    });

    return {
      get(url, options) {
        const opts = merge(options);
        return send({
          url: buildUrl(url, opts.params),
          method: "GET",
          headers: opts.headers,
          timeout: opts.timeout,
          responseType: opts.responseType,
        });
      },

      post(url, data, options) {
        const opts = merge(options);
        const headers = { ...opts.headers };
        let body = data;

        if (data !== null && typeof data === "object") {
          body = JSON.stringify(data);
          const hasContentType = Object.keys(headers).some(
            (key) => key.toLowerCase() === "content-type",
          );
          if (!hasContentType) headers["Content-Type"] = "application/json";
        }

        return send({
          url,
          method: "POST",
          headers,
          body,
          timeout: opts.timeout,
          responseType: opts.responseType,
        });
      },
    };
  }

  YTScraper.config = config;
  YTScraper.sleep = sleep;
  YTScraper.transportName = transportName;
  YTScraper.http = Object.assign(create(), { create });
})(window);
