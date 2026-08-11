// Records raw PCM from a mic MediaStream and encodes it as a plain WAV
// file - used for voice messages instead of MediaRecorder, whose
// compressed webm/opus output has no seek index and can't be scrubbed at
// all in Firefox (confirmed: neither dragging a seek bar nor relative
// skip buttons work, both silently snap back). WAV needs no index in the
// first place - fixed-size frames mean any position is direct byte math -
// so seeking just works everywhere, at the cost of a much larger file.
// Voice messages are short enough that the size tradeoff is acceptable.
export class WavRecorder {
    private audioContext: AudioContext;
    private source: MediaStreamAudioSourceNode;
    private processor: ScriptProcessorNode;
    private silentGain: GainNode;
    private chunks: Float32Array[] = [];

    constructor(stream: MediaStream) {
        this.audioContext = new AudioContext();
        this.source = this.audioContext.createMediaStreamSource(stream);
        // Mono - a single mic input is mono content anyway, and the Web
        // Audio API downmixes for us just by asking for 1 output channel
        // here, no manual channel math needed.
        this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
        this.processor.onaudioprocess = (e) => {
            this.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
        };
        // onaudioprocess only reliably fires once the node is connected
        // all the way to a destination, even in browsers that don't
        // strictly require it - but connecting straight to
        // audioContext.destination would also play the mic back out loud
        // in real time as you record. Routing through a silent gain node
        // satisfies "connected to a destination" without the feedback.
        this.silentGain = this.audioContext.createGain();
        this.silentGain.gain.value = 0;
        this.source.connect(this.processor);
        this.processor.connect(this.silentGain);
        this.silentGain.connect(this.audioContext.destination);
    }

    // Stops capturing and returns everything recorded so far as a WAV Blob.
    stop(): Blob {
        this.teardown();
        return encodeWav(this.chunks, this.audioContext.sampleRate);
    }

    // Stops capturing and discards it - for a cancelled recording.
    cancel(): void {
        this.teardown();
    }

    private teardown(): void {
        this.processor.disconnect();
        this.source.disconnect();
        this.silentGain.disconnect();
        void this.audioContext.close();
    }
}

function encodeWav(chunks: Float32Array[], sampleRate: number): Blob {
    const totalSamples = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const pcm = new Int16Array(totalSamples);
    let offset = 0;
    for (const chunk of chunks) {
        for (let i = 0; i < chunk.length; i++) {
            const sample = Math.max(-1, Math.min(1, chunk[i]));
            pcm[offset++] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        }
    }

    const bytesPerSample = 2;
    const buffer = new ArrayBuffer(44 + pcm.length * bytesPerSample);
    const view = new DataView(buffer);
    const writeString = (byteOffset: number, value: string) => {
        for (let i = 0; i < value.length; i++) view.setUint8(byteOffset + i, value.charCodeAt(i));
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + pcm.length * bytesPerSample, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * bytesPerSample, true); // byte rate
    view.setUint16(32, bytesPerSample, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    writeString(36, "data");
    view.setUint32(40, pcm.length * bytesPerSample, true);
    new Int16Array(buffer, 44).set(pcm);

    return new Blob([buffer], { type: "audio/wav" });
}
