// Usage: node verify-preservation.mjs /absolute/path/to/original/frontend
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { parse } from "@babel/parser";
const original=process.argv[2];
if(!original)throw new Error("Pass the original frontend directory.");
const parseFile=file=>parse(fs.readFileSync(file,"utf8"),{sourceType:"module",plugins:["jsx"]});
const visit=(node,fn)=>{if(!node||typeof node!=="object")return;fn(node);for(const [key,value]of Object.entries(node)){if(["loc","start","end","comments","tokens","extra"].includes(key))continue;if(Array.isArray(value))value.forEach(v=>visit(v,fn));else if(value&&typeof value==="object")visit(value,fn);}};
function normalize(node) {
 if(!node||typeof node!=="object")return node;
 if(Array.isArray(node))return node.map(normalize);
 if(node.type==="JSXElement"||node.type==="JSXFragment")return {type:"UI"};
 if(node.type==="ObjectProperty"&&node.key?.name==="placeholder")return {type:"ObjectProperty",key:"placeholder",value:"Presentation"};
 if(node.type==="StringLiteral"&&/<(?:span|div|button|svg|img|i)\b/.test(node.value))return {type:"HTMLPresentation"};
 if(node.type==="TemplateLiteral"&&node.quasis.some(q=>/<(?:span|div|button|svg|img|i)\b/.test(q.value.raw)))return {type:"HTMLPresentation",expressions:normalize(node.expressions)};
 return Object.fromEntries(Object.entries(node).filter(([key])=>!["loc","start","end","comments","leadingComments","trailingComments","innerComments","extra"].includes(key)).map(([key,value])=>[key,normalize(value)]));
}
const collect=(tree,predicate)=>{const values=[];visit(tree,node=>{if(predicate(node))values.push(normalize(node));});return values;};
const files=fs.readdirSync(path.join(original,"src/views"),{withFileTypes:true}).filter(f=>f.isDirectory()).flatMap(dir=>fs.readdirSync(path.join(original,"src/views",dir.name)).filter(name=>name.endsWith(".jsx")).map(name=>dir.name+"/"+name));
for(const file of ["Login.jsx","Signup.jsx",...files]) {
 const before=parseFile(path.join(original,"src/views",file));
 const after=parseFile(path.join("src/views",file));
 const api=node=>node.type==="CallExpression"&&node.callee?.type==="MemberExpression"&&node.callee.object?.name==="axiosClient";
 assert.deepEqual(collect(after,api),collect(before,api),file+": API calls changed");
 const table=node=>node.type==="NewExpression"&&node.callee?.name==="Tabulator";
 assert.deepEqual(collect(after,table),collect(before,table),file+": table data, columns, actions or options changed");
}
const live=["department/Department.jsx","designation/Designation.jsx","users/Users.jsx","staff/Staff.jsx","role/Role.jsx"];
for(const file of live) {
 const handlers=tree=>{const result={};visit(tree,node=>{if(node.type==="VariableDeclarator"&&node.id?.type==="Identifier"&&["ArrowFunctionExpression","FunctionExpression"].includes(node.init?.type)&&node.id.name!=="FieldError")result[node.id.name]=normalize(node.init);});return result;};
 const before=handlers(parseFile(path.join(original,"src/views",file)));
 const after=handlers(parseFile(path.join("src/views",file)));
 // Status watch state is presentation-only; all original business handler bodies are checked.
 for(const [name,handler] of Object.entries(before))assert.deepEqual(after[name],handler,file+": handler "+name+" changed");
}
for(const file of ["src/axios-client.js","src/contexts/ContextProvider.jsx","src/components/DefaultLayout.jsx","src/components/TableSearch.jsx","src/components/layout/navigation.js","src/components/dashboard/sample-data.js",".env",".env.example","package.json","package-lock.json"]) {
 assert.equal(fs.readFileSync(file,"utf8"),fs.readFileSync(path.join(original,file),"utf8"),file+" must stay byte-identical");
}
const paths=tree=>collect(tree,node=>node.type==="ObjectProperty"&&node.key?.name==="path").map(node=>node.value.value);
assert.deepEqual(paths(parseFile("src/router.jsx")),paths(parseFile(path.join(original,"src/router.jsx"))),"Route paths/order changed");
// Verify that the existing multipart vehicle field names and ordering are untouched.
const appendFields=tree=>{const result=[];visit(tree,node=>{if(node.type==="CallExpression"&&node.callee?.object?.name==="formData"&&node.callee?.property?.name==="append")result.push(node.arguments[0]?.value);});return result;};
const vehicle="src/views/registerVehicle/RegisterVehicle.jsx";
assert.deepEqual(appendFields(parseFile(vehicle)),appendFields(parseFile(path.join(original,vehicle))));
console.log("PASS: all original API call syntax; all 5 live CRUD handler sets; table data, columns, actions and options (excluding presentation-only placeholders).");
console.log("PASS: Axios, auth context/layout, tokens, environment, dependency manifests, search, navigation and sample data are byte-identical; routes and multipart field order retained.");
