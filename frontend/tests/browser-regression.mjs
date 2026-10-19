// Run against a local Vite server: node tests/browser-regression.mjs
// Optional environment overrides: UI_BASE_URL, PLAYWRIGHT_MODULE, CHROMIUM_EXECUTABLE, UI_QA_OUTPUT.
// Uses controlled API fixtures only. Never sends a request to your Laravel server.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { presets, APPEARANCE_KEY } from "../src/contexts/appearance-config.js";
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base=process.env.UI_BASE_URL || "http://127.0.0.1:3000";
const output=process.env.UI_QA_OUTPUT || "qa-results";
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE || undefined,args:["--no-sandbox","--disable-dev-shm-usage","--disable-gpu","--no-zygote","--single-process"]});
const results=[];const errors=[];const requests=[];let rejectSave="";let emptyDepartment=false;
const data={
 department:{id:"99",ID:"99",department_name:"Operations",status:1},
 designation:{id:"99",ID:"99",designation_name:"Fleet coordinator",status:1},
 user:{id:"99",ID:"99",username:"Preview User",email:"user@example.test",emp_id:"1",role_id:"1"},
 staff:{id:"99",ID:"99",employee_code:"EMP-001",full_name:"Preview User",email:"staff@example.test",branch:"Main",designation:"Coordinator",department:"Operations",status:1},
 staffEdit:{ID:"99",emp_code:"EMP-001",first_name:"Preview",last_name:"User",gender:"Male",nic:"200012345678",phone:"0771234567",email:"staff@example.test",address:"Test address",branch_id:"1",designation_id:"1",department_id:"1",join_date:"2026-10-01",status:1},
};
const cors={"access-control-allow-origin":"*","access-control-allow-headers":"*","access-control-allow-methods":"GET,POST,OPTIONS","content-type":"application/json"};
async function fixture(context){
 await context.route("**/api/**",async route=>{
  const request=route.request(), endpoint=new URL(request.url()).pathname.split("/").pop();
  if(request.method()==="OPTIONS"){await route.fulfill({status:204,headers:cors});return;}
  const body=request.postData();requests.push({endpoint,method:request.method(),body:body?JSON.parse(body):null,authorization:request.headers().authorization});
  let response={data:[]},status=200;
  if(endpoint==="user")response={name:"Workspace User",email:"preview@example.test"};
  else if(endpoint==="login"||endpoint==="signup")response={user:{name:"Workspace User"},token:"UI-FIXTURE-TOKEN"};
  else if(endpoint==="get_department")response={data:emptyDepartment?[]:[data.department]};
  else if(endpoint==="get_designation")response={data:[data.designation]};
  else if(endpoint==="get_users")response={data:[data.user]};
  else if(endpoint==="get_staff")response={data:[data.staff]};
  else if(endpoint==="fetch_department_data")response={data:data.department};
  else if(endpoint==="fetch_designation_data")response={data:data.designation};
  else if(endpoint==="fetch_user_data")response={data:data.user};
  else if(endpoint==="fetch_staff_data")response={data:data.staffEdit};
  else if(endpoint===rejectSave){status=422;const field=endpoint==="save_user"?"username":endpoint==="save_staff"?"first_name":endpoint==="save_role"?"role_name":endpoint==="save_designation"?"designation_name":"department_name";response={errors:{[field]:["Fixture field validation message"]}};}
  await route.fulfill({status,headers:cors,body:JSON.stringify(response)});
 });
 await context.route("https://upload.wikimedia.org/**",route=>route.abort());
}
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await fixture(context);const page=await context.newPage();page.setDefaultTimeout(7000);
page.on("pageerror",error=>errors.push(error.message));
const pass=name=>{results.push(name);console.log("PASS "+name);};
const goto=async url=>{await page.goto(base+url,{waitUntil:"networkidle"});await page.locator("body").waitFor();};
const noOverflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,"Page overflow");
const submitButton=()=>page.locator(".form-drawer-footer button").last();
const field=name=>page.locator('.form-drawer [name="'+name+'"]');
async function fillCurrentForm(){
 const fields=page.locator(".form-drawer input[name],.form-drawer textarea[name],.form-drawer select[name]");
 for(let index=0;index<await fields.count();index++){
  const control=fields.nth(index),name=await control.getAttribute("name"),type=await control.getAttribute("type"),tag=await control.evaluate(el=>el.tagName);
  if(type==="checkbox"||type==="radio"||type==="file")continue;
  if(tag==="SELECT"){const value=await control.locator("option").evaluateAll(options=>options.find(option=>option.value&&!option.disabled)?.value);if(value)await control.selectOption(value);}
  else await control.fill(type==="email"?"qa@example.test":type==="date"?"2026-10-01":type==="number"?"12":name.includes("password")?"ValidPass1":name.includes("phone")||name.includes("contact")?"0771234567":name==="nic"?"200012345678":"Preview value");
 }
}
try{
 await goto("/");await noOverflow();
 assert.equal(await page.locator(".pricing-card").count(),3);
 assert.match(await page.locator(".pricing-card").nth(0).innerText(),/\$29/);
 assert.equal(await page.locator(".official-brand img:visible").count(),2);
 assert.equal(await page.evaluate(()=>[...document.images].filter(image=>image.offsetParent!==null&&(!image.complete||!image.naturalWidth)).length),0);
 await page.screenshot({path:path.join(output,"landing-desktop.png"),fullPage:true});
 const launcher=page.getByRole("button",{name:"Open IntelliRide Assistant"});
 const initial=await launcher.boundingBox();await page.evaluate(()=>scrollTo(0,1650));await page.waitForTimeout(150);
 assert(Math.abs(initial.y-(await launcher.boundingBox()).y)<2);
 await launcher.click();await page.getByRole("dialog",{name:"IntelliRide Assistant"}).waitFor();
 assert(await page.locator("#assistant-message").isDisabled());assert.equal(requests.length,0);
 await page.keyboard.press("Escape");assert(await launcher.isVisible());
 await page.locator(".pricing-comparison summary").click();assert(await page.locator(".comparison-scroll table").isVisible());
 await page.locator(".faq-list summary").first().click();assert(await page.locator(".faq-list details").first().getAttribute("open")!==null);
 await page.locator(".explorer-tour").click();await page.getByRole("dialog").waitFor();
 await page.getByRole("button",{name:"Next",exact:true}).click();await page.getByRole("button",{name:"Previous tour step"}).click();
 for(let index=0;index<4;index++)await page.getByRole("button",{name:"Next",exact:true}).click();
 await page.getByRole("button",{name:"Finish tour",exact:true}).click();
 await page.locator(".explorer-toolbar").getByRole("button",{name:"Vehicle register",exact:true}).click();
 await page.locator(".product-demo .management-add").click();
 await field("number_plate").waitFor();
 await page.keyboard.press("Escape");
 await page.emulateMedia({reducedMotion:"reduce"});
 assert.equal(await page.locator(".road-markings").evaluate(element=>getComputedStyle(element).animationName),"none");
 await page.emulateMedia({reducedMotion:"no-preference"});
 pass("public navigation, pricing comparison, FAQ, real product preview, tour, fixed assistant, keyboard close and reduced motion");

 for(const width of [1024,768,390,320]){
  await page.setViewportSize({width,height:844});await goto("/");await noOverflow();
  if(width<=768){
   const menu=page.getByRole("button",{name:"Open website menu"});if(await menu.isVisible()){await menu.click();assert(await page.locator(".site-nav").getByText("Pricing",{exact:true}).isVisible());await page.getByRole("button",{name:"Close website menu",exact:true}).click();}
  }
  if(width===390)await page.screenshot({path:path.join(output,"landing-mobile.png"),fullPage:true});
 }
 pass("public responsive layout at 1440, 1024, 768, 390 and 320 pixels");

 await page.setViewportSize({width:1440,height:1000});await goto("/login");
 await page.getByRole("button",{name:"Sign in to workspace"}).click();assert(await page.locator(".field-error").count()>=2);
 await page.locator('[name="email"]').fill("qa@example.test");await page.locator('[name="password"]').fill("ValidPass1");
 await page.getByRole("button",{name:"Sign in to workspace"}).click();await page.waitForURL(base+"/");
 const login=requests.find(request=>request.endpoint==="login");
 assert.deepEqual(login.body,{email:"qa@example.test",password:"ValidPass1"});
 assert.equal(await page.evaluate(()=>localStorage.getItem("ACCESS_TOKEN")),"UI-FIXTURE-TOKEN");
 await goto("/dashboard");await page.locator(".kpi-card").first().waitFor();
 await page.screenshot({path:path.join(output,"dashboard-light.png"),fullPage:true});
 pass("login RHF validation, exact credential payload, unchanged token storage and authenticated route");

 const routes=["/dashboard","/user-management/manage","/role-management/manage","/branch-management/manage","/vehicle-category-management/manage","/vehicle-brand-management/manage","/vehicle-model-management/manage","/fuel-type-management/manage","/transmission-type-management/manage","/vehicle-feature-management/manage","/register-vehicle-management/manage","/staff-management/manage","/department-management/manage","/designation-management/manage","/settings","/ai/agent","/ai/chatbot"];
 for(const route of routes){
  await goto(route);await page.locator(".page-header h1").waitFor();await noOverflow();
  await page.setViewportSize({width:390,height:844});await noOverflow();await page.setViewportSize({width:1440,height:1000});
 }
 pass("all 17 authenticated screens render without page errors or desktop/mobile overflow");

 await goto("/settings");
 for(const mode of ["light","dark"]){
  await page.getByRole("button",{name:mode==="light"?"Light":"Dark",exact:true}).click();
  for(const preset of presets){
   await page.locator(".preset-tile").filter({has:page.getByText(preset.name,{exact:true})}).click();
   await page.waitForFunction(({mode,id})=>document.documentElement.dataset.mode===mode&&document.documentElement.dataset.preset===id,{mode,id:preset.id});
   assert.equal((await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue("--primary"))).trim().toUpperCase(),preset[mode][2].toUpperCase());
   assert.equal(await page.locator(".sidebar-brand img:visible").count(),1);
   assert.equal(await page.locator(".settings-brand-preview img:visible").count(),1);
  }
 }
 await page.reload({waitUntil:"networkidle"});assert.equal(await page.evaluate(()=>document.documentElement.dataset.preset),"warm");
 assert.equal(await page.evaluate(()=>localStorage.getItem("ACCESS_TOKEN")),"UI-FIXTURE-TOKEN");
 await page.getByRole("button",{name:"Restore defaults",exact:true}).click();
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.preset),"signature");
 await page.getByRole("button",{name:"Navigation",exact:true}).click();
 await page.getByRole("combobox",{name:"Sidebar finish",exact:true}).selectOption("adaptive");
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.sidebarStyle),"adaptive");
 await page.getByRole("combobox",{name:"Sidebar density",exact:true}).selectOption("compact");
 await page.getByRole("checkbox",{name:"Compact desktop sidebar",exact:true}).check();
 await page.waitForFunction(()=>Math.round(document.querySelector(".desktop-sidebar").getBoundingClientRect().width)===76);
 assert.equal(Math.round((await page.locator(".desktop-sidebar").boundingBox()).width),76);
 await page.getByRole("checkbox",{name:"Compact desktop sidebar",exact:true}).uncheck();
 await page.getByRole("button",{name:"Display & motion",exact:true}).click();
 for(const [name,value]of[["Interface spacing","compact"],["Table density","compact"],["Corner radius","small"],["Interface scale","large"],["Card treatment","flat"],["Workspace background","tinted"],["Animation intensity","none"]])await page.getByRole("combobox",{name,exact:true}).selectOption(value);
 assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).fontSize),"17.6px");
 await page.getByRole("button",{name:"Restore defaults",exact:true}).click();
 await page.getByRole("button",{name:"Switch to dark mode",exact:true}).click();
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.preset),"midnight");
 await page.screenshot({path:path.join(output,"settings-dark.png"),fullPage:true});
 await page.getByRole("button",{name:"Switch to light mode",exact:true}).click();
 await page.keyboard.press("Control+k");await page.getByRole("textbox",{name:"Search pages",exact:true}).fill("Departments");
 await page.getByRole("link",{name:"Departments",exact:true}).click();await page.waitForURL("**/department-management/manage");
 pass("all 18 theme combinations, visible official logos, persistence, reset, quick switch, real display/sidebar preferences and command search");

 const demos=[
  ["/branch-management/manage","branch_name"],
  ["/vehicle-category-management/manage","category_name"],
  ["/vehicle-brand-management/manage","brand_name"],
  ["/vehicle-model-management/manage","model_name"],
  ["/fuel-type-management/manage","fuel_type_name"],
  ["/transmission-type-management/manage","transmission_name"],
  ["/vehicle-feature-management/manage","feature_name"],
  ["/register-vehicle-management/manage","number_plate"],
 ];
 const consoleObjects=[];page.on("console",message=>{if(message.type()==="log")Promise.all(message.args().map(arg=>arg.jsonValue())).then(args=>consoleObjects.push(args)).catch(()=>{});});
 for(const [route,required]of demos){
  await goto(route);const before=requests.length;await page.locator(".management-add").click();await field(required).waitFor();
  await submitButton().click();assert(await page.locator(".form-drawer .field-error").count()>0);
  await fillCurrentForm();
  if(route.includes("vehicle-brand"))await field("logo").setInputFiles("public/brand/favicon.png");
  if(route.includes("register-vehicle"))await field("images").setInputFiles("public/brand/favicon.png");
  const checkbox=page.locator('.form-drawer input[type="checkbox"]');
  if(await checkbox.count()){await checkbox.focus();await checkbox.press("Space");}
  await submitButton().click();await page.locator(".demo-submit-note").waitFor();
  assert.equal(requests.length,before,"Demo form must not invent an API request");
  if(route.includes("vehicle-brand")){assert(await page.locator('img[alt="logo-preview"]').isVisible());const payload=consoleObjects.findLast(args=>args[0]?.brand_name)?.[0];assert.equal(payload.brand_name,"Preview value");assert.equal(payload.status,false);}
  await page.getByRole("button",{name:"Close form",exact:true}).click();
  await page.locator(".management-add").click();assert.equal(await field(required).inputValue(),"");
  if(await checkbox.count())assert(await checkbox.isChecked());
  await page.keyboard.press("Escape");
 }
 const pairs=consoleObjects.filter(args=>typeof args[0]==="string"&&["number_plate","category","daily_rental_rate","images[]"].includes(args[0]));
 assert(pairs.some(args=>args[0]==="number_plate"&&args[1]==="Preview value"));
 assert(pairs.some(args=>args[0]==="daily_rental_rate"&&args[1]==="12"));
 assert(pairs.some(args=>args[0]==="images[]"));
 pass("all 8 migrated management forms validate/reset, retain checkbox values, preview file inputs, preserve string multipart values and make no new API calls");

 const live=[
  ["/department-management/manage","save_department","department_name",true],
  ["/designation-management/manage","save_designation","designation_name",true],
  ["/user-management/manage","save_user","username",true],
  ["/staff-management/manage","save_staff","first_name",true],
  ["/role-management/manage","save_role","role_name",false],
 ];
 for(const [route,endpoint,name,hasEdit]of live){
  await goto(route);await page.locator(".management-add").click();await page.locator(".form-drawer").waitFor();
  await fillCurrentForm();rejectSave=endpoint;await submitButton().click();
  await page.getByText("Fixture field validation message",{exact:true}).waitFor();
  rejectSave="";await submitButton().click();await page.locator(".form-drawer").waitFor({state:"hidden"});
  const created=requests.findLast(request=>request.endpoint===endpoint);
  const createdFields=endpoint==="save_staff"?created.body:created.body.form_data;
  assert(createdFields);assert.equal(created.body.upd_id,undefined);
  if(["save_department","save_designation","save_staff"].includes(endpoint))assert.equal(createdFields.status,1);
  if(endpoint==="save_role")assert.equal(createdFields.status,true);
  if(hasEdit){
   await page.getByRole("button",{name:"Edit record",exact:true}).first().click();await field(name).waitFor();
   await page.waitForFunction(name=>{const field=document.querySelector('.form-drawer [name="'+name+'"]');return field&&field.value!==" ";},name);
   await page.waitForTimeout(100);
   assert((await field(name).inputValue()).length>0);
   await field(name).fill("Edited fixture");await submitButton().click();await page.locator(".form-drawer").waitFor({state:"hidden"});
   const updated=requests.findLast(request=>request.endpoint===endpoint);
   const updatedFields=endpoint==="save_staff"?updated.body:updated.body.form_data;
   assert.equal(updated.body.upd_id,"99");assert.equal(updatedFields[name],"Edited fixture");
   if(endpoint==="save_user"){assert.equal(updated.body.form_data.password,"");assert.equal(updated.body.form_data.password_confirmation,"");}
  }
 }
 pass("5 existing API-backed create forms and 4 supported edit flows retain payloads, server field errors, checkbox conventions and update IDs");

 emptyDepartment=true;await goto("/department-management/manage");
 await page.getByText("No Departments Found",{exact:true}).waitFor();
 assert(await page.getByText("Add a record using the create button, or clear your search to see more results.",{exact:true}).isVisible());
 emptyDepartment=false;await goto("/dashboard");
 await page.setViewportSize({width:390,height:844});await page.getByRole("button",{name:"Open navigation",exact:true}).click();
 await page.getByRole("dialog",{name:"Navigation",exact:true}).waitFor();
 await page.getByRole("dialog",{name:"Navigation",exact:true}).getByRole("link",{name:"Users",exact:true}).click();await page.waitForURL("**/user-management/manage");await page.getByRole("dialog",{name:"Navigation",exact:true}).waitFor({state:"hidden"});
 await page.setViewportSize({width:1440,height:1000});await page.locator(".profile-menu summary").click();await page.locator(".profile-popover").getByRole("button",{name:"Sign out",exact:true}).click();await page.waitForURL("**/login");
 assert.equal(await page.evaluate(()=>localStorage.getItem("ACCESS_TOKEN")),null);
 await goto("/dashboard");await page.waitForURL("**/login");
 await page.screenshot({path:path.join(output,"login-desktop.png"),fullPage:true});
 pass("helpful empty states, mobile navigation, logout and unauthenticated route protection");

 await goto("/signup");await page.locator('[name="name"]').fill("Preview User");await page.locator('[name="email"]').fill("signup@example.test");await page.locator('[name="password"]').fill("ValidPass1");await page.locator('[name="password_confirmation"]').fill("Different");
 await page.getByRole("button",{name:"Create account",exact:true}).click();await page.getByText("Passwords do not match.",{exact:true}).waitFor();
 await page.locator('[name="password_confirmation"]').fill("ValidPass1");await page.getByRole("button",{name:"Create account",exact:true}).click();await page.waitForURL(base+"/");
 assert.deepEqual(requests.findLast(request=>request.endpoint==="signup").body,{name:"Preview User",email:"signup@example.test",password:"ValidPass1",password_confirmation:"ValidPass1"});
 assert.equal(errors.length,0,errors.join("\n"));
 pass("signup RHF confirmation validation, original API payload and no uncaught page errors");
 fs.writeFileSync(path.join(output,"browser-results.json"),JSON.stringify({passed:results,uncaughtErrors:errors,apiRequests:requests.length,fixtureOnly:true},null,2));
 console.log("PASS "+results.length+" browser regression groups; "+requests.length+" controlled fixture requests; no live backend contacted.");
}catch(error){
 await page.screenshot({path:path.join(output,"failure.png"),fullPage:true}).catch(()=>{});
 fs.writeFileSync(path.join(output,"browser-failure.json"),JSON.stringify({message:error.message,stack:error.stack,passed:results,uncaughtErrors:errors},null,2));
 throw error;
}finally{await context.close();await browser.close();}
