/**
 * Relocates an MP4/ISO-BMFF file's `moov` box (its metadata: track list,
 * sample tables) to the front of the file if it isn't already there -
 * "faststart". Some browsers' blob-backed `<video>` playback can fail to
 * read metadata at all when `moov` trails `mdat` (the actual video/audio
 * bytes), even though the exact same bytes play fine from a real file or a
 * Range-capable HTTP server, which can freely seek to a trailing moov - a
 * blob: URL apparently can't always be relied on to do the same.
 *
 * Since the whole file is already in memory at this point (this is only
 * ever run on an already-fully-decrypted video), the fix is just to
 * physically move the bytes and patch the one thing that breaks when you
 * do: the absolute file offsets recorded inside moov's sample tables
 * (stco/co64), which point at sample data in mdat and have to shift by
 * however far moov itself moved.
 */

interface Box {
    type: string;
    start: number;
    headerSize: number;
    size: number;
}

// Only these box types are defined to contain further nested boxes - box
// types that aren't in this list either aren't containers at all (e.g.
// stsd, stts) or are containers whose children can never include stco/co64
// (nothing relevant to walk into). Restricting recursion to a known
// allowlist (rather than "recurse into anything") avoids ever misreading a
// leaf box's own data as if it were nested boxes, which could otherwise
// coincidentally spell out "stco"/"co64" in unrelated binary data.
const CONTAINER_BOX_TYPES = new Set(["moov", "trak", "mdia", "minf", "stbl", "dinf", "edts", "mvex", "udta"]);

function readBoxes(view: DataView, start: number, end: number): Box[] {
    const boxes: Box[] = [];
    let offset = start;
    while (offset + 8 <= end) {
        const size32 = view.getUint32(offset, false);
        const type = String.fromCharCode(
            view.getUint8(offset + 4), view.getUint8(offset + 5),
            view.getUint8(offset + 6), view.getUint8(offset + 7),
        );

        let headerSize = 8;
        let size = size32;
        if (size32 === 1) {
            if (offset + 16 > end) break;
            const hi = view.getUint32(offset + 8, false);
            const lo = view.getUint32(offset + 12, false);
            size = hi * 2 ** 32 + lo;
            headerSize = 16;
        } else if (size32 === 0) {
            size = end - offset;
        }

        if (size < headerSize || offset + size > end) break; // malformed - stop rather than misread
        boxes.push({ type, start: offset, headerSize, size });
        offset += size;
    }
    return boxes;
}

function patchChunkOffsets(moovBytes: Uint8Array, delta: number): void {
    const view = new DataView(moovBytes.buffer, moovBytes.byteOffset, moovBytes.byteLength);

    function walk(start: number, end: number): void {
        for (const box of readBoxes(view, start, end)) {
            if (box.type === "stco") {
                const entryCount = view.getUint32(box.start + box.headerSize + 4, false);
                let p = box.start + box.headerSize + 8;
                for (let i = 0; i < entryCount; i++, p += 4) {
                    view.setUint32(p, view.getUint32(p, false) + delta, false);
                }
            } else if (box.type === "co64") {
                const entryCount = view.getUint32(box.start + box.headerSize + 4, false);
                let p = box.start + box.headerSize + 8;
                for (let i = 0; i < entryCount; i++, p += 8) {
                    const hi = view.getUint32(p, false);
                    const lo = view.getUint32(p + 4, false);
                    const value = hi * 2 ** 32 + lo + delta;
                    view.setUint32(p, Math.floor(value / 2 ** 32), false);
                    view.setUint32(p + 4, value >>> 0, false);
                }
            } else if (CONTAINER_BOX_TYPES.has(box.type)) {
                walk(box.start + box.headerSize, box.start + box.size);
            }
        }
    }

    walk(0, moovBytes.length);
}

// Returns the original bytes unchanged whenever the file isn't a shape this
// can safely rewrite (not MP4 at all, already faststart, malformed, more
// than one mdat, anything unexpected) - this only ever needs to make a good
// file better, never turn a working one into a broken one.
export function makeMp4Faststart(bytes: Uint8Array): Uint8Array {
    try {
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const topBoxes = readBoxes(view, 0, bytes.length);

        const moovBox = topBoxes.find((b) => b.type === "moov");
        const mdatBox = topBoxes.find((b) => b.type === "mdat");
        if (!moovBox || !mdatBox || moovBox.start < mdatBox.start) {
            return bytes; // not MP4-shaped, or already faststart
        }
        if (topBoxes.filter((b) => b.type === "mdat").length > 1) {
            return bytes; // multiple mdat boxes - offset math below assumes exactly one
        }

        const reordered = [
            ...topBoxes.filter((b) => b.type === "ftyp"),
            moovBox,
            ...topBoxes.filter((b) => b.type !== "ftyp" && b.type !== "moov"),
        ];

        let newOffset = 0;
        let mdatNewStart = -1;
        for (const box of reordered) {
            if (box === mdatBox) mdatNewStart = newOffset;
            newOffset += box.size;
        }
        const delta = mdatNewStart - mdatBox.start;

        const moovBytes = bytes.slice(moovBox.start, moovBox.start + moovBox.size);
        patchChunkOffsets(moovBytes, delta);

        const result = new Uint8Array(bytes.length);
        let writeOffset = 0;
        for (const box of reordered) {
            const src = box === moovBox ? moovBytes : bytes.subarray(box.start, box.start + box.size);
            result.set(src, writeOffset);
            writeOffset += box.size;
        }
        return result;
    } catch {
        return bytes;
    }
}
