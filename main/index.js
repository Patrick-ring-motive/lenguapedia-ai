const hostTargets = [
  "en.wikipedia.org",
  //"en.wiktionary.org",
];

if (typeof env === "undefined") {
  globalThis.env = {};
}

const contentScripts = `<script>
        globalThis.env ??= {};
        env.hostTargets ??= ${JSON.stringify(hostTargets)} || [];
        env.mode ??= "${env.mode}" || 'DEV';
        globalThis.importScript = async(url)=>{
          try{
            if(env.mode === 'DEV'){
              const u = new URL(url);
              u.searchParams.set('cachebust',new Date().getTime());
              url = String(u);
            }
            const i = await import(url);
            return i || true;
          }catch{
            return false;
          }
        };
        </script>
        <script>
        importScript('https://patrick-ring-motive.github.io/lenguapedia-ai/frontend/rewrites.js');
        </script>`;

const fetchResponse = async (...args) => {
  try {
    return await fetch(...args);
  } catch (e) {
    return new Response(String(e), {
      status: 500,
      statusText: String(e),
    });
  }
};

const url =
  'https://en.wikipedia.org/w/api.php' +
  '?action=query' +
  '&generator=random' +
  '&grnnamespace=0' +
  '&prop=info' +
  '&format=json' +
  '&origin=*';

async function getRandomWikipediaTitle() {
  const data = await fetchResponse(url, {
    headers: {
      'user-agent': 'lenguapedia'
    }
  }).then(r => r.json());
  const page = Object.values(data.query.pages)[0];
  return page.title;
}

getRandomWikipediaTitle().then(console.log);

const fetchText = async (...args) => {
  try {
    return await (await fetchResponse(...args)).text();
  } catch (e) {
    return String(e);
  }
};

const getArticle = (baseURL, title, userAgent) => {
  const url = new URL(baseURL);
  url.searchParams.set('title', title);
  url.searchParams.set('useragent', userAgent);
  return fetchText(String(url));
};

const onLengRequestText = async (...args) => {
  try {
    return await (await onLengRequest(new Request(...args))).text();
  } catch (e) {
    return String(e);
  }
};

