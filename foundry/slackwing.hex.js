function to_space_separated_hex_bytes_string(atom_hex_edit_output) {
  // TODO: Validate and throw error.
  var lines = atom_hex_edit_output.split(/\r?\n/);
  var space_separated_hex_bytes = "";
  for (var i = 0; i < lines.length; i++) {
    space_separated_hex_bytes += lines[i].substring(8, 56);
  }
  return space_separated_hex_bytes;
}

function to_binary_string(space_separated_hex_bytes) {
  // TODO: Validate and throw error.

  // https://stackoverflow.com/a/45054052/925913
  function hex2bin(hex) {
    return ("00000000" + (parseInt(hex, 16)).toString(2)).substr(-8);
  }

  var binary_string = "";
  for (var i = 0; i < space_separated_hex_bytes.length; i += 3) {
    var hex_byte = space_separated_hex_bytes.substring(i, i + 2);
    var binary_byte = hex2bin(hex_byte);
    binary_string += binary_byte;
  }
  return binary_string;
}
