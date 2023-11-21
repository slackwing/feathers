/**
 *  These functions are Javascript emulations of SNES (65C816) assembly code.
 *  The all take and return a Number. They are only designed to handle 16-bit
 *  numbers, i.e. integers between 0 and 65,536, unless otherwise stated.
 *  Behavior is undefined outside of these boundaries.
 */

function LBYTE(x) {
  return x & 0b11111111; // Returns an 8-bit number (0-255).
}

function HBYTE(x) {
  return (x & (0b11111111 << 8)) >> 8; // Returns an 8-bit number (0-255).
}

function SM_RNG(x) {
  var L5 = LBYTE(x) * 5;
  var H5 = HBYTE(x) * 5;
  var v1 = LBYTE(H5) + HBYTE(L5) + 1;
  var carry = HBYTE(v1) > 0 ? 1 : 0;
  var v2 = (LBYTE(v1) << 8) + LBYTE(L5);
  var ans = v2 + 0x11 + carry;
  return ans % 65536; // TODO: Patch original with this line.
}

function XBA(x) {
  return ((x & 0b11111111) << 8) | ((x >> 8) & 0b11111111);
}

function SM_RNG_XBA(x) {
  var ans = SM_RNG(x)
  ans = XBA(ans);
  return ans % 65536;
}
