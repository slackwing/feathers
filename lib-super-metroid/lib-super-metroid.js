// TODO: Factor this out.
function dynamicallyLoadScript(url) {
    var script = document.createElement("script");
    script.src = url;
    document.head.appendChild(script);
}

dynamicallyLoadScript('../util/slackwing.slog.js');

function LBYTE(x) { return x & 0b11111111 }
function HBYTE(x) { return (x & (0b11111111 << 8)) >> 8 }

// TODO: Learn how to namespace things.
slog_init('sm_prng(x)', 3);
function sm_prng(x) {
  slog('x', x);
  var L5 = LBYTE(x) * 5;
  slog('LB', LBYTE(x));
  slog('L5', L5);
  var H5 = HBYTE(x) * 5;
  slog('HB', HBYTE(x));
  slog('H5', H5);
  var v1 = LBYTE(H5) + HBYTE(L5) + 1;
  slog('v1', v1);
  var carry = HBYTE(v1) > 0 ? 1 : 0;
  slog('carry', carry);
  var v2 = (LBYTE(v1) << 8) + LBYTE(L5);
  slog('v2', v2);
  return (v2 + 0x11 + carry);
}

