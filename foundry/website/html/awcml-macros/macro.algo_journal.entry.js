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
    let date = arguments[1] ??= "1987-11-29";
    let letter = arguments[2] ??= "";
    if (letter !== "") {
      letter = `<div class="colored-band-mint">${letter}</div>`;
    }
    return `<h2>${formatDate(date)}</h2>${letter}`;
  }
}

// via ChatGPT
function formatDate(isoString) {
  // https://stackoverflow.com/a/563442/925913
  Date.prototype.addDays = function(days) {
    var date = new Date(this.valueOf());
    date.setDate(date.getDate() + days);
    return date;
  }
  const date = new Date(isoString).addDays(1); // Not sure why this is needed.
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const year = date.getFullYear();
  const month = months[date.getMonth()];
  const day = date.getDate();
  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
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
  return `${dayOfWeek}, ${month} ${day}${getOrdinalSuffix(day)}, ${year}`;
}
