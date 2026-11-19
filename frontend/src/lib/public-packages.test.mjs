import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const product=JSON.parse(readFileSync(new URL('../data/public-product.json',import.meta.url),'utf8'));
test('public knowledge and package distribution agree across both gateways',()=>{
 const server=JSON.parse(readFileSync(new URL('../../../backend-api/resources/public/product.json',import.meta.url),'utf8'));
 assert.deepEqual(product,server);
 assert.deepEqual(product.suggestions,['How do I log in?','How can I contact sales?','What do I get with IntelliRide?']);
 assert.equal(product.plans.length,3);
 product.plans.forEach(plan=>assert(plan.features.some(feature=>feature.includes('AI Chatbot'))));
 assert.equal(product.plans.filter(plan=>plan.features.some(feature=>feature.includes('AI Agent'))).length,1);
 assert.equal(product.plans[2].name,'Premium');assert.equal(product.contact,'mailto:ahamedsaadik1@gmail.com');
});
