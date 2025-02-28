/**
  * Logging
  */
let ___DEBUG = false;
let ___indent = 0;
function indent() { ___indent++; }
function dedent() { if (--___indent < 0) ___indent = 0; }
function debug(msg) { if (___DEBUG) log(msg, "*"); }
function error(msg) { log(msg, "!"); }
function hint(msg) { log(msg, "~"); }
function log(msg, indicator = ">") {
  let indent = " ".repeat(___indent * 2);
  console.log(indent + `${indicator}${indicator}  ` + msg.replace(/\n/g, `\n${indent}    `));
}

/**
  * Utilities
  */
function copyByReference(source, target) {
  Object.keys(target).forEach(key => {
    delete target[key];
  });
  Object.assign(target, source);
}
// https://stackoverflow.com/a/79281767/925913
async function replacePseudoAsync(string, regexp, replacerFunction) {
  const matches = string.matchAll(regexp);
  let replacements = [];
  for (const match of matches) {
    replacements.push(await replacerFunction(...match));
  }
  let i = 0;
  return string.replace(regexp, () => replacements[i++]);
}
// https://stackoverflow.com/a/37611257/925913
function getPropertyByPath(object, path) {
  return path.split('.').reduce(function(o, k) {
    return o && o[k];
  }, object);
}

/**
  * AWCML
  */
let __dynamically_loaded_urls = {};
let __dynamically_loaded_macros = {};
let __macros = {};
let __config = {
  "__active_macro": "default",
  "__enum_types": {}, // e.g. {PAGE_TYPE: ["INDEX", "ARTICLE", ...], ..}
  "__enums": {}, // e.g. {PAGE_TYPE.INDEX: true, PAGE_TYPE.ARTICLE: true, ...}
  "__last_include_result": undefined,
};
let __magic_string = "________MAGIC_STRING_";
let __escapes = {};

// TODO: Learn how to make an actual .js library, e.g. marked.js.
async function executeAwcml(config, text, configOnly = true) {

  if (!text) return;

  log("running awcml.js (begin)");
  let awcmlJsBegun = performance.now();

  // Escape things that may accidentally contain AWCML syntax.

  const reCodeBlock = String.raw`\`\`\`(?:\w+)?\s*(?:[\s\S]*?)\s*\`\`\``;
  const escapeRe = new RegExp(
    reCodeBlock,
    "smg"
  );

  text = text.replace(escapeRe, (match) => {
    let key = `${__magic_string}${Object.keys(__escapes).length}`;
    __escapes[key] = match;
    log(`escaping ${match.length} bytes with ${key}`);
    return key;
  });

  // Process AWCML syntax.

  const reComment1 = String.raw`^\/\/[^\r\n]*[\r\n]`;
  const reComment2 = String.raw`\/\*.*?\*\/`;
  const reOperator1 = String.raw`([A-Z0-9_]+)\s*\@\@((?:\s*[A-Z0-9_]+\s*(?:\;\;|$))+)`;
  const reOperator2 = String.raw`\{\{(.*?)\}\}`;
  const reOperator3 = String.raw`\[\[(.*?)\]\]`;
  const reOperator4 = String.raw`(?:\<\<|&lt;&lt;)(.*?)(?:\>\>|&gt;&gt;)`;
  const reOperator5 = String.raw`\~\~(.*?)\~\~`;
  const reOperator6 = String.raw`(\$\$[a-zA-Z0-9_]+)`;
  const reOperator7 = String.raw`(\^\^)`;
  const reOperator8 = String.raw`\?\?[ \t]*([a-zA-Z0-9_]+)[ \t]*\=\=[ \t]*(\S+)$(.*?)[ \t]*\?\?\=\=`;

  const reAwcml = new RegExp(
    reComment1 + "|" +
    reComment2 + "|" +
    reOperator1 + "|" +
    reOperator2 + "|" + 
    reOperator3 + "|" + 
    reOperator4 + "|" +
    reOperator5 + "|" +
    reOperator6 + "|" +
    reOperator7,
    "smg"
  );

  let asyncInstances = [];

  text = await replacePseudoAsync(
      text,
      reAwcml,
      async function (match, op1, args1, op2, op3, op4, op5, op6, op7, op8, op9, op10) {
        if (op1 !== undefined) {
          log("processing @@");
          parseEnum(config, op1, args1);
        } else if (op2 !== undefined) {
          log("processing {{}}");
          parseConfig(config, interpolateConfig(config, op2));
        } else if (op3 !== undefined && !configOnly) {
          log("processing [[]]");
          return await parseMacro(config, interpolateConfig(config, op3), asyncInstances);
        } else if (op4 !== undefined) {
          log("processing <<>>");
          __config["__last_include_result"] =
              await parseInclude(config, interpolateConfig(config, op4));
        } else if (op5 !== undefined && !configOnly) {
          log("processing ~~~~");
          // TODO parseStyle(op5);
        } else if (op6 !== undefined) {
          log("processing $$");
          return interpolateConfig(config, op6);
        } else if (op7 !== undefined) {
          log("processing ^^");
          if (__config["__last_include_result"] === undefined) {
            error("^^ used but no previous <<>> include");
          }
          return __config["__last_include_result"];
        }
        return "";
      }
  );

  const reAwcmlSwitch = new RegExp(reOperator8, "smg");

  // TODO: Do this in a `while` loop until no more switches are found, for nested switches.
  text = await replacePseudoAsync(
    text,
    reAwcmlSwitch,
    async function (match, op8, op9, op10) {
      if (op8 !== undefined) {
        log("processing ??==");
        if (config[op8] === undefined) {
          error("??== cannot find \"" + op8 + "\"");
        } else {
          log("??== testing \"" + config[op8] + "\" against \"" + op9 + "\"");
          if (config[op8] == op9) {
            return op10;
          }
        }
      }
      return "";
    }
  );

  // Unescape.
  
  text = text.replace(new RegExp(__magic_string + "\\d+", "g"), (match) => {
    return __escapes[match];
  });

  if (configOnly) return;

  let promises = asyncInstances.map(async (instance) => {
    // Store the promise so it can be returned later as well so we can do a Promise.all().
    const promise = dynamicallyLoadMacro(instance.macro);
    await promise;
    let summary = `instance ${instance.id}, ` +
                  `macro ${instance.macro}, ` +
                  `args ${instance.args.join(", ")}`;
    debug(`ASYNC execution (begin): ${summary}`);
    let result = await __macros[instance.macro]({...config}, ...instance.args);
    debug(`ASYNC execution (ended): ${summary}`);
    let placeholder = document.getElementById("awcml-async-instance-" + instance.id);
    if (placeholder) {
      placeholder.outerHTML = marked.parse(result);
    } else {
      error(`failed to find #awcml-async-instance-${instance.id}`);
    }
    return promise;
  });

  Promise.all(promises).then(() => {
    const awcmlJsAsyncEnded = performance.now();
    const awcmlJsAsyncElapsed = (awcmlJsAsyncEnded - awcmlJsBegun).toFixed(2);
    log(`running awcml.js and marked.js (ended, async) (${awcmlJsAsyncElapsed}ms)`);
  });

  log("running marked.js (begin, sync)");
  const markedJsBegun = performance.now();
  text = marked.parse(text);
  const markedJsEnded = performance.now();
  const markedJsElapsed = (markedJsEnded - markedJsBegun).toFixed(2);
  log(`running marked.js (ended, sync) (${markedJsElapsed}ms)`);
  const awcmlJsEnded = performance.now();
  const awcmlJsElapsed = (awcmlJsEnded - awcmlJsBegun).toFixed(2);
  log(`running awcml.js (ended, sync) (${awcmlJsElapsed}ms)`);

  return text;
}

