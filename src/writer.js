const BUFFER = "BUFFER"
  , RAW = "RAW"
  , VIEW = "VIEW"

export default class Writer {
  constructor(cap = 32) {
    this.index = 0;
    this.buffer = new ArrayBuffer(cap);
  }

  set buffer(buffer) {
    this[BUFFER] = buffer;
    this[RAW]= new Uint8Array(this[BUFFER]);
    this[VIEW] = new DataView(this[BUFFER]);
    this.index = Math.min(this.buffer.byteLength, Math.max(0, this.index));
  }

  get buffer() {
    return this[BUFFER].slice(0, this.index);
  }

  ensureSize(n) {
    if (n < this.buffer.byteLength)
      return this;

    const nsize = n + 32;
    const view = new Uint8Array(nsize);
    view.set(this[RAW], 0);
    this.buffer = view.buffer;
    return this;
  }

  ensureFree(n) {
    return this.ensureSize(this.index + n);
  }

  write(arr) {
    if (!(arr instanceof Uint8Array)) {
      arr = new Uint8Array(arr);
    }

    this.ensureFree(arr.byteLength);
    this[RAW].set(arr, this.index);
    this.index += arr.byteLength;

    return this;
  }

  writeVarInt(num) {
    num = num << 1;
    if (num < 0) num = ~num;
    return this.writeUVarInt(num);
  }

  writeUVarInt(num) {
    let bytes = [];
    while (num > 0x80) {
      bytes.push((num & 0xFF) | 0x80);
      num = num >> 7;
    }
    bytes.push(num | 0);

    this.write(bytes);

    return this;
  }

  writeString(string, { prefixed = true } = {}) {
    let length = utf8ByteCount(string)
      , out = new Uint8Array(length)
      , offset = 0

    if (prefixed)
      this.writeUVarInt(length);

    this.ensureFree(length);

    for(var i = 0, l = string.length; i < l; i++) {
      var codePoint = string.charCodeAt(i);

      // One byte of UTF-8
      if (codePoint < 0x80) {
        out[offset++] = codePoint >>> 0 & 0x7f | 0x00;
        continue;
      }

      // Two bytes of UTF-8
      if (codePoint < 0x800) {
        out[offset++] = codePoint >>> 6 & 0x1f | 0xc0;
        out[offset++] = codePoint >>> 0 & 0x3f | 0x80;
        continue;
      }

      // Three bytes of UTF-8.
      if (codePoint < 0x10000) {
        out[offset++] = codePoint >>> 12 & 0x0f | 0xe0;
        out[offset++] = codePoint >>> 6  & 0x3f | 0x80;
        out[offset++] = codePoint >>> 0  & 0x3f | 0x80;
        continue;
      }

      // Four bytes of UTF-8
      if (codePoint < 0x110000) {
        out[offset++] = codePoint >>> 18 & 0x07 | 0xf0;
        out[offset++] = codePoint >>> 12 & 0x3f | 0x80;
        out[offset++] = codePoint >>> 6  & 0x3f | 0x80;
        out[offset++] = codePoint >>> 0  & 0x3f | 0x80;
        continue;
      }
      throw new Error("bad codepoint " + codePoint);
    }

    this.write(out);
    return this;
  }
};

[["Int8", 1], ["Uint8", 1], ["Int16", 2], ["Uint16", 2], ["Int32", 4], ["Uint32", 4], ["Float32", 4], ["Float64", 8]].forEach(([name, len]) => {
  Writer.prototype[`write${name}`] = function(value) {
    this.ensureFree(len)[VIEW][`set${name}`](this.index, value, false);
    this.index += len;
    return this;
  }
});

function utf8ByteCount(string) {
  var count = 0;
  for(var i = 0, l = string.length; i < l; i++) {
    var codePoint = string.charCodeAt(i);
    if (codePoint < 0x80) {
      count += 1;
      continue;
    }
    if (codePoint < 0x800) {
      count += 2;
      continue;
    }
    if (codePoint < 0x10000) {
      count += 3;
      continue;
    }
    if (codePoint < 0x110000) {
      count += 4;
      continue;
    }
    throw new Error("bad codepoint " + codePoint);
  }
  return count;
}
