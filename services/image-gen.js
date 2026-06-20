const cacheHeaders={};
const seconds = 31535000;
      for (const header of ["CDN-Cache-Control", "Cache-Control", "Cloudflare-CDN-Cache-Control", "Surrogate-Control", "Vercel-CDN-Cache-Control"]) {
        cacheHeaders[header]=`public, max-age=${seconds}, s-max-age=${seconds}, stale-if-error=31535000, stale-while-revalidate=31535000`;
      }
const promptCache = {};


export default {
  async fetch(request, env,ctx){
    const reqURL = new URL(request.url);
    const prompt = String(reqURL.searchParams.get('prompt') || request.headers.get('prompt') || reqURL.search).trim().toLowerCase()||'undefined'
    if(promptCache[prompt]){
      return new Response(new Uint8Array(promptCache[prompt]), {
        headers: {
          "content-type": "image/jpg",
           "access-control-allow-origin":"*",
           ...cacheHeaders
        },
      });
    }

    let inputs = {prompt,num_steps:4};

    let stream = await env.AI.run(
      "@cf/bytedance/stable-diffusion-xl-lightning",
      inputs
    );

    let resStream = new Response(stream);
      
    let bytes = await resStream.bytes();
    let avg = [...bytes].reduce((x,y)=>x+y,0)/bytes.length;

    if(avg < 89){
      inputs = {
        prompt:'a family friendly artistic image of '+prompt,
        num_steps:4
      };
      stream = await env.AI.run(
        "@cf/bytedance/stable-diffusion-xl-lightning",
        inputs
      );

     resStream = new Response(stream);
      
     bytes = await resStream.bytes();
    }
    avg = [...bytes].reduce((x,y)=>x+y,0)/bytes.length;

    if(avg < 89){
      inputs = {
        prompt:'a family friendly artistic image of '+prompt.split(/\s+/).map(x=>x.slice(0,-1)).join(' '),
        num_steps:4
      };
      stream = await env.AI.run(
        "@cf/bytedance/stable-diffusion-xl-lightning",
        inputs
      );
     resStream = new Response(stream);  
     bytes = await resStream.bytes();
    }

    promptCache[prompt]=[...bytes];
    return new Response(bytes, {
      headers: {
        "access-control-allow-origin":"*",
        "content-type": "image/jpg",
        ...cacheHeaders
      },
    });
  },
}