const norm = (str) => {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const replacers = [
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "too",
  "in",
  "as",
  "has",
  "have",
  "had",
  "is",
  "it",
  "for",
  "on",
  "was",
  "were",
  "are",
  "what",
  "that",
  "this",
  "there",
  "then",
  "than",
  "like",
  "those",
  "be",
  "by",
  "may",
  "been",
  "from",
  "will"
];

const rex = replacers.map((x) =>
  RegExp([
    `\b${x}\s+(a\s+|an\s+|the\s+)?\w+\b`,
    `\\b${x}\\s+(a\\s+|an\\s+|the\\s+)?\\w+\\b`
  ].join('|'), "g"),
);
const rex_len = rex.length;

function merger(article1, article2) {
  let test = [];
  for (let rex_i = 0; rex_i !== rex_len; ++rex_i) {
    const r = rex[rex_i];
    let matches = (
      norm(String(article2)).replace(/\n/g, " ").match(r) || []
    ).filter(
      (x) =>
      !["a href", "a rel"].includes(x) &&
      !replacers.some((y) => x.toLowerCase().endsWith(" " + y)),
    );
    test.push(matches);
    let i = 0;
    if (!matches.length) continue;
    article1 = String(article1)
      .replace(/\n/g, " ")
      .replaceAll(r, (x) => {
        if (!/ (href|rel)$/.test(x)) {
          x = matches[i];
        }
        i++;
        i = i % matches.length;
        return x;
      });
  }
  return article1;
}

const gatewayHost = /gateway\.ai\.cloudflare\.com/gi;
const gatewayPrefix = /^https:\/\/gateway\.ai\.cloudflare\.com\/v1\/[^\/]+\/[^\/]+\/[^\/]+\//gi;

const normalizeRequest = (request) => {
  const url = new URL(request.url);
  url.pathname = (url.pathname || '').replace(/^\/v1/, '');
  const reqHost = RegExp(String(request.headers.get('x-gateway-source')), 'gi');
  const reqHeaders = new Headers(request.headers);
  reqHeaders.delete('x-gateway-source');

  for (const [key, value] of reqHeaders) {
    reqHeaders.set(key, value
      .replaceAll(gatewayPrefix, url.origin + '/')
      .replaceAll(gatewayHost, url.host)
      .replaceAll(reqHost, url.host)
    );
  }
  const requestInit = {
    method: request.method,
    headers: reqHeaders,
  };
  if (request.body) {
    requestInit.body = request.body;
  }
  return new Request(String(url), requestInit);
};

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

globalThis.onRequest = async (request, env, ctx) => {
  request = normalizeRequest(request);
  try {
    const referHost = request.headers.get('referer') && new URL(request.headers.get('referer')).host;
    const localhost = new URL(request.url).host;
    if ((referHost && (referHost !== localhost)) || (request.headers.get('x-provider-key') !== env.PROVIDER_KEY)) {
      return new Response(null, {
        status: 400
      });
    }
    if (request.url.includes('Special:Random')) {
      const rand = await Promise.all([getRandomWikipediaTitle(), getRandomWikipediaTitle()]);
      const rurl = 'https://' + localhost + '/merge/' + rand.join('/');
      return new Response(null, {
        status: 302,
        headers: {
          location: rurl
        }
      });
    }

    const urlparts = request.url.split("/");
    const title1 = decodeURIComponent(urlparts[4]).replaceAll("_", " ");
    const combined =
      `${decodeURIComponent(urlparts[4])} ${decodeURIComponent(urlparts[5])}`.replaceAll(
        "_",
        " ",
      );
    if (urlparts[3] === "merge") {
      const articles = await Promise.all([
        getArticle(env.FIND_ARTICLE_URL, urlparts[4], request.headers.get('user-agent')),
        getArticle(env.FIND_ARTICLE_URL, urlparts[5], request.headers.get('user-agent')),
      ]);
      let art1 = articles[0]?.split?.(/<main[^>]+>|<main[^>]*>/)?.[1]?.split?.("</main>")?.[0] || articles[0];
      let art2 = articles[1]?.split?.(/<main[^>]+>|<main[^>]*>/)?.[1]?.split?.("</main>")?.[0] || articles[1] || articles[0];
      return new Response(
        articles[0]
        .split(/<main[^>]+>|<main[^>]*>/)[0]
        .replace(
          /<title.+<\/title>/,
          `<title>${urlparts[4]} ${urlparts[5]}</title>`,
        ) +
        "<main>" +
        merger(art1, art2)
        .replaceAll(
          new RegExp(
            `([^a-zA-Z]|^)${escapeRegExp(title1)}(e?s?[^a-zA-Z]|$)`,
            "gi",
          ),
          `$1${combined}$2`,
        )
        .replaceAll(/<img [^>]*src?="[^"]+"/g, (x) => {
          const url = new URL(
            "https://image-gen.lenguapedia-services.workers.dev/",
          );
          const txt = x.replace(/[^a-zA-Z0-9]/g, " ");
          url.searchParams.set(
            "prompt",
            `${urlparts[5]} ${urlparts[5]} ${urlparts[4]}${urlparts[5]} ${txt}`,
          );
          return `<img loading="lazy" slop onload="this.setAttribute('loaded', 'true')" src="${url}"`;
        }) +
        "</main>" +
        `<style>
      button,title,a,th,thead,nav,b,strong,header,h1,h2,h3,h4{text-transform:capitalize;}
      img[src][srcset]{display:none;}
      .img-wrap {
  position: relative;
  display: inline-block;
}
xxmain img{width:100%;max-width:100vh;min-height:100% !important;}
/* Spinner shown by default */
.img-wrap::before {
  content: "";
  position: absolute;
  inset: 50%;
  width: 24px;
  height: 24px;
  margin: -12px;
  border: 3px solid #ddd;
  border-top-color: #333;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  z-index: 1;
}

/* Hide spinner when image is loaded */
.img-wrap:has(img[loaded="true"])::before {
  display: none;
}

.img-wrap{border:none !important;}

[class*="mw-logo"],
.mw-logo-wordmark,
main img {
  opacity: 0;
  transition: opacity 0.2s;
}


main img[loaded="true"] {
  opacity: 1;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
img[srcset]{display:none;}
      </style>
      <script>
      [...document.querySelectorAll('img[src][srcset]')].forEach(x=>x.removeAttribute('srcset'));
      [...document.querySelectorAll('img[slop]')].forEach(x=>x.parentElement.classList.add('img-wrap'));
      
      </script>` +
        articles[0].split("</main>")[1] +
        contentScripts, {
          headers: {
            "content-type": "text/html",
          },
        },
      );
    }
    let regres = await onLengRequest(request, env, ctx);
    if (regres.status >= 400) {
      try {
        let query = String(request.url.split("wiki")[1] || norm(decodeURIComponent(String(new URL(request.url).pathname))).replaceAll(/[^a-zA-Z0-9]/g, ' '));
        let parts = query.split(/\/|\s+/).map(x => x.trim()).filter(Boolean);
        let one;
        let two;
        if (parts.length > 1) {
          one = parts.slice(0, ~~(parts.length / 2)).join(' ');
          two = parts.slice(~~(parts.length / 2));
        } else {
          one = query.slice(0, ~~(query.length / 2));
          two = query.slice(~~(query.length / 2)).join(' ');
        }
        const loc =
          new URL(request.url).origin +
          "/merge/" +
          (
            [
              (await getTop2WikipediaTitles(one))[0],
              (await getTop2WikipediaTitles(two))[0]
            ]
          ).join("/");
        return new Response(null, {
          status: 302,
          headers: {
            location: loc,
          },
        });
      } catch (e) {
        console.warn(e, request.url);
      }
    }
    return regres;
  } catch (e) {
    return new Response(String(e), {
      status: 500,
      statusText: String(e),
    });
  }
};

