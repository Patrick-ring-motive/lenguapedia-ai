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
          document.addEventListener("readystatechange", (event) => {
            if(clicked)return;
            try{
              [...document.querySelectorAll('main #vector-appearance button')].filter(x=>x.innerText=='hide').map(x=>xclick());
            }catch{
              return;
            }
            clicked = true;
          });
