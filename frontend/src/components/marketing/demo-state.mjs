export const DEMO_NOW = '2026-06-20T10:00';
export const reference = (prefix, id) => `${prefix}-${String(id).padStart(6, '0')}`;
export const demoMoney = value => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(value);
const parse = value => Date.parse(`${value}:00+05:30`);
export function createDemoState() {
 return {
  customers: [{id:1,name:'Avery Silva'},{id:2,name:'Jordan Perera'},{id:3,name:'Noah Fernando'}],
  vehicles: [
   {id:1,name:'Toyota Corolla',registration:'DEMO-1234',year:2022,category:'Sedan',fuel:'Petrol',transmission:'Automatic',rate:6000,status:'Available'},
   {id:2,name:'Suzuki Swift',registration:'DEMO-2345',year:2021,category:'Hatchback',fuel:'Petrol',transmission:'Automatic',rate:4500,status:'Rented'},
   {id:3,name:'Nissan Caravan',registration:'DEMO-3456',year:2020,category:'Van',fuel:'Diesel',transmission:'Manual',rate:8000,status:'Maintenance'},
   {id:4,name:'Honda Fit',registration:'DEMO-4567',year:2023,category:'Hatchback',fuel:'Hybrid',transmission:'Automatic',rate:5000,status:'Available'},
   {id:5,name:'Toyota Axio',registration:'DEMO-5678',year:2022,category:'Sedan',fuel:'Hybrid',transmission:'Automatic',rate:5500,status:'Available'},
  ],
  bookings: [
   {id:1,customer_id:1,vehicle_id:1,pickup_at:'2026-06-12T09:00',expected_return_at:'2026-06-14T09:00',status:'Converted to Rental',total:12000,notes:'Completed sample rental'},
   {id:2,customer_id:2,vehicle_id:2,pickup_at:'2026-06-19T09:00',expected_return_at:'2026-06-21T09:00',status:'Converted to Rental',total:9000,notes:'Vehicle currently on hire'},
   {id:3,customer_id:3,vehicle_id:4,pickup_at:'2026-06-22T10:00',expected_return_at:'2026-06-23T10:00',status:'Confirmed',total:5000,notes:'Upcoming reservation'},
  ],
  rentals: [{id:1,booking_id:1,status:'Completed',deposit_held:10000},{id:2,booking_id:2,status:'Active',deposit_held:10000}],
  invoices: [{id:1,booking_id:1,rental_id:1,issued_on:'2026-06-14',total:12000,paid:4000,payment_status:'Partially Paid'}],
 };
}
export function availableDemoVehicles(state, pickup, end, excludeId=null) {
 if(!Number.isFinite(parse(pickup)) || !Number.isFinite(parse(end)) || end<=pickup) return [];
 return state.vehicles.filter(vehicle=>vehicle.status==='Available' && !state.bookings.some(booking=>{
  if(booking.id===Number(excludeId) || booking.vehicle_id!==vehicle.id || !['Confirmed','Converted to Rental'].includes(booking.status)) return false;
  if(state.rentals.some(rental=>rental.booking_id===booking.id&&rental.status==='Completed')) return false;
  return booking.pickup_at<end && booking.expected_return_at>pickup;
 }));
}
export function saveDemoBooking(state, input) {
 const customer=state.customers.find(item=>item.id===Number(input.customer_id));
 const vehicle=state.vehicles.find(item=>item.id===Number(input.vehicle_id));
 const existing=input.id?state.bookings.find(item=>item.id===Number(input.id)):null;
 if(input.id&&!existing) throw new Error('This sample booking no longer exists.');
 if(existing&&existing.status!=='Draft') throw new Error('Only draft bookings can be edited.');
 if(!customer)throw new Error('Select a customer.');
 if(!['Draft','Confirmed'].includes(input.status))throw new Error('Choose Draft or Confirmed.');
 if(!Number.isFinite(parse(input.pickup_at))||!Number.isFinite(parse(input.expected_return_at))||input.expected_return_at<=input.pickup_at)throw new Error('Expected return must be after pickup.');
 if(input.status==='Confirmed'&&input.pickup_at<DEMO_NOW)throw new Error('A confirmed booking must start after the sample business clock.');
 if(!vehicle||vehicle.status!=='Available')throw new Error('Choose an available vehicle.');
 if(input.status==='Confirmed'&&!availableDemoVehicles(state,input.pickup_at,input.expected_return_at,existing?.id).some(item=>item.id===vehicle.id))throw new Error('This vehicle is already reserved for those dates.');
 const units=Math.ceil((parse(input.expected_return_at)-parse(input.pickup_at))/86400000);
 if(units>366)throw new Error('Use a reservation period within 366 days.');
 const id=existing?.id??Math.max(0,...state.bookings.map(item=>item.id))+1;
 const row={id,customer_id:customer.id,vehicle_id:vehicle.id,pickup_at:input.pickup_at,expected_return_at:input.expected_return_at,status:input.status,total:vehicle.rate*units,notes:(input.notes||'').slice(0,1000)};
 return {...state,bookings:existing?state.bookings.map(item=>item.id===id?row:item):[...state.bookings,row]};
}
export function demoMetrics(state) {
 return {fleet:state.vehicles.length,available:state.vehicles.filter(item=>item.status==='Available').length,active:state.rentals.filter(item=>item.status==='Active').length,upcoming:state.bookings.filter(item=>item.status==='Confirmed'&&item.pickup_at>=DEMO_NOW).length,revenue:state.invoices.reduce((total,item)=>total+item.total,0),collections:state.invoices.reduce((total,item)=>total+item.paid,0),outstanding:state.invoices.reduce((total,item)=>total+item.total-item.paid,0),deposits:state.rentals.reduce((total,item)=>total+item.deposit_held,0)};
}
export function selectDemoBookings(state,{query='',status=''}={}) {
 const term=query.trim().toLowerCase();
 return state.bookings.filter(item=>(!status||item.status===status)&&[reference('BKG',item.id),state.customers.find(c=>c.id===item.customer_id)?.name,state.vehicles.find(v=>v.id===item.vehicle_id)?.registration,item.status].join(' ').toLowerCase().includes(term));
}
