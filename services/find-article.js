const hostTargets = [
  "en.wikipedia.org",
  "www.wikidata.org",
  "en.wiktionary.org",
];

if (typeof env === "undefined") {
  globalThis.env = {};
}


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


globalThis.onRequest = async (request, env, ctx) => {
    const referHost = request.headers.get('referer') && new URL(request.headers.get('referer')).host;
    const url = new URL(request.url);
    const title = url.searchParams.get('title');
    const reqHost = url.host;
    /*if (referHost && referHost !== reqHost) {
      return new Response(null, {
        status: 400
      });
    }*/

    const reqInit = {
      headers: {'user-agent':'lenguapedia','cahce-control':'no-cache'},
    };

    let res, req;
    for (const host of hostTargets) {
      url.host = host;
      url.pathname = `/wiki/${title}`;
      url.search='';
      console.log(String(url));
      if (request.body) {
        reqInit.body = request.body;
      }
      req = new Request(String(url), reqInit);
      res = await fetchResponse(req);
      if (/^2/.test(res.status)) {
        break;
      }
    }
    if(!/^2/.test(res.status)){
      const newTitle = await getTopWikiTitle(title);
      res = await fetch(`https://en.wikipedia.org/wiki/${newTitle}`,reqInit);
    }
    return res;
};

export const onRequest = globalThis.onRequest;


async function getTopWikiTitle(query) {
  query = decodeURIComponent(String(query)).replaceAll(/[^a-zA-Z]/g, " ");
  const res = await fetch(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=2&format=json&origin=*`, {
      headers: {
        "user-agent": "lenguapedia",
      },
    },
  );

  const data = await res.json();
  return (data.query?.search || []).map((result) => result.title)[0];
}
export default {
  async fetch(request, env, ctx) {
    return onRequest(request,env,ctx);
  }
};
