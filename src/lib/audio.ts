/**
 * Microphone capture → 16 kHz mono PCM16 frames (~100 ms) for the live meeting WebSocket.
 * Uses an AudioWorklet (off the main thread) and exposes an AnalyserNode for the waveform.
 */

const WORKLET = `
class PcmWriter extends AudioWorkletProcessor {
  constructor(opts) {
    super();
    this.ratio = sampleRate / 16000;
    this.buf = [];
    this.pos = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.pos += 1;
      if (this.pos >= this.ratio) { this.pos -= this.ratio; this.buf.push(ch[i]); }
    }
    if (this.buf.length >= 1600) {
      const out = new Int16Array(this.buf.length);
      for (let i = 0; i < this.buf.length; i++) { const s = Math.max(-1, Math.min(1, this.buf[i])); out[i] = s < 0 ? s * 0x8000 : s * 0x7fff; }
      this.port.postMessage(out.buffer, [out.buffer]);
      this.buf = [];
    }
    return true;
  }
}
registerProcessor("pcm-writer", PcmWriter);
`;

export interface MicCapture {
  analyser: AnalyserNode | null;
  stop: () => void;
  simulated: boolean;
}

export async function startMic(onFrame: (pcm: ArrayBuffer) => void): Promise<MicCapture> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  const ctx = new AudioContext();
  const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
  await ctx.audioWorklet.addModule(url);
  URL.revokeObjectURL(url);
  const src = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  const node = new AudioWorkletNode(ctx, "pcm-writer");
  node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => onFrame(e.data);
  src.connect(analyser);
  src.connect(node);
  return {
    analyser,
    simulated: false,
    stop: () => {
      node.port.onmessage = null;
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
    },
  };
}

/** Demo fallback when no microphone is available: streams silence frames so the pipeline runs. */
export function startSimulated(onFrame: (pcm: ArrayBuffer) => void): MicCapture {
  const t = setInterval(() => onFrame(new Int16Array(1600).buffer), 100);
  return { analyser: null, simulated: true, stop: () => clearInterval(t) };
}
