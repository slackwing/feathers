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
    let content = arguments[2] ??= "";
    if (config['__macro__show_more__counter'] === undefined) {
      config['__macro__show_more__counter'] = 0;
    }
    let counter = config['__macro__show_more__counter']++;
    let label_show = "&#8964;";
    let label_hide = "&#8963;";
    return `
<div class="awcml-macro-show-more">
  <input type="checkbox" class="awcml-macro-show-more-toggle" id="awcml-macro-show-more-toggle-${counter}"/>
  <div class="awcml-macro-show-more-hidden">
${content}
  </div>
  <label for="awcml-macro-show-more-toggle-${counter}" class="show">${label_show}</label>
  <label for="awcml-macro-show-more-toggle-${counter}" class="hide">${label_hide}</label>
</div>
`
  }
}
