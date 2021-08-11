import {createHash} from "sha256-uint8array"

const {fromCharCode} = String;

export const encode = (uint8array: Uint8Array) => {
  const output = [];
  for (let i = 0, {length} = uint8array; i < length; i++)
    output.push(fromCharCode(uint8array[i]));
  return btoa(output.join(''));
}
export const decode = (chars: string) => Uint8Array.from(atob(chars), asCharCode);

const asCharCode = (c: string) => c.charCodeAt(0);

export function makeHash(secret: string) {
  return createHash().update(secret).digest()
}

export function makeHashBase64(secret: string) {
  return encode(makeHash(secret))
}

export function concatUint8Arrays(a1: Uint8Array, a2: Uint8Array) {
  var tmp = new Uint8Array(a1.length + a2.length)
  tmp.set(a1)
  tmp.set(a2, a1.length)
  return tmp;
}