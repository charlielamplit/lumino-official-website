import { mkdir, writeFile } from 'node:fs/promises';

const cdpPort=process.argv[2]||'9223';
const origin=process.argv[3]||'http://127.0.0.1:4173';
const outputDir=new URL('../outputs/review/',import.meta.url);
await mkdir(outputDir,{recursive:true});

const target=await fetch(`http://127.0.0.1:${cdpPort}/json/new?about:blank`,{method:'PUT'}).then(response=>response.json());
const socket=new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})});

let id=0;
const pending=new Map();
let pageIssues=[];
socket.addEventListener('message',event=>{
  const message=JSON.parse(event.data);
  if(message.id&&pending.has(message.id)){
    const task=pending.get(message.id);pending.delete(message.id);
    if(message.error)task.reject(new Error(message.error.message));else task.resolve(message.result);
    return;
  }
  if(message.method==='Runtime.exceptionThrown')pageIssues.push(`exception: ${message.params.exceptionDetails.text}`);
  if(message.method==='Runtime.consoleAPICalled'&&message.params.type==='error')pageIssues.push(`console: ${message.params.args.map(item=>item.value||item.description||'').join(' ')}`);
  if(message.method==='Network.responseReceived'&&message.params.response.status>=400)pageIssues.push(`http ${message.params.response.status}: ${message.params.response.url}`);
});
const call=(method,params={})=>new Promise((resolve,reject)=>{const messageId=++id;pending.set(messageId,{resolve,reject});socket.send(JSON.stringify({id:messageId,method,params}))});
const sleep=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));

await call('Page.enable');
await call('Runtime.enable');
await call('Network.enable');
await call('Network.setCacheDisabled',{cacheDisabled:true});

async function viewport(width,height){
  await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=520,screenWidth:width,screenHeight:height});
}

async function navigate(path){
  pageIssues=[];
  await call('Page.navigate',{url:`${origin}${path}`});
  for(let attempt=0;attempt<30;attempt+=1){
    await sleep(200);
    const ready=await call('Runtime.evaluate',{returnByValue:true,expression:'document.readyState'});
    if(ready.result.value==='complete')break;
  }
  await sleep(900);
  await call('Runtime.evaluate',{expression:'scrollTo(0,0)'});
  await sleep(100);
}

async function audit(name,path,width){
  await viewport(width,width<=520?844:900);
  await navigate(path);
  const result=await call('Runtime.evaluate',{returnByValue:true,expression:`(()=>{const root=document.documentElement;const viewportWidth=root.clientWidth;const visible=element=>!element.closest('[hidden]')&&getComputedStyle(element).display!=='none'&&getComputedStyle(element).visibility!=='hidden';const horizontalOverflow=root.scrollWidth>viewportWidth+1;const offenders=horizontalOverflow?[...document.querySelectorAll('body *')].filter(element=>visible(element)&&!element.classList.contains('skip')).filter(element=>{const rect=element.getBoundingClientRect();return rect.right>viewportWidth+1||rect.left<-1}).slice(0,8).map(element=>({tag:element.tagName,className:String(element.className||''),text:(element.textContent||'').trim().slice(0,48)})):[];return{title:document.title,h1Count:[...document.querySelectorAll('h1')].filter(visible).length,mainCount:[...document.querySelectorAll('main')].filter(visible).length,primaryActions:[...document.querySelectorAll('main .button--primary,main button.button--primary')].filter(visible).length,viewportWidth,scrollWidth:root.scrollWidth,horizontalOverflow,offenders,brokenImages:[...document.images].filter(image=>visible(image)&&image.complete&&image.naturalWidth===0).map(image=>image.getAttribute('src')),positiveTabIndex:[...document.querySelectorAll('[tabindex]')].filter(element=>visible(element)&&Number(element.getAttribute('tabindex'))>0).length,currentPageCount:[...document.querySelectorAll('[aria-current="page"]')].filter(visible).length}})()`});
  return {...result.result.value,issues:[...new Set(pageIssues)]};
}

