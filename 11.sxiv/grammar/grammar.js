/**
 * Tree-sitter grammar for SXIVA (Time-tracking notation language)
 *
 * SXIVA is a language for tracking time in 12-minute blocks divided into
 * 3-minute "blicks" with focus tracking and point/reward calculations.
 *
 * File extension: .sxiva
 * See SPECS.md for complete language specification
 */

module.exports = grammar({
  name: 'sxiva',

  extras: $ => [
    // Whitespace - but NOT in certain contexts
    /[ \t]/,  // Spaces and tabs (not newlines)
  ],

  conflicts: $ => [
    [$.metadata_line, $.time_block],  // Both can start with dash-like patterns
  ],

  rules: {
    // Top-level file structure
    source_file: $ => seq(
      optional(seq($.date_header, /\n/)),
      repeat($._line),
      optional($.end_marker)
    ),

    // Date header: DayOfWeek, Month Day(st/nd/rd/th), Year
    // Example: Saturday, November 29th, 2025
    date_header: $ => seq(
      field('day_of_week', $.day_name),
      ',',
      optional(/\s+/),
      field('month', $.month_name),
      optional(/\s+/),
      field('day', /\d{1,2}(st|nd|rd|th)/),
      ',',
      optional(/\s+/),
      field('year', /\d{4}/)
    ),

    day_name: $ => choice(
      'Sunday', 'Monday', 'Tuesday', 'Wednesday',
      'Thursday', 'Friday', 'Saturday'
    ),

    month_name: $ => choice(
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ),

    _line: $ => choice(
      $.metadata_line,  // Try this first - starts with [category]
      $.focus_declaration,
      $.rest_block,
      $.time_block,
      $.continuation_block,
      $.break_marker,
      $.comment,
      /\n/  // Empty line
    ),

    // Metadata line: [category] subject - time
    // Example: [med] 200b-500v, 100mg moda, 1x cof - 08:15
    metadata_line: $ => prec(2, seq(
      field('category', $.category),
      /\s+/,
      field('subject', $.metadata_subject),
      /\s+/,
      '-',
      /\s+/,
      field('time', $.time),
      /\n/
    )),

    // Metadata subject: match text, allowing internal dashes but structured to stop before " - HH:MM"
    // Strategy: match segments separated by single spaces or commas, with internal dashes allowed
    metadata_subject: $ => /[a-zA-Z0-9]([a-zA-Z0-9_,\-'";:!?@#$%^&*()+={}|\\/<>.]|(\s+[a-zA-Z0-9_,\-'";:!?@#$%^&*()+={}|\\/<>.]))*/ ,

    // End marker: === (everything after is ignored)
    end_marker: $ => seq('===', /[\s\S]*/),

    // Focus declaration: {focus: [cat1], [cat2], ...}
    focus_declaration: $ => seq(
      '{',
      'focus',
      ':',
      $.category,
      repeat(seq(',', optional(/\s+/), $.category)),
      '}',
      /\n/
    ),

    // Rest block: [...] (description) [minutes]
    rest_block: $ => seq(
      '[...]',
      optional(/\s+/),
      '(',
      field('description', $.rest_description),
      ')',
      optional(/\s+/),
      field('minutes', $.rest_minutes),
      /\n/
    ),

    rest_description: $ => /[^)]+/,
    rest_minutes: $ => /\[\d+\]/,  // [duration] in minutes, should be multiple of 12

    // Break marker: ;;;
    break_marker: $ => seq(';;;', /\n/),

    // Comment lines (starting with #)
    comment: $ => seq(/#[^\n]*/, /\n/),

    // Time block: [x]HH:MM - blick_list terminator
    time_block: $ => seq(
      field('shortened', optional('x')),
      field('start_time', $.time),
      optional(/\s+/),
      '-',
      optional(/\s+/),
      field('blicks', $.blick_list),
      optional(/\s+/),
      field('terminator', $.terminator),
      /\n/
    ),

    // Continuation block: [x]HH:MM + blick_list terminator
    continuation_block: $ => seq(
      field('shortened', optional('x')),
      field('start_time', $.time),
      optional(/\s+/),
      '+',
      optional(/\s+/),
      field('blicks', $.blick_list),
      optional(/\s+/),
      field('terminator', $.terminator),
      /\n/
    ),

    // Time: HH:MM
    time: $ => /([0-1][0-9]|2[0-3]):[0-5][0-9]/,

    // Blick list: one or more blicks separated by comma
    blick_list: $ => seq(
      $.blick,
      repeat(seq(',', $.blick))
    ),

    // Blick: [category] subject [~][minutes] OR [category] subject ~
    blick: $ => seq(
      field('category', $.category),
      field('subject', $.subject),
      choice(
        // With minutes (optional tilde)
        seq(optional(field('tilde', '~')), field('minutes', $.minutes)),
        // Just tilde for omitted [10]
        field('tilde', '~')
      )
    ),

    // Category: [content]
    category: $ => seq('[', /[^\[\]]+/, ']'),

    // Subject: words with spaces, can include dashes and most punctuation
    // But NOT commas (separator) or brackets (reserved)
    subject: $ => /[a-zA-Z0-9_\-'";:!?@#$%^&*()+={}|\\/<>.]+(\s+[a-zA-Z0-9_\-'";:!?@#$%^&*()+={}|\\/<>.]+)*/,

    // Minutes: [3], [6], [10], or [13]
    minutes: $ => choice(
      '[3]',
      '[6]',
      '[10]',
      '[13]'
    ),

    // Terminator: end_term OR continuation_marker
    terminator: $ => choice(
      $.end_term,
      $.continuation_marker
    ),

    // End terminator: triple_dash time points
    end_term: $ => seq(
      $.triple_dash,
      optional(/\s+/),
      field('end_time', $.time),
      optional(/\s+/),
      field('points', optional($.points))
    ),

    // Continuation marker: [~]+
    continuation_marker: $ => seq(optional('~'), '+'),

    // Triple dash variants: ---, <--, >--, -<-, ->-
    triple_dash: $ => choice(
      '---',
      '<--',
      '>--',
      '-<-',
      '->-'
    ),

    // Points: ( [point_list] [=total] [)]
    points: $ => seq(
      '(',
      optional($.point_list),
      optional(seq('=', $.point_total)),
      optional(')')
    ),

    point_list: $ => seq(
      $.point,
      repeat(seq(',', optional(/\s+/), $.point))
    ),

    point: $ => seq(
      field('sign', optional(choice('+', '-'))),
      field('value', /\d+/),
      field('type', optional(choice('f', 'a')))
    ),

    point_total: $ => seq(
      optional(choice('+', '-')),
      /\d+/
    ),
  }
});
