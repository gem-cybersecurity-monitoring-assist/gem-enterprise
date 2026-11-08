import {test} from "node:test";
import assert from "node:assert/strict";
import {singleFlight,pollSequential} from "../app/src/fast-flow.js";
test("overlapping connector reads share one request, different connectors run independently",async()=>{
 const once=singleFlight();let count=0,resolve;
 const first=once("obs",()=>{count++;return new Promise(r=>{resolve=r;});});
 const second=once("obs",()=>{count++;});
 const other=once("bridge",()=>42);
 await Promise.resolve();assert.equal(count,1);assert.equal(await other,42);
 resolve(7);assert.equal(await first,7);assert.equal(await second,7);
 assert.equal(await once("obs",()=>8),8);
});
test("a failed read clears the slot for recovery",async()=>{
 const once=singleFlight();await assert.rejects(once("obs",()=>Promise.reject(new Error("offline"))));
 assert.equal(await once("obs",()=>true),true);
});
test("slow connector poll schedules its next check only after completion",async()=>{
 let resolve,scheduled=[],calls=0;
 const stop=pollSequential(()=>{calls++;return new Promise(r=>{resolve=r;});},{timers:{setTimeout:(fn,ms)=>{scheduled.push({fn,ms});return 1;},clearTimeout:()=>{}}});
 await Promise.resolve();assert.equal(calls,1);assert.equal(scheduled.length,0);
 resolve();await Promise.resolve();await Promise.resolve();assert.equal(scheduled.length,1);
 assert.equal(scheduled[0].ms,5000);stop();
});
test("hidden window backs off and stopped poll cannot restart",async()=>{
 let scheduled=0;
 const stop=pollSequential(async()=>{}, {isHidden:()=>true,timers:{setTimeout:(_fn,ms)=>{assert.equal(ms,15000);scheduled++;return 1;},clearTimeout:()=>{}}});
 stop();await Promise.resolve();await Promise.resolve();assert.equal(scheduled,0);
});
