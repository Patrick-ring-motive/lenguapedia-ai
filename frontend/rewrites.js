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
      if (nodeText != node.textContent) {
        node.textContent = nodeText;
      }

    }
    const singles = [...document.querySelectorAll(':not(:has(*)):not(style):not(script)')];
    for (const x of singles) {
      const txt = (x.textContent || x.innerText).replaceAll(/wikipedia/gi, 'Lenguapedia');
      if(txt != (x.textContent || x.innerText)){
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
      i.src = 'https://image-gen.lenguapedia-services.workers.dev?prompt=' + String(i.outerHTML);
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
  
})();
(async()=>{
 // await import('https://patrick-ring-motive.github.io/electric/color.js');
 // await import('https://patrick-ring-motive.github.io/electric/hooks.js');
})();
