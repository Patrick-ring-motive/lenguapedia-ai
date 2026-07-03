globalThis.env ??= {};
let imageModel;

const getImageModel = async () => {
  let model;
  try {
    const res = await fetch('https://best-image-model.api-cloud-flare.workers.dev/');
    model = (await res.json()).model;
  } catch {}
  return model || env.IMAGE_MODEL || "@cf/bytedance/stable-diffusion-xl-lightning";
};

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

const fetchBytes = async (...args) => {
  try {
    const res = await fetch(...args);
    return await res.bytes();
  } catch (e) {
    return new Response(String(e)).bytes();
  }
};

const fetchResponse = async (...args) => {
  try {
    return await fetch(...args);
  } catch (e) {
    return new Response(String(e), {
      status: 500,
      statusText: String(e)
    });
  }
};

cache.set = async (key, value) => {
  try {
    return await cache.put(key, value);
  } catch {}
};

const promptCache = {};

const aiRunBytes = async (...args) => {
  const inputs = args[1];
  inputs.num_steps = Math.min(Math.max(String(inputs.prompt).split(/\s/).length, 4), 20);
  args[1] = inputs;
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

const imgCache = {};

const imgDesc = async (url) => {
  try {
    if (imgCache[url]) {
      return imgCache[url];
    }
    const res = await fetchResponse(url);
    if (!/^2/.test(res.status)) {
      return {
        error: String(res.statusText)
      };
    }
    const imgBytes = [...await res.bytes()];
    const imgInput = {
      image: imgBytes,
      prompt: "Generate a prompt with which I can recreate this image",
      max_tokens: 512,
    };
    const desc = await env.AI.run("@cf/llava-hf/llava-1.5-7b-hf", imgInput);
    if (desc) {
      imgCache[url] = Object(desc);
    }
    return Object(desc);
  } catch (e) {
    return {
      error: String(e)
    };
  }
};

export async function onRequest(request, env, ctx) {
  /*if (!getRefHost(request)?.includes?.(env.REF_HOST)) {
    return new Response(request.url, {
      status: 400
    });
  }*/
  if (!imageModel) {
    imageModel = getImageModel();
  }
  if (imageModel instanceof Promise) {
    imageModel = await imageModel;
  }
  const reqURL = new URL(request.url);
  let prompt = String(reqURL.searchParams.get('prompt') || request.headers.get('prompt') || reqURL.search).trim().toLowerCase() || 'undefined'
  const image = reqURL.searchParams.get('image');
  const cacheKey = prompt; // snapshot BEFORE retry loop touches 

  if (promptCache[cacheKey]) {
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

  if (image) {
    const response = await imgDesc(image);
    inputs.prompt = JSON.stringify({
      ...response,
      prompt,
      url: image
    });
    prompt = inputs.prompt;
  }

  if (promptCache[cacheKey]) {
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
      promptCache[cacheKey] = [...await cacheRes.clone().bytes()];
      return cacheRes.clone();
    }
  }

  let bytes = await aiRunBytes(imageModel, inputs);
  let avg = [...bytes].reduce((x, y) => x + y, 0) / bytes.length;

  if (avg < 89) {
    inputs.prompt = 'a family friendly artistic image of ' + prompt;
    bytes = await aiRunBytes(imageModel, inputs);
    avg = [...bytes].reduce((x, y) => x + y, 0) / bytes.length;
  }

  let retryPrompt = prompt;
  const numRetries = 3;
  for (const _ of Array(numRetries)) {
    retryPrompt = retryPrompt.replace(/[^a-zA-Z]/g, ' ')
      .split(/\s+/)
      .map(x => x.trim())
      .filter(Boolean)
      .map(x => x.length > 3 ? x.slice(0, -1) : x)
      .filter(Boolean)
      .join(' ');
    if (avg < 89) {
      inputs.prompt = retryPrompt;
      bytes = await aiRunBytes(imageModel, inputs);
      avg = [...bytes].reduce((x, y) => x + y, 0) / bytes.length;
    } else {
      break;
    }

    if (avg < 89) {
      inputs.prompt = 'a family friendly artistic image of ' + retryPrompt;
      bytes = await aiRunBytes(imageModel, inputs);
      avg = [...bytes].reduce((x, y) => x + y, 0) / bytes.length;
    } else {
      break;
    }
  }

  if (avg >= 89) {
    promptCache[cacheKey] = [...bytes];
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