export const onRequest = globalThis.onRequest;

async function onLengRequest(request, env, ctx) {
  const url = new URL(request.url);
  const reqHost = url.host;
  let res, req;
  for (const host of hostTargets) {
    url.host = host;
    const reqInit = {
      method: request.method,
      headers: request.headers,
    };
    if (request.body) {
      reqInit.body = request.body;
    }
    req = new Request(String(url), reqInit);
    res = await fetchResponse(req);
    if (/^[23]/.test(res.status)) {
      break;
    }
  }
  if (/script|text|json|html|xml/i.test(res.headers.get("content-type"))) {
    let bodyText = await res.text();
    for (const host of hostTargets) {
      bodyText = bodyText.replaceAll(host, reqHost);
    }
    if (/json/i.test(res.headers.get("content-type"))) {
      try {
        bodyText = JSON.stringify(JSON.parse(bodyText), null, 2);
      } catch {}
    }

    bodyText = bodyText.replace(/<\/head>/i, contentScripts + '</head>');
    const headers = new Headers(res.headers.entries());
    headers.delete('content-security-policy');
    res = new Response(bodyText, {
      status: res.status,
      statusText: res.statusText,
      headers
    });
  }
  return res;
}

async function getTop2WikipediaTitles(query) {
  query = decodeURIComponent(String(query)).replaceAll(/[^a-zA-Z]/g, " ");
  const fullQuery = `${query} -incategory:"Disambiguation pages"`
  const res = await fetch(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(fullQuery)}&srlimit=2&format=json&origin=*`, {
      headers: {
        "user-agent": "lenguapedia",
      },
    },
  );

  const data = await res.json();
  return (data.query?.search || []).map((result) => result.title);
}
