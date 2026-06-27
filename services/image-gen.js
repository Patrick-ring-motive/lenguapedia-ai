globalThis.env ??= {};
let imageModel = env.IMAGE_MODEL;
const cacheHeaders = {};
const seconds = 31535000;
for (const header of ["CDN-Cache-Control", "Cache-Control", "Cloudflare-CDN-Cache-Control", "Surrogate-Control", "Vercel-CDN-Cache-Control"]) {
  cacheHeaders[header] = `public, max-age=${seconds}, s-max-age=${seconds}, stale-if-error=31535000, stale-while-revalidate=31535000`;
}

const cache = caches.default;
cache.get = async (key) => {
  try {
    return await cache.match(key);
  } catch {}
};

const fetchBytes = async(...args)=>{
  try{
    const res = await fetch(...args);
    return await res.bytes();
  }catch(e){
    return new Response(String(e)).bytes();
  }
};

cache.set = async (key, value) => {
  try {
    return await cache.put(key, value);
  } catch {}
};

const promptCache = {};

const aiRunBytes = async (...args) => {
  const stream = await env.AI.run(...args);
  const resStream = new Response(stream);
  const bytes = await resStream.bytes();
  return bytes;
};

const imgDefaults = {
  num_steps: 4
};

const getRefHost = req => {
  try {
    const {
      headers
    } = req;
    let host = '';
    try {
      host = new URL(headers.get('referer')).host;
    } catch {}
    host ||= headers.get('x-forwarded-host') || '';
    return host;
  } catch {}
  return '';
};

export async function onRequest(request, env, ctx) {
  /*if (!getRefHost(request)?.includes?.(env.REF_HOST)) {
    return new Response(request.url, {
      status: 400
    });
  }*/
  const reqURL = new URL(request.url);
  const prompt = String(reqURL.searchParams.get('prompt') || request.headers.get('prompt') || reqURL.search).trim().toLowerCase() || 'undefined'
  const image = reqURL.searchParams.get('image');
    if (promptCache[prompt]) {
    return new Response(new Uint8Array(promptCache[prompt]), {
      headers: {
        "content-type": "image/jpg",
        "access-control-allow-origin": "*",
        ...cacheHeaders
      },
    });
  } else {
    const cacheRes = await cache.get(request.url);
    if (cacheRes) {
      promptCache[prompt] = [...await cacheRes.clone().bytes()];
      return cacheRes.clone();
    }
  }

  let inputs = {
    prompt,
    ...imgDefaults
  };

  if(image){
    inputs.image = await fetchBytes(image);
  }

  let bytes = await aiRunBytes(imageModel, inputs);
  let avg = [...bytes].reduce((x, y) => x + y, 0) / bytes.length;

  if (avg < 89) {
    inputs.prompt = 'a family friendly artistic image of ' + prompt;
    bytes = await aiRunBytes(imageModel, inputs);
    avg = [...bytes].reduce((x, y) => x + y, 0) / bytes.length;
  }

  if (avg < 89) {
    inputs.prompt = prompt.split(/\s+/).map(x => x.slice(0, -1)).join(' ');
    bytes = await aiRunBytes(imageModel, inputs);
    avg = [...bytes].reduce((x, y) => x + y, 0) / bytes.length;
  }

  if (avg < 89) {
    inputs.prompt = 'a family friendly artistic image of ' + inputs.prompt;
    bytes = await aiRunBytes(imageModel, inputs);
    avg = [...bytes].reduce((x, y) => x + y, 0) / bytes.length;
  }

  if (avg >= 89) {
    promptCache[prompt] = [...bytes];
    await cache.set(request.url, new Response(bytes, {
      headers: {
        "access-control-allow-origin": "*",
        "content-type": "image/jpg",
        ...cacheHeaders
      }
    }));
  }
  return new Response(bytes, {
    headers: {
      "access-control-allow-origin": "*",
      "content-type": "image/jpg",
      ...cacheHeaders
    },
  });
}