function parseEnum(config, type, input) {
  indent();
  const enums = input.split(/\s*;;\s*/);
  log(`found enum type ${type} of ${enums.join(", ").trim()}`);
  if (Object.hasOwn(config.__enum_types, type)) {
    error(`enum type ${type} already defined`);
    return;
  }
  config.__enums[type] = enums;
  let value;
  for (value of enums) {
    let qualified = `${type}.${value}`;
    if (Object.hasOwn(config.__enums, qualified)) {
      error(`enum ${qualified} already defined`);
      return;
    }
    config.__enums[qualified] = true;
  }
  dedent();
}

function parseConfig(config, input) {
  indent();
  debug("raw config input:\n" + input);
  // Quick-n-dirty formalization of JSON.
  debug("formalizing json"); 
  // Surround with braces, quote unquoted words (skipping any string containing numbers or
  // whitespace), and strip hanging commas.
  input = '{' + input + '}';
  const jsonChars = "\\{\\}\\[\\]:,";
  const quoteChars = "'\"";
  const skipChars = "\\s0-9";
  const captureGroupLeft = `(\\s*[${jsonChars}\\s]*)`;
  const captureGroupMid = `([^${jsonChars}${quoteChars}${skipChars}]+)`;
  // Additionally avoids escaped jsonChars.
  const captureGroupRight = `(\\s*(?=(?<!\\\\)[${jsonChars}]))`;
  input = input.replace(
      new RegExp(captureGroupLeft + captureGroupMid + captureGroupRight, "g"),
      "$1\"$2\"$3"
  );
  // Process escaped jsonChars.
  input = input.replace(
      new RegExp(`\\\\([${jsonChars}])`, "g"),
      "$1"
  );
  // Strip hanging commas.
  input = input.replace(/,(\s*[\]\}])/g, "$1");
  debug("formalized json:\n" + input);
  try {
    // Parse and shallow-merge, overlaying the existing config.
    debug("parsing json...");
    const merged = {...config, ...JSON.parse(input)};
    copyByReference(merged, config);
  } catch (e) {
    error("error parsing input:\n" + input);
    if (e instanceof SyntaxError) {
      if (e.message.startsWith("Expected") &&
          e.message.includes("after property")) {
        hint(`jsonChars like "{}[]:," and double-quotes need to be escaped with a backslash`);
      }
    }
    throw e;
  }
  dedent();
}

