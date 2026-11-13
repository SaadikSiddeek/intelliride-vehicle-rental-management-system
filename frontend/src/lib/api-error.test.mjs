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

test('upload limits and unavailable image processing have safe, actionable messages', () => {
  assert.equal(apiFailure({response:{status:413}}).title, 'Upload too large');
  assert.equal(apiFailure({response:{status:419}}).title, 'Session verification required');
  const result = apiFailure({response:{status:503,data:{error_code:'IMAGE_PROCESSING_UNAVAILABLE',message:'secret stack trace'}}});
  assert.equal(result.title, 'Image uploads unavailable');
  assert.equal(result.message.includes('secret'), false);
  assert.equal(apiFailure({response:{status:503,data:{error_code:'UNKNOWN',message:'secret'}}}).title, 'Service temporarily unavailable');
});
