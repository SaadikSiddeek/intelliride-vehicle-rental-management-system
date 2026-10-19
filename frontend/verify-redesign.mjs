import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { parse } from "@babel/parser";
import { presets, defaultAppearance, APPEARANCE_KEY, BRAND } from "./src/contexts/appearance-config.js";
import { sanitizeAppearance, contrast, accessibleAccent, accentForeground } from "./src/contexts/appearance-utils.js";
assert.equal(presets.length, 9);
assert.equal(new Set(presets.map(p => p.id)).size, 9);
assert.equal(defaultAppearance.lightPreset, "signature");
assert.equal(presets[0].light[2], BRAND.navy);
for (const preset of presets) for (const mode of ["light","dark"]) {
  const [, surface, accent] = preset[mode];
  assert(contrast(accent, surface) >= 4.5, preset.id + " " + mode + " text accent");
  assert(contrast(accent, accentForeground(accent)) >= 4.5, preset.id + " button contrast");
  for (const hex of ["#FFFFFF","#000000","#072A56","#FFFF00","#245CFA"]) {
    const adjusted = accessibleAccent(hex, surface);
    assert(contrast(adjusted, surface) >= 4.5, "Custom accent contrast");
    assert(contrast(adjusted, accentForeground(adjusted)) >= 4.5, "Custom button contrast");
  }
}
assert.deepEqual(sanitizeAppearance({appearance:"bad",lightPreset:"bad",density:"bad",customAccent:"url(x)"}), {...defaultAppearance});
for (const [saved, systemDark, expectedMode, expectedPreset] of [
  [null,false,"light","signature"],
  [{appearance:"system",darkPreset:"ocean"},true,"dark","ocean"],
  [{appearance:"dark",darkPreset:"invalid",customAccent:"#FFFFFF"},false,"dark","midnight"],
  [{appearance:"light",fontScale:"large",sidebarStyle:"adaptive"},false,"light","signature"],
]) {
  const storage = new Map([["ACCESS_TOKEN","retained-test-token"]]);
  if (saved) storage.set(APPEARANCE_KEY,JSON.stringify(saved));
  const root = { dataset:{}, classList:{toggle(){}},style:{setProperty(){}} };
  vm.runInNewContext(fs.readFileSync("public/appearance-init.js","utf8"),{
    localStorage:{getItem:key=>storage.get(key)||null},document:{documentElement:root},matchMedia:()=>({matches:systemDark}),
  });
  assert.equal(root.dataset.mode,expectedMode);
  assert.equal(root.dataset.preset,expectedPreset);
  assert.equal(storage.get("ACCESS_TOKEN"),"retained-test-token");
}
const files=[];
const walk=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const loc=path.join(dir,entry.name);if(entry.isDirectory())walk(loc);else if(/\.(jsx|js)$/.test(entry.name))files.push(loc);
}};
walk("src");
for(const file of files) {
  const tree=parse(fs.readFileSync(file,"utf8"),{sourceType:"module",plugins:["jsx"]});
  for(const node of tree.program.body) {
    if(node.type!=="ImportDeclaration")continue;
    const value=node.source.value;
    if(!value.startsWith(".")&&!value.startsWith("@/"))continue;
    const base=value.startsWith("@/")?path.join("src",value.slice(2)):path.resolve(path.dirname(file),value);
    assert(["",".jsx",".js",".json","/index.jsx","/index.js"].some(ext=>fs.existsSync(base+ext)),file+": missing "+value);
  }
}
const marketing=["src/views/Landing.jsx",...fs.readdirSync("src/components/marketing").map(f=>"src/components/marketing/"+f)].map(f=>fs.readFileSync(f,"utf8")).join("\n");
for(const anchor of ["platform","features","solutions","how-it-works","pricing","faq","contact"])assert(marketing.includes('id="'+anchor+'"'));
for(const name of ["Starter","Professional","Enterprise"])assert(marketing.includes('name: "'+name+'"'));
for(const asset of ["brand/wordmark-color.webp","brand/wordmark-white.webp","brand/mark-color.webp","brand/mark-white.webp","brand/favicon.png","touring-sedan.webp"])assert(fs.existsSync("public/"+asset),asset);
const formPaths=["Login","Signup","users/Users","staff/Staff","department/Department","designation/Designation","role/Role","branch/Branch","vehicleCategory/VehicleCategory","vehicleBrand/VehicleBrand","vehicleModel/VehicleModel","fuelType/FuelType","transmission/TransmissionType","features/Features","registerVehicle/RegisterVehicle"];
for(const file of formPaths) {
 const source=fs.readFileSync("src/views/"+file+".jsx","utf8");
 assert(source.includes("useForm("),file+" missing RHF");
 assert(!/\w+Ref\.current\.(value|files)/.test(source),file+" still uses form DOM refs");
}
console.log("PASS: "+files.length+" source files parse, imports resolve, 15 form containers use RHF, logo and scene assets exist.");
console.log("PASS: 18 theme palettes and custom accents meet tested text/button contrast; pre-paint preferences validate and leave the auth token intact.");