async function parseMacro(config, input, asyncInstances) {
  indent();
  debug("raw macro input:\n" + input);
  // e.g. [[>> common/utils :: someMacro ;; arg1 ;; arg2 ;; arg3 ]]
  let match = input.match(/^\s*(>>|&gt;&gt;)?\s*(?:([a-zA-Z0-9_-]+)\s*::)?\s*(.+?)\s*$/);
  if (match === null) {
    error("invalid syntax in macro");
    return "";
  }
  let async = match[1] !== undefined;
  let macro = config.__active_macro;
  if (match[2] !== undefined) {
    macro = match[2];
    debug(`explicit macro ${macro}`);
  } else {
    debug(`implicit macro ${macro}`);
  }
  let args = match[3].split(/\s*;;\s*/);
  debug(`macro args: ${args.join(", ")}`);
  if (!async) {
    debug('sync execution');
    await dynamicallyLoadMacro(macro);
    const result = __macros[macro]({...config}, ...args);
    debug(`result: ${result}`);
    dedent();
    return result;
  }
  let asyncInstanceId = asyncInstances.length;
  asyncInstances.push({id: asyncInstanceId, macro: macro, args: args});
  dedent();
  return `<span class="awcml-async-macro" id="awcml-async-instance-${asyncInstanceId}"></span>`;
}

async function parseInclude(config, input) {
  indent();
  debug("raw include input:\n" + input);
  let match = input.match(/^\s*(.+?)\s*$/);
  const result = await dynamicallyLoadAwcml(config, match[1]);
  dedent();
  return result;
}

function interpolateConfig(config, input) {
  indent();
  debug("interpolating config on:\n" + input);
  const result = input.replace(/\$\$([a-zA-Z0-9_]+)/g, (match, key) => {
    const value = getPropertyByPath(config, key);
    if (value === undefined) {
      error(`key ${key} not found in config; dumping config:`);
      return match;
    }
    debug(`replacing $$${key} with ${getPropertyByPath(config, key)}`);
    return value;
  });
  dedent();
  return result;
}

function dynamicallyLoadJs(url) {
  if (Object.hasOwn(__dynamically_loaded_urls, url)) {
    return __dynamically_loaded_urls[url];
  }
  const promise = new Promise((resolve, reject) => {
    let script = document.createElement('script');
    script.onload = function() {
      log(`successfully loaded ${url}`);
      resolve();
    }
    script.src = url;
    document.head.appendChild(script);
    log(`dynamically loading ${url}`);
  });
  __dynamically_loaded_urls[url] = promise;
  return promise;
}

function dynamicallyLoadMacro(macroName) {
  // A separate cache is necessary in order not to call __define_macro() for a macro more than
  // once and only once, directly after the Javascript file was (actually) loaded.
  if (Object.hasOwn(__dynamically_loaded_macros, macroName)) {
    return __dynamically_loaded_macros[macroName];
  }
  log(`dynamically loading macro "${macroName}"`);
  const promise = dynamicallyLoadJs("awcml-macros/macro." + macroName + ".js")
      .then(() => {
        __macros[macroName] = __define_macro();
        log(`successfully loaded macro "${macroName}"`);
      })
      .catch(e => {
        delete __dynamically_loaded_macros[macroName];
        throw e;
      });
  __dynamically_loaded_macros[macroName] = promise;
  return promise;
}

async function dynamicallyLoadAwcml(config, path) {
  try {
    const file = path + ".awcml";
    debug(`dynamically loading awcml file ${file}`);
    const response = await fetch(file); // Prevent accidental recursion via appending extension.
    if (!response.ok) {
      throw new Error(`http error; status ${response.status}.`);
    }
    const text = await response.text();
    debug(`running awcml fetched from file ${file}`);
    return await executeAwcml(config, text, false);
    debug(`successfully ran awcml fetched from file ${file}`);
  } catch (e) {
    error(`error in awcml file ${path}: ${e}`);
  }
}

function exportConfig() {
  Object.keys(__config).forEach(key => {
    window["$$" + key] = __config[key];
  });
}

async function awcml() {
  try {
    await dynamicallyLoadJs("https://cdn.jsdelivr.net/npm/marked/marked.min.js");
    // Disable processing indents as code blocks; use ``` instead.
    marked.use({
      tokenizer: {
        code() {
        }
      }
    });
    for (const element of document.querySelectorAll(".awcml, script[type='text/awcml']")) {
      log("awcml <" + element.tagName.toLowerCase() + "> element");
      element.innerHTML =
        await executeAwcml(__config, element.innerHTML, element.tagName == "SCRIPT");
    }
    log("exporting awcml config to $$ vars in js");
    exportConfig();
    log("dispatching loadawcml event");
    const event = new Event("loadawcml");
    window.dispatchEvent(event);
  } catch (e) {
    error("error in awcml.js: " + e);
    return null;
  }
}

awcml();
