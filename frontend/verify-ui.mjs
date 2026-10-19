// Read-only render smoke check. No browser, API requests, or user credentials.
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
const store = new Map();
globalThis.localStorage = {getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
const server = await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
let failures=0;
try {
 const {ThemeProvider} = await server.ssrLoadModule('/src/contexts/ThemeProvider.jsx');
 const {ContextProvider} = await server.ssrLoadModule('/src/contexts/ContextProvider.jsx');
 const pages = ['Landing','Login','Signup','Dashboard','NotFound','Settings','ai/AIAgent','ai/AIChatbot','users/Users','role/Role','staff/Staff','branch/Branch','department/Department','designation/Designation','vehicleBrand/VehicleBrand','vehicleCategory/VehicleCategory','vehicleModel/VehicleModel','fuelType/FuelType','transmission/TransmissionType','features/Features','registerVehicle/RegisterVehicle'];
 for (const theme of ['light','dark']) {
  store.set('rental-ui-theme',theme);
  for (const page of pages) {
   try {
    const {default:Page}=await server.ssrLoadModule(`/src/views/${page}.jsx`);
    const html=renderToString(React.createElement(MemoryRouter,null,React.createElement(ThemeProvider,null,React.createElement(ContextProvider,null,React.createElement(Page)))));
    if (!html.length) throw new Error('Empty render');
    console.log(`PASS ${theme} ${page}`);
   } catch(e) {failures++;console.error(`FAIL ${theme} ${page}: ${e.message}`);}
  }
 }
} finally {await server.close();}
if(failures)process.exitCode=1;
