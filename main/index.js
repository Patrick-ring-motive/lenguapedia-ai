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

const fetchText = async (...args) => {
  try {
    return await (await fetchResponse(...args)).text();
  } catch (e) {
    return String(e);
  }
}

const onLengRequestText = async (...args) => {
  try {
    return await (await onLengRequest(new Request(...args))).text();
  } catch (e) {
    return String(e);
  }
}

const hostTargets = [
  'en.wikipedia.org',
  'www.wikidata.org',
  'en.wiktionary.org'
];

function merger(article1, article2) {
  const replacers = ['the', 'a', 'an', 'and', 'of', 'to', 'in', 'as', 'has', 'is', 'it', 'for', 'on', 'was', 'are'];
  const rex = replacers.map(x => RegExp(`\\b${x}\\s+(a\\s+|an\\s+|the\\s+)?\\w+\\b`, "g"));
  for (const r of rex) {
    const matches = (String(article2).replace(/\n/g, ' ').match(r) || []).filter(x => !['a href', 'a rel'].includes(x) && !replacers.some(y => x.endsWith(' ' + y)));
    let i = 0;
    if (!matches.length) continue;
    article1 = String(article1).replace(/\n/g, ' ').replaceAll(r, x => {
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

export async function onRequest(request, env, ctx) {
  try {
    const urlparts = request.url.split('/');
    if (urlparts[3] === 'merge') {
      const articles = await Promise.all([
        onLengRequestText(`https://en.wikipedia.org/wiki/${urlparts[4]}`, {
          headers: request.headers
        }),
        onLengRequestText(`https://en.wikipedia.org/wiki/${urlparts[5]}`, {
          headers: request.headers
        })
      ]);
      let art1 = articles[0].split(/<main[^>]+>/)[1].split('</main>')[0];
      let art2 = articles[1].split(/<main[^>]+>/)[1].split('</main>')[0];
      return new Response(articles[0].split(/<main[^>]+>/)[0].replace(/<title.+<\/title>/, `<title>${urlparts[4]} ${urlparts[5]}</title>`) +
        '<main>' +
        merger(art1, art2)
        .replaceAll(RegExp(`(^|\\b)${decodeURIComponent(urlparts[4]).replaceAll('_',' ')}`, "gi"), `${decodeURIComponent(urlparts[4])} ${decodeURIComponent(urlparts[5])}`.replaceAll('_', ' '))
        // .replaceAll(urlparts[4].toLowerCase(),`${decodeURIComponent(urlparts[4])} ${decodeURIComponent(urlparts[5])}`.toLowerCase().replaceAll('_',' '))
        .replaceAll(/<img [^>]*src?="[^"]+"/g, x => {
          const url = new URL('https://image-gen.lenguapedia-services.workers.dev/');
          const txt = x.replace(/[^a-zA-Z0-9]/g, ' ');
          url.searchParams.set('prompt', `${urlparts[5]} ${urlparts[5]} ${urlparts[4]}${urlparts[5]} ${txt}`);
          return (`<img loading="lazy" slop onload="this.setAttribute('loaded', 'true')" src="${url}"`);
        }) +
        '</main>' +
        `<style>
      nav,b,strong,header,h1,h2,h3,h4{text-transform:capitalize;}
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
        articles[0].split('</main>')[1] +
        `<script>
      const updateAttribute = (el,k,v)=>{
        try{
          const val = el.getAttribute(k);
          if(val != v){
            el.setAttribute(k,v);
          }
        }catch(e){
          console.warn(e,el,k,v);
        } 
      };
      const hostTargets = ${JSON.stringify(hostTargets)};
      for(const host of hostTargets){
        [...document.querySelectorAll('a[href]')].forEach(x=>updateAttribute(x,'href',x.href.replace(host,location.host)));
      }
        const ie = [...document.querySelectorAll('img')];
        for(const i of ie){
          i.onerror =(()=>{ i.src='https://image-gen.lenguapedia-services.workers.dev?prompt='+String(i.outerHTML);});
        }
          const ax = [...document.querySelectorAll('main a[href]')];
          for(const x of ax){
            x.href='/wiki/'+x.textContent;
          }
          let clicked;
          document.addEventListener("readystatechange", () => {
            if(clicked)return;
            try{
              [...document.querySelectorAll('main #vector-appearance button')].filter(x=>x.innerText=='hide').map(x=>xclick());
            }catch{
              return;
            }
            clicked = true;
          });
          document.addEventListener("readystatechange", () => {
              const imgs = [...document.querySelectorAll('figure:has(img:not([loaded="true"]))')];
              for(const i of imgs){
                (i.querySelector('img')??{}).src+=String(i.textContent||i.innerText);
              }
          });

      </script>`, {
          headers: {
            'content-type': 'text/html'
          }
        });
    }
    let regres = await onLengRequest(request, env, ctx);
    if (regres.status >= 400) {
      try {
        const loc = new URL(request.url).origin + '/merge/' + (await getTop2WikipediaTitles(String(request.url.split('wiki')[1]))).join('/');
        return new Response(null, {
          status: 302,
          headers: {
            location: loc
          }
        });
      } catch (e) {
        console.warn(e, request.url);
      }
    }
    return regres;
  } catch (e) {
    return new Response(String(e), {
      status: 500,
      statusText: String(e)
    });
  }
};

async function onLengRequest(request, env, ctx) {
  const url = new URL(request.url);
  const reqHost = url.host;
  let res, req;
  for (const host of hostTargets) {
    url.host = host;
    const reqInit = {
      method: request.method,
      headers: request.headers
    };
    if (request.body) {
      reqInit.body = request.body;
    }
    req = new Request(String(url), reqInit)
    res = await fetchResponse(req);
    if (/^[23]/.test(res.status)) {
      break;
    }
  }
  let body = res.body;
  if (/script|text|json|html|xml/i.test(res.headers.get('content-type'))) {
    body = await res.text();
    for (const host of hostTargets) {
      body = body.replaceAll(host, reqHost);
    }
    if (/json/i.test(res.headers.get('content-type'))) {
      try {
        body = JSON.stringify(JSON.parse(body), null, 2);
      } catch {}
    }
  }
  return new Response(body, res);
}

async function getTop2WikipediaTitles(query) {
  query = decodeURIComponent(String(query)).replaceAll(/[^a-zA-Z]/g, ' ');
  const res = await fetch(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=2&format=json&origin=*`, {
      headers: {
        'user-agent': 'lenguapedia'
      }
    }
  );

  const data = await res.json();
  return (data.query?.search || []).map(result => result.title);
}
