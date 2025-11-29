; SXIVA Syntax Highlighting Queries
; See: https://tree-sitter.github.io/tree-sitter/syntax-highlighting

; ============================================================================
; Keywords and Operators
; ============================================================================

"focus" @keyword
"x" @keyword.modifier

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

; Focus declaration delimiters
"{" @punctuation.bracket
"}" @punctuation.bracket

; Break marker
";;;" @keyword.break

; ============================================================================
; Time and Numbers
; ============================================================================

; Time stamps (HH:MM) - using @type for red/orange
(time) @type

; Minute values - use @function for cyan (like points)
(minutes) @function

; Rest block minutes
(rest_minutes) @function

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

; Rest block descriptions - also normal
(rest_description) @none

; ============================================================================
; Comments
; ============================================================================

(comment) @comment

; ============================================================================
; Focus Declarations
; ============================================================================

(focus_declaration) @keyword.focus

; ============================================================================
; Point Notation
; ============================================================================

; Make entire points section cyan (includes all punctuation within)
(points) @function

; ============================================================================
; Special Constructs
; ============================================================================

; Shortened blocks (x-blocks)
(time_block
  shortened: "x" @keyword.shortened)

(continuation_block
  shortened: "x" @keyword.shortened)

; Rest blocks
(rest_block) @constructor.rest

; ============================================================================
; Error Highlighting
; ============================================================================

; Match error nodes from tree-sitter
(ERROR) @error
