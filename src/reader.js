const BUFFER = "BUFFER"
  , RAW = "RAW"
  , VIEW = "VIEW"

export default class Reader {
  constructor(buffer) {
    this[BUFFER] = buffer;
    this[RAW]= new Uint8Array(this[BUFFER]);
    this[VIEW] = new DataView(this[BUFFER]);

    this.index = 0;
  }

  get length() {
    return this[BUFFER].byteLength;
  }

  readBytes(len) {
    let nb = new Reader(this[BUFFER].slice(this.index, this.index + len));
    this.index += len;
    return nb;
  }

  readVarInt() {
    let i = this.readUVarInt()
      , s = i >> 1

    if ((i & 1) !== 0) {
      s = ~s;
    }

    return s;
  }

  readUVarInt() {
    let x = 0
      , s = 0

    for (var i = 0;; i++) {
      let b = this[RAW][this.index++]

      if (b < 0x80)
        return x | (b << s);

      x |= (b & 0x7f) << s;
      s += 7;
    };
  }

  readString({ prefixed = true, len = 0 } = {}) {
    if (!prefixed && !len)
      throw new Error("Unprefixed reads should provide a length");

    let view = this[VIEW]
      , length = prefixed ? this.readUVarInt() : len
      , offset = this.index

    var string = "";
    for (var i = offset, end = offset + length; i < end; i++) {
      var byte = view.getUint8(i);

      if ((byte & 0x80) === 0x00) {
        string += String.fromCharCode(byte);
        continue;
      }

      if ((byte & 0xe0) === 0xc0) {
        string += String.fromCharCode(
          ((byte & 0x0f) << 6) |
          (view.getUint8(++i) & 0x3f)
        );
        continue;
      }

      if ((byte & 0xf0) === 0xe0) {
        string += String.fromCharCode(
          ((byte & 0x0f) << 12) |
          ((view.getUint8(++i) & 0x3f) << 6) |
          ((view.getUint8(++i) & 0x3f) << 0)
        );
        continue;
      }

      if ((byte & 0xf8) === 0xf0) {
        string += String.fromCharCode(
          ((byte & 0x07) << 18) |
          ((view.getUint8(++i) & 0x3f) << 12) |
          ((view.getUint8(++i) & 0x3f) << 6) |
          ((view.getUint8(++i) & 0x3f) << 0)
        );
        continue;
      }
      throw new Error("Invalid byte " + byte.toString(16));
    }

    this.index += length;

    return string;
  }
};

[["Int8", 1], ["Uint8", 1], ["Int16", 2], ["Uint16", 2], ["Int32", 4], ["Uint32", 4], ["Float32", 4], ["Float64", 8]].forEach(([name, len]) => {
  Reader.prototype[`read${name}`] = function(value) {
    let val = this[VIEW][`get${name}`](this.index, false);
    this.index += len;
    return val;
  }
});
