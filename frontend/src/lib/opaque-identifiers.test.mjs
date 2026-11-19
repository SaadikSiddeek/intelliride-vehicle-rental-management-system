import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stableIdentifier, normalizeIdentifiers } from './opaque-identifiers.mjs';
test('randomized encrypted tokens keep stable selection identity',()=>{
 const first=`ir1.${'a'.repeat(32)}.cipherA`,next=`ir1.${'a'.repeat(32)}.cipherB`;
 assert.equal(stableIdentifier(first),first); assert.equal(stableIdentifier(next),first);
 assert.deepEqual(normalizeIdentifiers({ ID:next }),{ID:first});
 assert.equal(stableIdentifier('BKG-000042'),'BKG-000042');
});
test('six public demo screens import no private data services',()=>{
 const text=readFileSync(new URL('../components/marketing/ProductExplorer.jsx',import.meta.url),'utf8');
 assert.doesNotMatch(text,/axios|fetch\(|useContext|useAuth/);
 for(const title of ['Dashboard','Bookings','Fleet','Active Rentals','Finance','Reports']) assert.ok(text.includes(title));
 assert.match(text,/role="tab"/);
});
