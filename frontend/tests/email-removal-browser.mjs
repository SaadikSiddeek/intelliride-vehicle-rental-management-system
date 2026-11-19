import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=process.env.UI_QA_OUTPUT||'qa-results/email-removal';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});const context=await browser.newContext();const requests=[],errors=[];let passes=0;
await context.route('**/api/**',async route=>{
 const req=route.request(),url=new URL(req.url());requests.push(url.pathname);assert(!/enquiries|notification_retry/.test(url.pathname));
 const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*','content-type':'application/json'};
 if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
 const data=url.pathname.endsWith('ai-health')?{available:true,provider_verified:false}:{reply:'IntelliRide organizes bookings, rentals and invoices. Contact ahamedsaadik1@gmail.com for product enquiries.',source:'knowledge'};
 await route.fulfill({status:200,headers,body:JSON.stringify(data)});
});
const page=await context.newPage();page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));const pass=s=>{passes++;console.log('PASS '+s);};
try{
 await page.goto((process.env.UI_BASE_URL||'http://localhost:3000')+'/',{waitUntil:'networkidle'});
 const mailto='mailto:ahamedsaadik1@gmail.com';assert.equal(await page.getByRole('link',{name:'Contact Us',exact:true}).first().getAttribute('href'),mailto);
 assert(await page.getByRole('link',{name:'ahamedsaadik1@gmail.com',exact:true}).count()>0);assert(await page.locator('a[href="'+mailto+'"]').count()>=5);
 assert.equal(await page.locator('#enquiry-message').count(),0);assert.equal(await page.getByRole('button',{name:'Enquire now',exact:true}).count(),0);pass('contact/navigation/pricing links use mailto; no enquiry form control');
 await page.locator('#faq summary').first().press('Enter');assert(await page.locator('#faq details').first().getAttribute('open')!==null);pass('FAQ remains keyboard accessible');
 for(const name of ['Dashboard','Bookings','Fleet','Active Rentals','Finance','Reports'])await page.getByRole('tab',{name,exact:true}).click();assert.equal(requests.length,0);pass('six demo views send no API requests');
 await page.getByRole('button',{name:'Open IntelliRide Assistant',exact:true}).click();await page.locator('#assistant-message').fill('What is IntelliRide?');await page.getByRole('button',{name:'Send public question',exact:true}).click();await page.getByText('IntelliRide organizes bookings, rentals and invoices.',{exact:false}).waitFor();assert.equal(await page.getByRole('link',{name:'Contact Sales',exact:true}).getAttribute('href'),mailto);pass('public assistant still submits chat and links to email (fixture reply)');
 await page.getByRole('button',{name:'Close assistant',exact:true}).click();await page.locator('#contact').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'contact-desktop.png')});
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.locator('#contact').screenshot({path:path.join(output,'contact-mobile.png')});pass('contact renders without mobile page overflow');
 assert.deepEqual(errors,[]);pass('no uncaught browser errors');fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({passes,requests,errors,fixtureOnly:true},null,2));
}finally{await browser.close();}
