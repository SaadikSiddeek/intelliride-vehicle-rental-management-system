import { useEffect, useState } from "react";
import axiosClient from "@/axios-client";
export default function UserAvatar({user,className='avatar'}){
 const[photo,setPhoto]=useState(null);
 useEffect(()=>{if(!user?.has_profile_photo)return;const r=new AbortController();let url;axiosClient.get('/my_profile_photo',{responseType:'blob',signal:r.signal}).then(({data})=>{if(!r.signal.aborted){url=URL.createObjectURL(data);setPhoto({user,url});}}).catch(()=>{});return()=>{r.abort();if(url)URL.revokeObjectURL(url);};},[user]);
 const name=user?.display_name||user?.name||user?.username||'My account';const initials=name.split(/\s+/).map(n=>n[0]).slice(0,2).join('').toUpperCase();
 return <span className={className}>{user?.has_profile_photo&&photo?.user===user&&photo.url?<img className="profile-image" src={photo.url} alt={`${name} profile`} onError={()=>setPhoto(null)}/>:initials}</span>;
}
