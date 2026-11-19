// Real React pages in Chromium, isolated API fixtures. No request reaches Laravel.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.UI_BASE_URL || 'http://localhost:3000';
const output=process.env.UI_QA_OUTPUT || 'qa-results/form-regression';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.CHROMIUM_EXECUTABLE?undefined:'chrome',executablePath:process.env.CHROMIUM_EXECUTABLE});
const context=await browser.newContext({viewport:{width:1440,height:960}});
const calls=[],errors=[],passed=[];let rows=[],saved=null,failAvailability=false,emptyAvailability=false,slowAvailability=false;
const pass=name=>{passed.push(name);console.log('PASS '+name);};
const quote={duration_minutes:1440,units:1,billing_unit:'day',agreed_rate:'1000.00',package_name:'Daily',extras:[],discount:'0.00',total:'1000.00',subtotal:'1000.00',tax:'0.00',security_deposit:'0.00',extra_km_charge:'10.00',included_km:100,tax_basis_points:0};
await context.addInitScript(()=>{if(location.pathname==='/')return;localStorage.setItem('ACCESS_TOKEN','ISOLATED-API-FIXTURE');localStorage.setItem('LAST_ACTIVITY_AT',String(Date.now()));});
await context.route('**/api/**',async route=>{
 const req=route.request(),url=new URL(req.url()),ep=url.pathname.split('/').pop();
 const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*','content-type':'application/json'};
 if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
 const body=req.postData()?req.postDataJSON():{};calls.push({ep,query:Object.fromEntries(url.searchParams),body});
 let data={status:true,data:[]},status=200;
 if(ep==='user')data={ID:1,username:'Fixture Owner',status:true,authorization_mode:'legacy',permissions:{administration:true}};
 else if(ep==='business_branding')data={data:{display_name:'Fixture Rentals'}};
 else if(ep==='booking_options')data={status:true,data:{extras:[],tax_basis_points:0,timezone:'Asia/Colombo',can_override_pricing:false}};
 else if(ep==='get_bookings')data={status:true,data:rows};
 else if(ep==='customer_filter')data={success:true,data:[{id:1,text:'Synthetic Customer'}]};
 else if(ep==='booking_vehicle_filter'){
   if(failAvailability){status=503;data={message:'Fixture service unavailable'};}
   else {
     const stale=slowAvailability&&url.searchParams.get('expected_return_at')?.includes('-18T');
     if(stale)await new Promise(resolve=>setTimeout(resolve,600));
     data={success:true,data:!emptyAvailability&&url.searchParams.get('pickup_at')?[{id:1,text:stale?'STALE VEHICLE':'Toyota Axio — SYN-TEST'}]:[]};
   }
 }
 else if(ep==='booking_package_filter')data={success:true,data:[{id:1,text:'Daily — LKR 1000 / day'}]};
 else if(ep==='fetch_booking_data')data={status:true,data:{...saved,ID:1,customer_label:'Synthetic Customer',vehicle_label:'Toyota Axio — SYN-TEST',package_label:'Daily',pricing_snapshot:quote,payments:[]}};
 else if(ep==='quote_booking')data={status:true,data:quote};
 else if(ep==='save_booking'){
   saved={...body};rows=[{id:1,booking_code:'BKG-000001',full_name:'Synthetic Customer',vehicle_number:'SYN-TEST',...body,total:'1000.00',payment_status:'Unpaid'}];
   status=body.upd_id?200:201;data={status:true,data:{ID:1},message:'Fixture booking saved'};
 }
 else if(!['auth/activity','get_departments','get_designation','get_vehicles'].includes(ep))data={status:true,data:[]};
 await route.fulfill({status,headers,body:JSON.stringify(data)});
});
const page=await context.newPage();page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
async function chooseDate(id,day){
 await page.locator('#'+id).click();
 if(!await page.locator('.flatpickr-calendar.open').count())await page.locator('#'+id).click();
 const calendar=page.locator('.flatpickr-calendar.open');
 await calendar.locator('.flatpickr-day:not(.prevMonthDay):not(.nextMonthDay)').nth(day-1).click();
 await page.keyboard.press('Escape');
}
async function select(id,label){await page.locator('#'+id).click();await page.getByRole('option',{name:label,exact:true}).click();}
try{
 await page.goto(base+'/booking-management/manage');await page.getByRole('button',{name:'Add Booking',exact:true}).click();
 await page.locator('#pickup_at').waitFor();await page.locator('.form-drawer-footer button').last().click();
 assert.match(await page.locator('.form-drawer').innerText(),/Pickup date and time is required/);assert.match(await page.locator('.form-drawer').innerText(),/Expected return is required/);pass('empty pickup and return remain required');
 await chooseDate('pickup_at',15);await chooseDate('expected_return_at',16);
 const pickup=await page.locator('#pickup_at').inputValue(),end=await page.locator('#expected_return_at').inputValue();
 await select('customer_id','Synthetic Customer');await select('vehicle_id','Toyota Axio — SYN-TEST');
 assert(!/Pickup date and time is required|Expected return is required/.test(await page.locator('.form-drawer').innerText()));
 const available=calls.filter(c=>c.ep==='booking_vehicle_filter'&&c.query.pickup_at===pickup&&c.query.expected_return_at===end);assert(available.length>0);pass('picker state, cleared errors and exact availability parameters agree');
 await select('package_id','Daily — LKR 1000 / day');
 assert.equal(await page.locator('#pickup_at').inputValue(),pickup);assert.equal(await page.locator('#expected_return_at').inputValue(),end);pass('dates survive customer/vehicle/package rerenders');await page.screenshot({path:path.join(output,'booking-valid-dates.png')});
 await page.setViewportSize({width:390,height:844});const drawerBounds=await page.locator('.form-drawer').boundingBox();assert(drawerBounds.x>=-1&&drawerBounds.x+drawerBounds.width<=391);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.locator('#pickup_at').click();if(!await page.locator('.flatpickr-calendar.open').count())await page.locator('#pickup_at').click();await page.screenshot({path:path.join(output,'booking-mobile-calendar.png')});await page.keyboard.press('Escape');await page.setViewportSize({width:1440,height:960});pass('Booking drawer and date picker remain usable at 390px');

 await page.locator('.form-drawer-footer button').last().click();await page.locator('.form-drawer').waitFor({state:'hidden'});
 assert.equal(saved.pickup_at,pickup);assert.equal(saved.expected_return_at,end);assert(!('pickup_branch_id' in saved));assert.equal(calls.filter(c=>c.ep==='save_booking').length,1);pass('actual Booking submit sends exact dates and no branch fields once');
 await page.reload();await page.getByRole('button',{name:'Edit booking',exact:true}).click();await page.locator('#pickup_at').waitFor();
 assert.equal(await page.locator('#pickup_at').inputValue(),pickup);assert.equal(await page.locator('#expected_return_at').inputValue(),end);pass('refresh and edit hydrate dates and stored vehicle');
 await select('vehicle_id','Toyota Axio — SYN-TEST');assert(calls.some(c=>c.ep==='booking_vehicle_filter'&&c.query.exclude_booking_id==='1'));pass('edit preview excludes the current booking');
 await chooseDate('expected_return_at',14);await page.locator('.form-drawer-footer button').last().click();assert.match(await page.locator('.form-drawer').innerText(),/Return must be after pickup/);pass('inverted period remains rejected');
 await chooseDate('expected_return_at',17);await select('vehicle_id','Toyota Axio — SYN-TEST');assert(!/Return must be after pickup/.test(await page.locator('.form-drawer').innerText()));pass('correcting return revalidates and refreshes vehicle options');
 await select('package_id','Daily — LKR 1000 / day');await page.locator('.form-drawer-footer button').last().click();await page.locator('.form-drawer').waitFor({state:'hidden'});assert.equal(rows.length,1);assert.equal(saved.upd_id,1);pass('edit updates original fixture rather than adding another record');
 await page.getByRole('button',{name:'Edit booking',exact:true}).click();await page.locator('#pickup_at').waitFor();
 await page.getByRole('button',{name:'Clear pickup_at',exact:true}).click();assert.match(await page.locator('.form-drawer').innerText(),/Pickup date and time is required/);pass('clear resets form state and required validation');
 await chooseDate('pickup_at',15);emptyAvailability=true;await chooseDate('expected_return_at',18);await page.locator('#vehicle_id').click();await page.getByText('No vehicles are available for those dates.',{exact:false}).waitFor();pass('empty availability is explained');
 emptyAvailability=false;failAvailability=true;await chooseDate('expected_return_at',19);await page.locator('#vehicle_id').click();await page.getByText('Unable to load options. Please try again.',{exact:false}).first().waitFor();pass('availability failure produces a retryable error');failAvailability=false;
 slowAvailability=true;await chooseDate('expected_return_at',18);await chooseDate('expected_return_at',20);await new Promise(resolve=>setTimeout(resolve,750));
 await select('vehicle_id','Toyota Axio — SYN-TEST');assert.equal(await page.getByRole('option',{name:'STALE VEHICLE',exact:true}).count(),0);pass('a delayed previous-period response cannot replace current vehicle options');slowAvailability=false;
 await chooseDate('pickup_at',21);await page.locator('.form-drawer-footer button').last().click();assert.match(await page.locator('.form-drawer').innerText(),/Return must be after pickup/);
 await chooseDate('pickup_at',15);await select('vehicle_id','Toyota Axio — SYN-TEST');assert(!/Return must be after pickup/.test(await page.locator('.form-drawer').innerText()));pass('changing pickup revalidates the dependent return field');
 await page.getByRole('button',{name:'Close form',exact:true}).click();
 // Public screens use their own in-memory records; inspect them in the same real browser.
 await page.goto(base+'/');await page.evaluate(()=>localStorage.clear());await page.reload({waitUntil:'networkidle'});const start=calls.length;
 for(const width of [1920,1440,1024,768,390]){
   await page.setViewportSize({width,height:960});await page.locator('#platform').scrollIntoViewIfNeeded();
   const dimensions=await page.locator('.demo-content').evaluate(e=>({height:e.clientHeight,width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert(dimensions.height<=460);assert(dimensions.scroll<=dimensions.width+1);
   for(const name of ['Dashboard','Bookings','Fleet','Active Rentals','Finance','Reports'])await page.getByRole('tab',{name,exact:true}).click();
   const columns=await page.locator('.faq-list').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length);assert.equal(columns,width>960?2:1);
   await page.getByRole('tab',{name:'Dashboard',exact:true}).click();await page.locator('.interactive-product-demo').screenshot({path:path.join(output,'overview-'+width+'.png')});
 }
 assert.equal(calls.length,start);pass('five viewport sizes, six demo tabs, compact heights, FAQ columns and zero demo API calls');
 await page.setViewportSize({width:1440,height:960});await page.locator('.faq-list summary').first().press('Enter');assert(await page.locator('.faq-list details').first().getAttribute('open')!==null);pass('FAQ supports keyboard activation');
 await page.evaluate(()=>localStorage.setItem('intelliride-appearance-v1',JSON.stringify({appearance:'dark',lightPreset:'signature',darkPreset:'midnight'})));await page.reload({waitUntil:'networkidle'});await page.locator('#platform').scrollIntoViewIfNeeded();await page.locator('.interactive-product-demo').screenshot({path:path.join(output,'overview-dark.png')});assert(await page.evaluate(()=>document.documentElement.classList.contains('dark')));pass('compact overview renders in dark mode');
 assert.deepEqual(errors,[]);pass('no uncaught browser errors');
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({passed,errors,fixtureOnly:true,availability:available},null,2));console.log('TOTAL '+passed.length+' passed');
}catch(error){await page.screenshot({path:path.join(output,'failure.png'),fullPage:true});throw error;}finally{await browser.close();}
