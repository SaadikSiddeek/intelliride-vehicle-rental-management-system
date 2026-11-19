import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestedHandoverPickup } from './handover-context.mjs';
test('selected booking suggestions use the server Colombo clock across browser timezone settings', () => {
  const previous = process.env.TZ;
  try { for(const timezone of ['UTC','Asia/Colombo','America/New_York']) {
    process.env.TZ = timezone;
    assert.equal(suggestedHandoverPickup({pickup_at:'2026-12-01 00:00:00', expected_return_at:'2026-12-02 00:00:00',server_now:'2026-12-01T00:05'}),'2026-12-01T00:05');
  }} finally { if(previous===undefined) delete process.env.TZ; else process.env.TZ=previous; }
});
test('switching booking drops old dates and only suggests eligible current pickup', () => {
  const context={pickup_at:'2026-12-01 10:00:00',expected_return_at:'2026-12-02 10:00:00',server_now:'2026-12-01T10:00'};
  assert.equal(suggestedHandoverPickup(context),'2026-12-01T10:00');
  assert.equal(suggestedHandoverPickup({...context,pickup_at:'2026-12-02 10:00:00',expected_return_at:'2026-12-03 10:00:00'}),'');
  assert.equal(suggestedHandoverPickup({...context,server_now:'2026-12-02T10:00'}),'');
  assert.equal(suggestedHandoverPickup({...context,server_now:'2026-12-03T10:00'}),'');
  for(const missing of [undefined,{}, {...context,server_now:undefined},{...context,pickup_at:'invalid'}]) assert.equal(suggestedHandoverPickup(missing),'');
});
