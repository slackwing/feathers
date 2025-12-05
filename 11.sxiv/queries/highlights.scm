; SXIVA Syntax Highlighting Queries
; See: https://tree-sitter.github.io/tree-sitter/syntax-highlighting

; ============================================================================
; Keywords and Operators
; ============================================================================

"focus" @keyword

; Block markers - also muted gray
"---" @comment.separator
"<--" @comment.separator
">--" @comment.separator
"-<-" @comment.separator
"->-" @comment.separator

; Separators - use @comment for gray/muted appearance
"," @comment.separator
"-" @comment.separator
"+" @comment.separator
"~" @string

; Focus declaration delimiters - make them purple like the keywords
(focus_declaration
  "{" @keyword.focus
  "}" @keyword.focus)

; Break marker
";;;" @keyword.break

; Block separator - muted gray like other separators
",,," @comment.separator

; End marker - everything after === is not highlighted
"===" @keyword.break

; ============================================================================
; Date Header
; ============================================================================

; Date header - bright yellow and bold
(date_header) @constant.builtin

; ============================================================================
; Time and Numbers
; ============================================================================

; Time stamps (HH:MM) - using @type for red/orange
(time) @type

; Minute values - use @string for green (like categories)
(minutes) @string

; Rest block minutes
(rest_minutes) @string

; Point values and totals - use @function for cyan
(point) @function

(point_total) @function

; ============================================================================
; Categories
; ============================================================================

; Specific categories (checked first for precedence)
; Using @string for categories to get green color
((category) @string.rest
  (#eq? @string.rest "[...]"))

((category) @string.special
  (#eq? @string.special "[err]"))

((category) @string.special
  (#eq? @string.special "[wr]"))

((category) @string.special
  (#match? @string.special "^\\[sp/"))

; Default category highlighting - use @string for green (includes brackets)
(category) @string

; ============================================================================
; Text Content
; ============================================================================

; Subject text (task descriptions) - use @none for normal text
(subject) @none

; Metadata subject text - same as blick subject (normal/grayish)
(metadata_subject) @none

; Rest block descriptions - also normal
(rest_description) @none

; Metadata line components - highlight like time blocks
(metadata_line
  (category) @string      ; Green like other categories
  (time) @type)           ; Red/orange like other times

; ============================================================================
; Comments
; ============================================================================

(comment) @comment

; ============================================================================
; Focus and Summary Declarations
; ============================================================================

; Make the entire {focus: ...} declaration purple/bold
(focus_declaration) @keyword.focus

; Section declarations
(c_section "{c}" @keyword.focus)
(summary_section "{summary}" @keyword.focus)
(freeform_section "{freeform}" @keyword.focus)

; C line components - highlight time like other times
(c_line
  (time) @type)
(c_amount) @none

; ============================================================================
; Point Notation
; ============================================================================

; Make entire points section cyan (includes all punctuation within)
(points) @function

; ============================================================================
; Special Constructs
; ============================================================================

; Shortened blocks (x-blocks) - color x same as time (red/orange)
; Only highlight x when it's in the shortened field (not random x in ERROR nodes)
((time_block
  shortened: "x" @type))

((continuation_block
  shortened: "x" @type))

; Rest blocks
(rest_block) @constructor.rest

; ============================================================================
; Error Highlighting (Optional - for invalid syntax)
; ============================================================================

; You can add error patterns here if needed
; (ERROR) @error
