const origin=process.argv[2]||'http://127.0.0.1:4173';
const routes=['/','/apps/site/home.html','/apps/site/platform.html','/apps/site/contact.html','/apps/site/about.html','/knowledge/','/calculator/','/portal/','/portal/?service=cbam&page=work','/portal/?service=pcf&page=pcf-data','/services/cbam/','/services/pcf/','/services/esg/','/services/ghg-inventory/','/services/carbon-assets/','/services/export-compliance/'];
const report=[];
for(const route of routes){
  try{const response=await fetch(`${origin}${route}`,{redirect:'follow'});report.push({route,status:response.status,ok:response.ok,contentType:response.headers.get('content-type')})}
  catch(error){report.push({route,status:0,ok:false,error:error.message})}
}
console.log(JSON.stringify(report,null,2));
if(report.some(item=>!item.ok))process.exitCode=1;
