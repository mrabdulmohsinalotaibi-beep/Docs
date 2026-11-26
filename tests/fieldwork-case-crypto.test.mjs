import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {unlockCaseCipher} from '../src/fieldwork-case-crypto.mjs';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
test('case encryption binds account, identity and revision and rejects tampering',async()=>{
 const c=await unlockCaseCipher('test-password-1234');
 const record={id:'c1',revision:1,studentId:'s1',reason:'private'};
 const row=await c.seal('a',record);
 assert.equal(row.record,undefined);assert.equal(row.studentId,undefined);
 assert.deepEqual(await c.open('a',row),record);
 await assert.rejects(c.open('b',row));await assert.rejects(c.open('a',{...row,revision:2}));
 const cipher=[...row.cipher];cipher[0]^=1;await assert.rejects(c.open('a',{...row,cipher}));
 const other=await unlockCaseCipher('wrong-password-123',c.salt);await assert.rejects(other.open('a',row));
 const reopened=await unlockCaseCipher('test-password-1234',c.salt);assert.deepEqual(await reopened.open('a',row),record);
 assert.notDeepEqual((await c.seal('a',record)).iv,row.iv);
});
