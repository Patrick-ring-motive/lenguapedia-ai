const hostTargets = [
  "en.wikipedia.org",
  "www.wikidata.org",
  "en.wiktionary.org",
];

if (typeof env === "undefined") {
  globalThis.env = {};
}

const contentScripts = ``;

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

const fetchText = async (...args) => {
  try {
    return await (await fetchResponse(...args)).text();
  } catch (e) {
    return String(e);
  }
};

const onLengRequestText = async (...args) => {
  try {
    return await (await onLengRequest(new Request(...args))).text();
  } catch (e) {
    return String(e);
  }
};

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

globalThis.onRequest = async (request, env, ctx) => {
  try {
    const referHost = request.headers.get('referer') && new URL(request.headers.get('referer')).host;
    const localhost = new URL(request.url).host;
    if (referHost && referHost !== localhost) {
      return new Response(null, {
        status: 400
      });
    }
    const urlparts = request.url.split("/");
    const title1 = decodeURIComponent(urlparts[4]).replaceAll("_", " ");
    const combined =
      `${decodeURIComponent(urlparts[4])} ${decodeURIComponent(urlparts[5])}`.replaceAll(
        "_",
        " ",
      );
    let regres = await onLengRequest(request, env, ctx);
    if (regres.status >= 400) {
      try {
        const loc =
          new URL(request.url).origin +
          "/merge/" +
          (
            await getTop2WikipediaTitles(String(request.url.split("wiki")[1]))
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
    if (/html/i.test(res.headers.get("content-type"))) {
      bodyText += contentScripts;
    }
    res = new Response(bodyText, res);
  }
  return res;
}

async function getTop2WikipediaTitles(query) {
  query = decodeURIComponent(String(query)).replaceAll(/[^a-zA-Z]/g, " ");
  const res = await fetch(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=2&format=json&origin=*`, {
      headers: {
        "user-agent": "lenguapedia",
      },
    },
  );

  const data = await res.json();
  return (data.query?.search || []).map((result) => result.title);
}
