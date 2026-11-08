import test from "node:test";
import assert from "node:assert/strict";
import { poseDistance, within, visibleBody } from "../app/src/pose-puppet.js";

const pose = () => Array.from({length:33}, (_,i) => ({
  x:(i%5)/5,y:(i%7)/7,visibility:0.95
}));
test("geometry measurements remain finite and exact", () => {
  assert.equal(poseDistance({x:0,y:0},{x:3,y:4}),5);
  assert.equal(within(6,0,4),4);
  assert.equal(within(-2,0,4),0);
  assert.equal(within(2,0,4),2);
});
test("pose readiness requires both shoulders and both hips", () => {
  const p=pose();assert.equal(visibleBody(p),true);
  p[24].visibility=0.2;assert.equal(visibleBody(p),false);
  p[24]=undefined;assert.equal(visibleBody(p),false);
  assert.equal(visibleBody(null),false);
});
test("renderer is explicit 2D demonstration, not photoreal promise", async () => {
  const fs=await import("node:fs/promises");
  const source=await fs.readFile(new URL("../app/src/pose-puppet.js",import.meta.url),"utf8");
  assert.match(source,/2D MOTION DEMO/);
  assert.match(source,/BODY TRACKING WAIT/);
  assert.doesNotMatch(source,/sourceVideo\.captureStream\(/);
});
