function __define_macro() {
  return async function() {
    let config = arguments[0] ??= {};
    let path = arguments[1] ??= "defaultArgument1";
    let icon = arguments[2] ??= "defaultArgument2";
    await dynamicallyLoadAwcml(config, path);
    return `<!-- ${path}, ${icon}, ${config["title"]} -->`;
  }
}
