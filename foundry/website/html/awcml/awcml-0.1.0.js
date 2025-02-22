let ___dynamically_loaded_urls = {};
let ___dynamically_loaded_macros = {};
let ___enums = {};
let ___config = {};
let ___macros = {};
let ___unevaluated_macros = [];

// TODO: Figure out a logging strategy.
function log(msg) {
  console.log("[awcml] " + msg.replace(/\n/g, "\n>>> "));
}

// TODO: Learn how to make an actual .js library, e.g. marked.js.
function awcml(innerHTML, configOnly = true) {

  if (!innerHTML) return;

  let processingBegun = performance.now();

  let processedHTML = innerHTML;

  // TODO: Process // and /* ... */ comments.
  
  // Process ... @@ ... as AWCML enums.
  processedHTML = processedHTML.replace(
      /([A-Z0-9_]+)[ \t]*@@[ \t]*([\w-]+)/g,
      function (match, name, value) {
        log("Found an ... @@ ... enum: \n" + match);
        log(`Defining enum ${name} with value=<${value}>...`);
        ___enums[name] = value;
        return "";
      });
  // Process all enums.
  for (const [name, value] of Object.entries(___enums)) {
    log(`Replacing all instances of enum ${name} with value=<${value}>...`);
    processedHTML = processedHTML.replace(name, value);
  }
  log("Processed enums successfully.");

  // Process {{ ... }} as JSON configs.
  processedHTML = processedHTML.replace(
      /{{\s*(.*?)\s*}}/sg,
      function (match, json) {
        log("Found a {{ ... }} JSON config: \n" + match);
        // Quick-n-dirty formalization of JSON.
        log("Formalizing JSON...");
        // Surround with braces.
        json = '{' + json + '}';
        // Quote unquoted words. (Skip any string containing numbers or whitespace.)
        const jsonChars = "\\{\\}\\[\\]:,";
        const quoteChars = "'\"";
        const skipChars = "\\s0-9";
        const captureGroupLeft = `(\\s*[${jsonChars}\\s]*)`;
        const captureGroupMid = `([^${jsonChars}${quoteChars}${skipChars}]+)`;
        const captureGroupRight = `(\\s*(?=[${jsonChars}]))`;
        json = json.replace(
            new RegExp(captureGroupLeft + captureGroupMid + captureGroupRight, "g"),
            "$1\"$2\"$3"
        );
        // json = json.replace(/([:,\[\]\{\}]\s*)([^"':,\[\]\{\}\s0-9]+)(\s*(?=[:,\[\]\{\}]))/g, "$1\"$2\"$3");
        // Strip hanging commas.
        json = json.replace(/,(\s*[\]\}])/g, "$1");
        log("Formalized JSON: \n" + json);
        // Parse and shallow-merge, overlaying the existing config.
        log("Parsing config...");
        ___config = {...___config, ...JSON.parse(json)};
        //try {
        //  ___config = {...___config, ...JSON.parse(json)};
        //} catch (error) {
        //  if (error instanceof SyntaxError) {
        //    if (error.message.includes("after property value in JSON at position")) {
        //      let position = parseInt(error.message.match(/position (\d+)/)[1]);
        //      let row = 1;
        //      let last_row_position = 0;
        //      for (let i = 0; i < position; i++) {
        //        if (json[i] == '\n') {
        //          row++;
        //          last_row_position = i;
        //        }
        //      }
        //      let col = position - last_row_position;
        //      let line = json.split('\n')[row - 1];
        //      error.message += ` (row ${row}, col ${col} of text: "${line}")`;
        //    }
        //  }
        //  throw error;
        //}
        return "";
      });
  log("Processed configs successfully.");

  if (configOnly) return;

  let defaultMacroName = "default";
  if (Object.hasOwn(___config, "awcml_active_macro")) {
    defaultMacroName = ___config.awcml_active_macro;
  }

  // Process [[>> ... ]] as async "with()" macros.
  processedHTML = processedHTML.replace(
      /\[\[(?:>>|&gt;&gt;)\s*(.*?)\s*\]\]/g,
      function (match, macro) {
        let macroName = defaultMacroName;
        macro = macro.replace(/^([a-zA-Z0-9-]+)\s*::/, function (match, name) {
          macroName = name;
          return "";
        });
        macroArgs = macro.split(/\s*;;\s*/);
        let macroInstanceId = ___unevaluated_macros.length;
        ___unevaluated_macros.push({id: macroInstanceId, name: macroName, args: macroArgs});
        log(`Found and prepared a macro "${macroName}" with arguments [${macroArgs.join(", ")}] for evaluation.`);
        return `<span
          class="awcml-macro-unevaluated"
          id="awcml-macro-unevaluated-instance-${macroInstanceId}"
        ></span>`;
      }
  );

  let promises = ___unevaluated_macros.map(async (unevaluated) => {
    // Store the promise so it can be returned later as well so we can do a Promise.all().
    const promise = dynamicallyLoadMacro(unevaluated.name);
    await promise;
    log(`Evaluating macro instance ${unevaluated.id} of macro "${unevaluated.name}" ` +
        `with arguments [${unevaluated.args.join(", ")}]...`);
    let result = await ___macros[unevaluated.name](...unevaluated.args);
    let placeholder =
        document.getElementById("awcml-macro-unevaluated-instance-" + unevaluated.id);
    placeholder.outerHTML = result;
    return promise;
  });

  // For sake of accurately timing the final operation, whether that is (1) all macros being
  // evaluated or (2) the rest of this script, the rest of this function is wrapped in a promise as
  // well.

  promises.push(new Promise((resolve, reject) => {
    log("Running marked.js on HTML...");
    processedHTML = marked.parse(processedHTML);
    log("Completed running marked.js on HTML.");
    resolve();
  }));

  Promise.all(promises).then(() => {
    let processingEnded = performance.now();
    log(`*** AWCML elem took ${(processingEnded - processingBegun).toFixed(2)}ms to process. ***`);
  });

  return processedHTML; // With placeholders for macros, to be processed async.
}

