import test from 'node:test';
import assert from 'node:assert/strict';
import { apiFailure } from './api-error.mjs';
test('permission and server failures never expose raw server diagnostics',()=>{
  for(const status of [403,404,500,503]){
    const result=apiFailure({response:{status,data:{message:'SQL password=secret',trace:['secret']}}});
    assert.ok(result.message);assert.equal(JSON.stringify(result).includes('secret'),false);
  }
  assert.equal(apiFailure({response:{status:403}}).title,'Access denied');
});
test('validation errors remain available to forms and authentication is distinct',()=>{
  assert.equal(apiFailure({response:{status:422}}),null);
  assert.equal(apiFailure({response:{status:401}}).title,'Session expired');
  assert.equal(apiFailure({}).title,'Connection problem');
});
