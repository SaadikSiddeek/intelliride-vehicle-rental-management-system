import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesTableRecord } from './table-filter.mjs';

test('master status handles actual boolean, numeric and text encodings and never guesses unknown statuses', () => {
  for (const status of [true, 1, '1', 'Active']) {
    assert.equal(matchesTableRecord({status}, {status:'active'}), true);
    assert.equal(matchesTableRecord({status}, {status:'inactive'}), false);
  }
  for (const status of [false, 0, '0', 'Inactive']) {
    assert.equal(matchesTableRecord({status}, {status:'inactive'}), true);
    assert.equal(matchesTableRecord({status}, {status:'active'}), false);
  }
  for (const status of ['Blocked', 'Maintenance', null, undefined]) {
    assert.equal(matchesTableRecord({status}, {status:'active'}), false);
    assert.equal(matchesTableRecord({status}, {status:'inactive'}), false);
    assert.equal(matchesTableRecord({status}, {status:'all'}), true);
  }
});
test('search and status compose, survive clearing search and evaluate fresh row values after save', () => {
  const rows = [{status:1,name:'Example Branch'}, {status:0,name:'Example Branch'}, {status:1,name:'Other'}];
  const filter = {status:'active',query:' example ',fields:['name']};
  assert.deepEqual(rows.filter(row=>matchesTableRecord(row,filter)),[rows[0]]);
  filter.status='inactive'; assert.deepEqual(rows.filter(row=>matchesTableRecord(row,filter)),[rows[1]]);
  filter.status='all'; assert.equal(rows.filter(row=>matchesTableRecord(row,filter)).length,2);
  filter.status='active'; filter.query=''; assert.equal(rows.filter(row=>matchesTableRecord(row,filter)).length,2);
  rows[0].status=0; assert.deepEqual(rows.filter(row=>matchesTableRecord(row,filter)),[rows[2]]);
});
test('transactional tables retain search-only behavior and ignore nested metadata', () => {
  assert.equal(matchesTableRecord({status:'Confirmed',name:'Example',meta:{secret:'nested'}},{query:'example'}),true);
  assert.equal(matchesTableRecord({status:'Confirmed',meta:{secret:'nested'}},{query:'nested'}),false);
});
