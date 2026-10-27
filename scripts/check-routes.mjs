const origin=process.argv[2]||'http://127.0.0.1:4173';
const routes=['/','/Lumino%20%E5%AE%98%E7%BD%91.dc.html','/Lumino%20%E5%B9%B3%E5%8F%B0.dc.html','/Lumino%20%E8%81%94%E7%B3%BB.dc.html','/Lumino%20%E5%85%B3%E4%BA%8E.dc.html','/knowledge/','/calculator/','/portal/','/portal/?service=cbam&page=work','/portal/?service=pcf&page=pcf-data','/services/cbam/','/services/pcf/','/services/esg/','/services/ghg-inventory/','/services/carbon-assets/','/services/export-compliance/'];
const report=[];
for(const route of routes){
  try{const response=await fetch(`${origin}${route}`,{redirect:'follow'});report.push({route,status:response.status,ok:response.ok,contentType:response.headers.get('content-type')})}
  catch(error){report.push({route,status:0,ok:false,error:error.message})}
}
console.log(JSON.stringify(report,null,2));
if(report.some(item=>!item.ok))process.exitCode=1;
