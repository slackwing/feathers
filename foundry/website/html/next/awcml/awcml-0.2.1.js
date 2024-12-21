/**
  * Logging
  */
let ___DEBUG = true;
let ___indent = 0;
function indent() { ___indent++; }
function dedent() { if (--___indent < 0) ___indent = 0; }
function debug(msg) { if (___DEBUG) log(msg, "*"); }
function error(msg) { log(msg, "!"); }
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
// https://stackoverflow.com/a/73891404/925913
async function replaceAsync(string, regexp, replacerFunction) {
  const replacements = await Promise.all(
    Array.from(string.matchAll(regexp),
      match => replacerFunction(...match)));
  let i = 0;
  return string.replace(regexp, () => replacements[i++]);
}

/**
  * AWCML
  */
let ___dynamically_loaded_urls = {};
let ___dynamically_loaded_macros = {};
let ___macros = {};
let ___config = {
  "___active_macro": "default",
  "___enum_types": {}, // e.g. {PAGE_TYPE: ["INDEX", "ARTICLE", ...], ..}
  "___enums": {}, // e.g. {PAGE_TYPE.INDEX: true, PAGE_TYPE.ARTICLE: true, ...}
};

// TODO: Learn how to make an actual .js library, e.g. marked.js.
async function awcml(config, text, configOnly = true) {

  if (!text) return;

  log("running awcml.js (begin)");
  let awcmlJsBegun = performance.now();

  const reComment1 = String.raw`^\s*\/\/[^\r\n]*[\r\n]`;
  const reComment2 = String.raw`\/\*.*?\*\/`;
  const reOperator1 = String.raw`([A-Z0-9_]+)\s*\@\@((?:\s*[A-Z0-9_]+\s*(?:\;\;|$))+)`;
  const reOperator2 = String.raw`\{\{(.*?)\}\}`;
  const reOperator3 = String.raw`\[\[(.*?)\]\]`;
  const reOperator4 = String.raw`\<\<(.*?)\>\>`;
  const reOperator5 = String.raw`\~\~(.*?)\~\~`;
  const re = new RegExp(
    reComment1 + "|" +
    reComment2 + "|" +
    reOperator1 + "|" +
    reOperator2 + "|" + 
    reOperator3 + "|" + 
    reOperator4 + "|" +
    reOperator5,
    "smg"
  );

  let asyncInstances = [];

  text = await replaceAsync(text, re, async function (match, op1, args1, op2, op3, op4, op5) {
    if (op1 !== undefined) {
      log("processing @@");
      parseEnum(config, op1, args1);
    } else if (op2 !== undefined) {
      log("processing {{}}");
      parseConfig(config, op2);
      return "";
    } else if (op3 !== undefined && !configOnly) {
      log("processing [[]]");
      return await parseMacro(config, op3, asyncInstances);
    } else if (op4 !== undefined) {
      log("processing <<>>");
      // TODO parseInclude(op4);
    } else if (op5 !== undefined && !configOnly) {
      log("processing ~~~~");
      // TODO parseStyle(op5);
    }
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
    let result = await ___macros[instance.macro]({...config}, ...instance.args);
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
  if (Object.hasOwn(config.___enum_types, type)) {
    error(`enum type ${type} already defined`);
    return;
  }
  config.___enums[type] = enums;
  let value;
  for (value of enums) {
    let qualified = `${type}.${value}`;
    if (Object.hasOwn(config.___enums, qualified)) {
      error(`enum ${qualified} already defined`);
      return;
    }
    config.___enums[qualified] = true;
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
  const captureGroupRight = `(\\s*(?=[${jsonChars}]))`;
  input = input.replace(
      new RegExp(captureGroupLeft + captureGroupMid + captureGroupRight, "g"),
      "$1\"$2\"$3"
  );
  input = input.replace(/,(\s*[\]\}])/g, "$1");
  debug("formalized json:\n" + input);
  try {
    // Parse and shallow-merge, overlaying the existing config.
    debug("parsing json...");
    copyByReference({...config, ...JSON.parse(input)}, config);
  } catch (error) {
    error("error parsing input:\n" + input);
    throw error;
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
  let macro = config.___active_macro;
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
    const result = ___macros[macro]({...config}, ...args);
    debug(`result: ${result}`);
    dedent();
    return result;
  }
  let asyncInstanceId = asyncInstances.length;
  asyncInstances.push({id: asyncInstanceId, macro: macro, args: args});
  dedent();
  return `<span class="awcml-async-macro" id="awcml-async-instance-${asyncInstanceId}"></span>`;
}

function dynamicallyLoadJs(url) {
  if (Object.hasOwn(___dynamically_loaded_urls, url)) {
    return ___dynamically_loaded_urls[url];
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
  ___dynamically_loaded_urls[url] = promise;
  return promise;
}

function dynamicallyLoadMacro(macroName) {
  // A separate cache is necessary in order not to call ___define_macro() for a macro more than
  // once and only once, directly after the Javascript file was (actually) loaded.
  if (Object.hasOwn(___dynamically_loaded_macros, macroName)) {
    return ___dynamically_loaded_macros[macroName];
  }
  log(`dynamically loading macro "${macroName}"`);
  const promise = dynamicallyLoadJs("awcml-macros/macro." + macroName + ".js")
      .then(() => {
        ___macros[macroName] = ___define_macro();
        log(`successfully loaded macro "${macroName}"`);
      })
      .catch(error => {
        delete ___dynamically_loaded_macros[macroName];
        throw error;
      });
  ___dynamically_loaded_macros[macroName] = promise;
  return promise;
}

async function dynamicallyLoadAwcml(config, path) {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`http error; status ${response.status}.`);
    }
    const text = await response.text();
    await awcml(config, text, true);
  } catch (error) {
    error(`error in awcml file ${path}: ${error}`);
  }
}

async function main() {
  try {
    await dynamicallyLoadJs("https://cdn.jsdelivr.net/npm/marked/marked.min.js");
    for (const element of document.querySelectorAll(".awcml, script[type='text/awcml']")) {
      log("awcml <" + element.tagName.toLowerCase() + "> element");
      element.innerHTML = await awcml(___config, element.innerHTML, element.tagName == "SCRIPT");
    }
  } catch (e) {
    error("error in awcml.js: " + e);
    return null;
  }
}

main();