async function screenshot(name,path,width,height,fullPage=true){
  await viewport(width,height);
  await navigate(path);
  let clip;
  if(fullPage){
    const metrics=await call('Page.getLayoutMetrics');
    const size=metrics.cssContentSize||metrics.contentSize;
    clip={x:0,y:0,width:Math.ceil(size.width),height:Math.min(Math.ceil(size.height),16000),scale:1};
  }
  const result=await call('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:fullPage,...(clip?{clip}:{})});
  await writeFile(new URL(`${name}.png`,outputDir),Buffer.from(result.data,'base64'));
}

await screenshot('portal-service-overview','/apps/portal/?demoRole=customer_owner',1280,800,false);

const pages=[
  ['home','/apps/site/Lumino%20%E5%AE%98%E7%BD%91.dc.html'],
  ['platform','/apps/site/Lumino%20%E5%B9%B3%E5%8F%B0.dc.html'],
  ['cbam','/apps/site/services/cbam/'],['pcf','/apps/site/services/pcf/'],['esg','/apps/site/services/esg/'],
  ['ghg-inventory','/apps/site/services/ghg-inventory/'],['carbon-assets','/apps/site/services/carbon-assets/'],['export-compliance','/apps/site/services/export-compliance/'],
  ['about','/apps/site/Lumino%20%E5%85%B3%E4%BA%8E.dc.html'],['contact','/apps/site/Lumino%20%E8%81%94%E7%B3%BB.dc.html?serviceId=pcf&source=review'],['knowledge','/apps/site/knowledge/'],
  ['portal','/apps/portal/?demoRole=customer_owner'],
  ['portal-assets-owner','/apps/portal/?demoRole=customer_owner&page=shared-files'],
  ['portal-assets-contributor','/apps/portal/?demoRole=customer_contrib&page=shared-files'],
  ['portal-tasks-owner','/apps/portal/?demoRole=customer_owner&page=shared-tasks'],
  ['portal-tasks-contributor','/apps/portal/?demoRole=customer_contrib&page=shared-tasks'],
  ['portal-tasks-approver','/apps/portal/?demoRole=customer_approver&page=shared-tasks'],
  ['portal-deliverables-owner','/apps/portal/?demoRole=customer_owner&page=shared-deliverables'],
  ['portal-deliverables-contributor','/apps/portal/?demoRole=customer_contrib&page=shared-deliverables']
];
const report={};
for(const width of [390,768,1440]){
  report[width]={};
  for(const [name,path] of pages)report[width][name]=await audit(name,path,width);
}

await screenshot('home-desktop','/apps/site/Lumino%20%E5%AE%98%E7%BD%91.dc.html',1440,1000);
await screenshot('home-mobile','/apps/site/Lumino%20%E5%AE%98%E7%BD%91.dc.html',390,844);
await screenshot('platform-desktop','/apps/site/Lumino%20%E5%B9%B3%E5%8F%B0.dc.html',1440,1000);
await screenshot('cbam-desktop','/apps/site/services/cbam/',1440,1000);
await screenshot('cbam-mobile','/apps/site/services/cbam/',390,844);
await screenshot('pcf-desktop','/apps/site/services/pcf/',1440,1000);
await screenshot('pcf-mobile','/apps/site/services/pcf/',390,844);
await screenshot('esg-desktop','/apps/site/services/esg/',1440,1000);
await screenshot('portal-mobile','/apps/portal/?demoRole=customer_owner',390,844);
await screenshot('portal-assets-desktop','/apps/portal/?demoRole=customer_owner&page=shared-files',1440,1000);
await screenshot('portal-assets-mobile','/apps/portal/?demoRole=customer_owner&page=shared-files',390,844);
await screenshot('portal-tasks-desktop','/apps/portal/?demoRole=customer_owner&page=shared-tasks',1440,1000);
await screenshot('portal-tasks-mobile','/apps/portal/?demoRole=customer_owner&page=shared-tasks',390,844);
await screenshot('portal-deliverables-desktop','/apps/portal/?demoRole=customer_owner&page=shared-deliverables',1440,1000);
await screenshot('portal-deliverables-mobile','/apps/portal/?demoRole=customer_owner&page=shared-deliverables',390,844);
await writeFile(new URL('browser-audit.json',outputDir),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
socket.close();
