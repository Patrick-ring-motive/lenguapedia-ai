(() => {
  globalThis.env ??= {};
  env.hostTargets ??= [];

  const updateAttribute = (el, k, v) => {
    try {
      const val = el.getAttribute(k);
      if (val != v) {
        el.setAttribute(k, v);
      }
    } catch (e) {
      console.warn(e, el, k, v);
    }
  };

  const swapWiki = () => {
    document.title = decodeURIComponent(document.title);
    const docTitle = document.title;
    const artTitle = document.querySelector('.mw-page-title-main')?.textContent;
    let node, walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    while (node = walk.nextNode()) {
      if (node.parentElement.tagName == 'SCRIPT') {
        continue;
      }
      if (node.parentElement.tagName == 'STYLE') {
        continue;
      }
      let nodeText = node.textContent;
      nodeText = nodeText.replaceAll(/wikipedia/gi, 'Lenguapedia');
      if(artTitle && artTitle !== docTitle && location.href.includes('merge')){
        nodeText = nodeText.replaceAll(RegExp(artTitle,'gi'),docTitle);
      }
      if (nodeText != node.textContent) {
        node.textContent = nodeText;
      }

    }
    const singles = [...document.querySelectorAll(':not(:has(*)):not(style):not(script)')];
    for (const x of singles) {
      const txt = (x.textContent || x.innerText).replaceAll(/wikipedia/gi, 'Lenguapedia');
      if (txt != (x.textContent || x.innerText)) {
        x.textContent = txt;
      }
    }
    document.querySelector('[data-text="Dark"]')?.click?.();
  };

  for (const host of env.hostTargets) {
    [...document.querySelectorAll('a[href]')].forEach(x => updateAttribute(x, 'href', x.href.replace(host, location.host)));
  }
  const ie = [...document.querySelectorAll('img')];
  for (const i of ie) {
    i.onerror = (() => {
      i.src = 'https://image-gen.lenguapedia-services.workers.dev?prompt=' + String(i.outerHTML).replaceAll(/src.+workers.dev/gi, '');
    });
  }
  const ax = [...document.querySelectorAll('main a[href]')];
  for (const x of ax) {
    x.href = '/wiki/' + x.textContent;
  }
  let clicked;
  document.addEventListener("readystatechange", () => {
    if (clicked) return;
    try {
      const btns = [...document.querySelectorAll('main #vector-appearance button')].filter(x => x.innerText == 'hide');
      if (!btns.length) {
        return;
      }
      btns.map(x => x.click());
    } catch {
      return;
    }
    clicked = true;
  });
  document.addEventListener("readystatechange", () => {
    swapWiki()
    const imgs = [...document.querySelectorAll('figure:has(img:not([loaded="true"]))')];
    for (const i of imgs) {
      (i.querySelector('img') ?? {}).src += String(i.textContent || i.innerText);
    }
  });
  swapWiki();
  const style = document.createElement('style');
  style.textContent = `
  button,title,a,th,thead,nav,b,strong,header,h1,h2,h3,h4{text-transform:capitalize;}
  
  img[src*="wikipedia-wordmark"],[class*="mw-logo"]{opacity:0 !important;}
  `;
  (document.body || document.firstElementChild).appendChild(style);
})();
(async () => {
  // await import('https://patrick-ring-motive.github.io/electric/color.js');
  // await import('https://patrick-ring-motive.github.io/electric/hooks.js');
})();

(() => {
  const onReady = fn => {
    if (['complete', 'interactive'].includes(document.readyState)) {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  };
  const redirect = () => {
    const doc = String((document.body || document.firstElemenChild).innerHTML).toLowerCase();
    if (/Does\s+Not\s+Have\s+An\s+Article\s+With\s+This\s+Exact\s+Name/i.test(doc)) {
      let query = decodeURIComponent(String(location.pathname.split("wiki")[1])).replaceAll('_', ' ');
      let parts = query.split(/\/|\s+/).map(x => x.trim()).filter(Boolean);
      let one;
      let two;
      if (parts.length > 1) {
        one = parts.slice(0, parts.length / 2).join(' ');
        two = parts.slice(parts.length / 2);
      } else {
        one = query.slice(0, query.length / 2);
        two = query.slice(query.length / 2).join(' ');
      }
      location.href =
        location.origin +
        "/merge/" +
        (
          [
            one,
            two
          ]
        ).join("/").replaceAll(',', ' ');
    }
  };
  onReady(redirect);
  document.addEventListener("readystatechange", redirect);
})();
