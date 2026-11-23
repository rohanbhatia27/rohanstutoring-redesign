const test = require('node:test');
const assert = require('node:assert/strict');
const audit = require('../api/_lib/_audit-instalments.js');
test('audit alerts for active instalments without a verified cancellation date', async () => {
 const subscriptions = [{ id:'sub_missing', status:'active', start_date:1767225600, metadata:{payment_mode:'instalments', base_slug:'mastery'}, schedule:null, items:{data:[{price:{id:'price_1',recurring:{interval:'month'}},quantity:1}]} }];
 const alerts=[];
 const result=await audit({stripeClient:{subscriptions:{list:()=>subscriptions},subscriptionSchedules:{}}, alert:async data=>alerts.push(data), date:'2026-11-19'});
 assert.equal(result.checked,1); assert.equal(result.unverified,1); assert.equal(alerts[0].paymentId,'sub_missing');
});
