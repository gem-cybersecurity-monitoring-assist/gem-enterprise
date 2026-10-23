class GemPitchProcessor extends AudioWorkletProcessor {
  constructor() {super();this.buffer=new Float32Array(16384);this.write=0;this.phase=0;this.ratio=1;this.port.onmessage=e=>{const r=e.data?.ratio;if(Number.isFinite(r))this.ratio=Math.max(0.65,Math.min(1.5,r));};}
  read(delay){let position=this.write-delay;while(position<0)position+=this.buffer.length;const index=Math.floor(position)%this.buffer.length;const f=position-Math.floor(position);return this.buffer[index]*(1-f)+this.buffer[(index+1)%this.buffer.length]*f;}
  process(inputs,outputs){
    const input=inputs[0]?.[0],output=outputs[0]?.[0];if(!output)return true;
    const grain=Math.round(sampleRate*0.04);
    for(let i=0;i<output.length;i++){
      const sample=input?.[i]||0;const value=Number.isFinite(sample)?sample:0;this.buffer[this.write]=value;
      if(Math.abs(this.ratio-1)<0.001)output[i]=value;
      else {
        this.phase+=(1-this.ratio)/grain;this.phase-=Math.floor(this.phase);
        const other=(this.phase+0.5)%1,weight=Math.sin(Math.PI*this.phase)**2;
        const processed=this.read(128+this.phase*grain)*weight+this.read(128+other*grain)*(1-weight);
        output[i]=Number.isFinite(processed)?Math.max(-1,Math.min(1,processed)):0;
      }
      this.write=(this.write+1)%this.buffer.length;
    }
    return true;
  }
}
registerProcessor("gem-pitch",GemPitchProcessor);
