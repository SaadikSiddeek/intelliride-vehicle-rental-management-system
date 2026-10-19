// Representative table/form/chart/chat checks in all nine presets and both modes.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { presets, defaultAppearance, APPEARANCE_KEY } from "../src/contexts/appearance-config.js";
const require=createRequire(import.meta.url);
const { chromium }=require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base=process.env.UI_BASE_URL || "http://127.0.0.1:3000";
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE || undefined,args:["--no-sandbox","--disable-dev-shm-usage","--disable-gpu","--no-zygote","--single-process"]});
let count=0;const errors=[];
const context=await browser.newContext({viewport:{width:1280,height:900}});
await context.route("**/api/**",route=>route.fulfill({status:200,headers:{"access-control-allow-origin":"*","access-control-allow-headers":"*","content-type":"application/json"},body:JSON.stringify({name:"Theme Preview",email:"theme@example.test",data:[]})}));
const page=await context.newPage();page.setDefaultTimeout(6000);page.on("pageerror",error=>errors.push(error.message));
try{
 await page.goto(base+"/",{waitUntil:"networkidle"});
 for(const mode of ["light","dark"])for(const preset of presets){
  await page.evaluate(({key,preferences})=>{localStorage.setItem(key,JSON.stringify(preferences));localStorage.setItem("ACCESS_TOKEN","THEME-FIXTURE");},{key:APPEARANCE_KEY,preferences:{...defaultAppearance,appearance:mode,lightPreset:preset.id,darkPreset:preset.id,quickPreset:true,sidebarStyle:preset.id.length%2?"solid":"adaptive"}});
  await page.setViewportSize({width:1280,height:900});
  await page.goto(base+"/vehicle-model-management/manage",{waitUntil:"networkidle"});
  await page.locator(".tabulator-row").first().waitFor();await page.locator(".management-add").click();await page.locator(".form-drawer").waitFor();
  const samples=await page.evaluate(()=>{
   const color=(selector,property)=>getComputedStyle(document.querySelector(selector)).getPropertyValue(property);
   const rgb=value=>{const canvas=document.createElement("canvas");canvas.width=canvas.height=1;const context=canvas.getContext("2d");context.fillStyle=value;context.fillRect(0,0,1,1);return [...context.getImageData(0,0,1,1).data].slice(0,3);};
   return {
    field:[rgb(color('.form-drawer input[name="model_name"]',"color")),rgb(color('.form-drawer input[name="model_name"]',"background-color"))],
    select:[rgb(color('.form-drawer select',"color")),rgb(color('.form-drawer select',"background-color"))],
    table:[rgb(color(".tabulator-cell","color")),rgb(color(".tabulator-row","background-color"))],
    button:[rgb(color(".form-drawer-footer button:last-child","color")),rgb(color(".form-drawer-footer button:last-child","background-color"))],
    logos:[...document.querySelectorAll(".sidebar-brand img")].filter(image=>getComputedStyle(image).display!=="none").map(image=>image.complete&&image.naturalWidth>0),
   };
  });
  const luminance=rgb=>rgb.map(value=>value/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
  for(const name of ["field","select","table","button"]){const [a,b]=samples[name].map(luminance);assert((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,preset.id+" "+mode+" "+name+" contrast");}
  assert.deepEqual(samples.logos,[true]);
  await page.locator(".form-drawer-footer button").last().click();await page.locator(".field-error").waitFor();
  await page.keyboard.press("Escape");
  await page.goto(base+"/dashboard",{waitUntil:"networkidle"});
  assert(await page.locator(".recharts-surface").count()>0);
  assert((await page.locator(".revenue-chart").boundingBox()).height>100);
  await page.goto(base+"/",{waitUntil:"networkidle"});await page.getByRole("button",{name:"Open IntelliRide Assistant"}).click();
  await page.getByRole("dialog",{name:"IntelliRide Assistant"}).waitFor();assert(await page.locator("#assistant-message").isDisabled());
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  count++;
  console.log("PASS "+preset.id+" "+mode+" table, form, select, validation, logo, chart, chat and mobile viewport");
 }
 await page.goto(base+"/settings",{waitUntil:"networkidle"});
 await page.getByRole("button",{name:"System",exact:true}).click();
 await page.emulateMedia({colorScheme:"dark"});await page.waitForFunction(()=>document.documentElement.dataset.mode==="dark");
 await page.emulateMedia({colorScheme:"light"});await page.waitForFunction(()=>document.documentElement.dataset.mode==="light");
 assert.deepEqual(errors,[]);
 console.log("PASS "+count+" representative theme/mode combinations with measured text/control contrast and no page errors.");
}finally{await context.close();await browser.close();}
