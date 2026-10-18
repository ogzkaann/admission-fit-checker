import robotsParser from "robots-parser";

export const USER_AGENT = "AdmissionFitCatalog/0.1 (+https://github.com/ogzkaann/admission-fit-checker)";
export const MAX_BYTES = 8 * 1024 * 1024;

export function allowedUrl(value, hosts) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port || !hosts.includes(url.hostname)) throw new Error(`URL outside official host allowlist: ${url.origin}`);
  url.hash = "";
  return url.href;
}

async function readLimited(response, limit) {
  if (Number(response.headers.get("content-length")) > limit) throw new Error("Source exceeds size limit");
  const chunks = [];
  let length = 0;
  for await (const chunk of response.body ?? []) {
    length += chunk.length;
    if (length > limit) throw new Error("Source exceeds size limit");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// Sequential, bounded, public-only retrieval. Failed robots checks fail closed.
export function createFetcher({ hosts, fetchImpl = fetch, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), now = () => Date.now(), minDelayMs = 1200 } = {}) {
  const robots = new Map();
  const lastRequest = new Map();
  const stopped = new Set();
  let queue = Promise.resolve();
  async function request(url, delay = minDelayMs, limit = MAX_BYTES) {
    const origin = new URL(url).origin;
    if (stopped.has(origin)) throw new Error(`Host paused after an access/rate-limit response: ${origin}`);
    await sleep(Math.max(0, (lastRequest.get(origin) ?? 0) + delay - now()));
    lastRequest.set(origin, now());
    const response = await fetchImpl(url, { redirect: "manual", signal: AbortSignal.timeout(25000), headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/pdf,text/plain;q=0.8" } });
    if ([401, 403, 429, 503].includes(response.status)) stopped.add(origin);
    const bytes = await readLimited(response, limit);
    return { response, bytes };
  }
  async function policy(origin) {
    if (!robots.has(origin)) {
      const url = `${origin}/robots.txt`;
      const { response, bytes } = await request(url, minDelayMs, 512 * 1024);
      if (![200, 404, 410].includes(response.status)) { stopped.add(origin); throw new Error(`robots.txt unavailable (${response.status}); source not fetched`); }
      const body = response.status === 200 ? bytes.toString("utf8") : "";
      if (/<html[\s>]/i.test(body)) { stopped.add(origin); throw new Error("robots.txt returned HTML; source not fetched"); }
      robots.set(origin, { parser: robotsParser(url, body), status: response.status });
    }
    return robots.get(origin);
  }
  async function fetchSource(input) {
    let url = allowedUrl(input, hosts);
    const redirects = [];
    for (let hop = 0; hop <= 4; hop++) {
      const rules = await policy(new URL(url).origin);
      if (rules.parser.isAllowed(url, "AdmissionFitCatalog") === false) throw new Error(`robots.txt disallows ${url}`);
      const delay = Math.max(minDelayMs, (rules.parser.getCrawlDelay("AdmissionFitCatalog") ?? 0) * 1000);
      if (delay > 60000) throw new Error("Site requests a long crawl delay; defer to a scheduled/manual retrieval");
      const { response, bytes } = await request(url, delay);
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const target = response.headers.get("location");
        if (!target) throw new Error("Redirect has no location");
        redirects.push(url);
        url = allowedUrl(new URL(target, url).href, hosts);
        continue;
      }
      if (!response.ok) throw new Error(`Source HTTP ${response.status}: ${url}`);
      const mediaType = (response.headers.get("content-type") ?? "").split(";")[0];
      if (!/^(text\/html|application\/xhtml\+xml|application\/pdf)$/.test(mediaType)) throw new Error(`Unsupported source content type: ${mediaType}`);
      return { url, requestedUrl: input, mediaType, bytes, retrievedAt: new Date(now()).toISOString(), redirects, robotsStatus: rules.status, etag: response.headers.get("etag"), lastModified: response.headers.get("last-modified") };
    }
    throw new Error("Too many redirects");
  }
  // Serialize even when a caller accidentally submits a batch concurrently.
  return (input) => {
    const result = queue.then(() => fetchSource(input));
    queue = result.catch(() => {});
    return result;
  };
}