function dynamicallyLoadJs(url) {
  if (Object.hasOwn(___dynamically_loaded_urls, url)) {
    return ___dynamically_loaded_urls[url];
  }
  const promise = new Promise((resolve, reject) => {
    let script = document.createElement('script');
    script.onload = function() {
      log(`Successfully loaded ${url}.`);
      resolve();
    }
    script.src = url;
    document.head.appendChild(script);
    log(`Dynamically loading ${url}...`);
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
  log(`Dynamically loading macro "${macroName}"...`);
  const promise = dynamicallyLoadJs("awcml-macros/macro." + macroName + ".js")
      .then(() => {
        ___macros[macroName] = ___define_macro();
        log(`Successfully loaded macro "${macroName}".`);
      })
      .catch(error => {
        delete ___dynamically_loaded_macros[macroName];
        throw error;
      });
  ___dynamically_loaded_macros[macroName] = promise;
  return promise;
}

async function dynamicallyLoadAwcml(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`HTTP error; status ${response.status}.`);
    }
    const text = await response.text();
    awcml(text, true);
  } catch (error) {
    log(`Error during fetching or processing AWCML file ${path}: ${error}`);
  }
}

async function main() {
  try {
    await dynamicallyLoadJs("https://cdn.jsdelivr.net/npm/marked/marked.min.js");
    document.querySelectorAll(".awcml, script[type='text/awcml']").forEach(function (element) {
      log("Found an AWCML <" + element.tagName.toLowerCase() + "> element .");
      element.innerHTML = awcml(element.innerHTML, element.tagName == "SCRIPT");
    });
  } catch (error) {
    log("Error in main(): " + error);
    return null;
  }
}

main();
