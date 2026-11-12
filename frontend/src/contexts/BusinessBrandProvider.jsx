import { useEffect, useState } from "react";
import { BusinessBrandContext } from "./business-brand-context";
import { useStateContext } from "./ContextProvider";
import axiosClient from "@/axios-client";
export default function BusinessBrandProvider({children}){const{token}=useStateContext();const[branding,setBranding]=useState(null);useEffect(()=>{if(!token)return;let request;const load=()=>{request?.abort();request=new AbortController();axiosClient.get('/business_branding',{signal:request.signal}).then(({data})=>setBranding({token,...data.data})).catch(()=>{});};load();window.addEventListener('business-branding-updated',load);return()=>{request?.abort();window.removeEventListener('business-branding-updated',load);};},[token]);return <BusinessBrandContext.Provider value={branding?.token===token?branding:null}>{children}</BusinessBrandContext.Provider>;}
