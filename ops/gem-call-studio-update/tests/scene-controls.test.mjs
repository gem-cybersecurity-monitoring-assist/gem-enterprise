import {test} from "node:test";
import assert from "node:assert/strict";
import {validateNotionUrl,validateBackground} from "../app/src/scene-controls.js";
test("Notion links must use trusted HTTPS Notion hosts",()=>{
 assert.ok(validateNotionUrl("https://app.notion.com/p/123"));
 assert.ok(validateNotionUrl("https://myspace.notion.site/example"));
 for(const u of ["javascript:alert(1)","http://notion.so/x","https://notion.so.evil.com/x","https://evil.com/notion.so","https://user:pass@notion.so/x"])assert.throws(()=>validateNotionUrl(u));
});
test("scene upload supports stills and moving backgrounds with bounded sizes",()=>{
 validateBackground({type:"image/png",size:100});validateBackground({type:"video/mp4",size:100});
 for(const f of [{type:"image/svg+xml",size:10},{type:"video/mp4",size:21*1024*1024},{type:"image/png",size:0}])assert.throws(()=>validateBackground(f));
});
