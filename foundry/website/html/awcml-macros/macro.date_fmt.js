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
    let YYYY_MM_DD = arguments[1] ??= "2024-12-31";
    console.log(YYYY_MM_DD);
    return formatDate(YYYY_MM_DD);
  }
}

// via ChatGPT
function formatDate(isoString) {
  const date = new Date(isoString);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const year = date.getFullYear();
  const month = months[date.getMonth()];
  const day = date.getDate();
  function getOrdinalSuffix(d) {
    if (d >= 11 && d <= 13) {
      return 'th';
    }
    switch (d % 10) {
      case 1:
        return 'st';
      case 2:
        return 'nd';
      case 3:
        return 'rd';
      default:
        return 'th';
    }
  }
  return `${year} ${month} ${day}`;
  // return `${year} ${month} ${day}${getOrdinalSuffix(day)}`;
}
