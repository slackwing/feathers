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
    [$.c_section],  // Section may be ambiguous about when to end
    [$.freeform_section],  // Section may be ambiguous about when to end
    [$.date_header_section],  // Section may be ambiguous about when to end
  ],

  rules: {
    // Top-level file structure
    // Parse as sequence of sections, each with its own content model
    source_file: $ => seq(
      optional($.date_header_section),
      repeat($._content),
      optional($.end_marker)
    ),

    // Date header section: date + optional metadata lines
    // This allows initial metadata lines (like [med] ...) before first time block
    date_header_section: $ => seq(
      $.date_header,
      /\n/,
      repeat(choice(
        $.metadata_line,
        $.comment,
        /\n/  // Empty lines
      ))
    ),

    // Content can be sections (with specific grammars) or standalone lines
    _content: $ => choice(
      $.c_section,              // {c} section with c_lines
      $.summary_section,        // {summary} section (already handles its own lines)
      $.freeform_section,       // {freeform} section with metadata_lines
      $._time_tracking_line,    // Default content: time blocks, focus, etc.
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

    // C section: {c} declaration followed by c_lines
    // Section continues until we can't match c_line, comment, or empty line
    c_section: $ => seq(
      '{c}',
      /\n/,
      repeat(choice(
        $.c_line,
        $.comment,
        /\n/  // Empty lines
      ))
    ),

    // Freeform section: {freeform} declaration followed by metadata_lines
    // Section ends when: (1) we hit a new declaration {, or (2) EOF
    freeform_section: $ => prec.left(seq(
      '{freeform}',
      /\n/,
      repeat(choice(
        $.metadata_line,
        $.comment,
        /\n/
      ))
    )),

    // Time tracking lines (default content)
    _time_tracking_line: $ => choice(
      $.focus_declaration,
      $.time_block,
      $.continuation_block,
      $.rest_block,
      $.break_marker,
      $.block_separator,
      $.comment,
      /\n/  // Empty line
    ),

    // Metadata line: [category] [subject] - time
    // Subject is optional (for summary lines)
    // Example: [med] 200b-500v, 100mg moda, 1x cof - 08:15
    // Example: [wr] - 02:08 (summary line, no subject)
    metadata_line: $ => prec(2, seq(
      field('category', $.category),
      choice(
        // With subject: category, space, subject text, space-dash-space, time
        seq(
          /\s+/,
          field('subject', $.metadata_subject),
          /\s+-\s+/,
          field('time', $.time)
        ),
        // Without subject (summary line): category, space-dash-space, time
        seq(
          /\s+-\s+/,
          field('time', $.time)
        )
      ),
      /\n/
    )),

    // Metadata subject: match text up to (but not including) " - HH:MM"
    // Use repeat1 to match character by character, allowing GLR to backtrack
    // Match: any char that's not a newline, and when we hit whitespace+dash, stop
    metadata_subject: $ => repeat1(choice(
      /[^ \t\n-]+/,  // Non-whitespace, non-dash chunks
      /-[^ \t\n]/,   // Dash followed by non-whitespace (e.g., "b-500" in "200b-500v")
      /[ \t]+[^ \t\n-]/  // Whitespace followed by non-whitespace non-dash
    )),

    // End marker: === (everything after is ignored)
    end_marker: $ => seq('===', /[\s\S]*/),

    // Focus declaration: {focus: [cat1], [cat2], ...}
    focus_declaration: $ => seq(
      '{',
      'focus',
      ':',
      optional(/\s+/),
      $.category,
      repeat(seq(',', optional(/\s+/), $.category)),
      '}',
      /\n/
    ),

    // C line: time followed by dash and consumption amount
    // Only appears inside c_section, so no conflict with time_block
    // Structure is exposed for highlighting and parsing
    c_line: $ => seq(
      field('time', $.time),
      '-',
      field('amount', $.c_amount),
      /\n/
    ),

    // C amount: consumption description (free-form text, no brackets)
    // Examples: "1L-", "1L++", "1x alc", "200mg caffeine"
    c_amount: $ => /[^\[\]\n]+/,

    // Summary section: {summary} followed by indented summary_lines
    // Ends when we hit a non-indented line (can't match summary_line anymore)
    summary_section: $ => seq(
      '{summary}',
      /\n/,
      repeat($.summary_line)
    ),

    // Summary line: indented [category] - HH:MM
    summary_line: $ => seq(
      /[ \t]+/,  // Required indentation
      field('category', $.category),
      /\s+-\s+/,
      field('time', $.time),
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

    // Block separator: ,,, (visual marker for every 5 blocks)
    block_separator: $ => seq(',,,', /\n/),

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

    // Blick list: one or more blicks separated by comma + optional space + [category]
    blick_list: $ => seq(
      $.blick,
      repeat(seq(',', optional(/\s+/), $.blick))
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

    // Subject: words with spaces, can include commas, dashes, and most punctuation
    // But NOT brackets (reserved for categories/minutes)
    // Matches up to (but not including): comma+space+bracket, tilde, or bracket
    subject: $ => /[a-zA-Z0-9_\-,'";:!?@#$%^&*()+={}|\\/<>.]+(\s+[a-zA-Z0-9_\-,'";:!?@#$%^&*()+={}|\\/<>.]+)*/,

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
      optional(/[ \t]+/),  // Only spaces/tabs, not newlines
      field('end_time', $.time),
      optional(/[ \t]+/),  // Only spaces/tabs, not newlines
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
