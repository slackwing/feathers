/**
  * This is a default macro that simply replaces a macro with a comment, to demonstrate macros.
  *
  * To define a macro, define a ___define_macro() function that returns an anonymous function to be
  * called whenever the macro is encountered.
  *
  *   - The first argument will always be the config object, which is a copy when passed to a
  *     macro. (You can directly access ___config if you need the global config.) We recommend the
  *     given style—using the special Javascript variable `arguments`—so that it's easier to
  *     remember to provide default values.
  *   - Return the Markdown/HTML/text that the macro should be replaced with.
  *   - If you are calling the macro asynchronously, i.e. via [[>> ... ]], then you must also make
  *     the anonymous function async, as hinted in a comment below.
  *
  */
function __define_macro() {
  return /* async */ function() {
    let config = arguments[0] ??= {};
    let url = arguments[1] ??= "placeholder.png";
    let width = arguments[2] ??= "640";
    let caption = arguments[3] ??= "";
    if (caption !== "") {
      caption = `<p style="margin: 0; font-size: 1rem; width: ${width}px;"><span>${caption}</span></p>`;
    }
    return `<center><img src="/.staging/shared/assets/${url}" style="width: ${width}px;"/>${caption}</center>`;
  }
}
