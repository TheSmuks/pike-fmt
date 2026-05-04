// Edge cases for Pike formatting

// Single character lines
a;

// Very long lines - should stay as-is (no wrapping)
string very_long_variable_name = "this is a very long string that tests how the formatter handles very long lines without wrapping";


// Mixed quote types
string s1 = "double quoted";
string s2 = 'single quoted';
string s3 = "with \\\"escaped\\\" quotes";
string s4 = "with \\\\ backslash at end\\";


// Strings with special characters
string tab_string = "a\tb";
string newline_string = "a\nb";
string mixed_string = "tabs\there\nand\there";


// Empty class
class Empty {}


// Class with only comments
class CommentOnly {
  // Just a comment
}


// Multiple blank lines between declarations
int x = 1;


int y = 2;


// Preprocessor directives at various positions
#ifdef DEBUG
int debug_mode = 1;
#endif

// Nested ternary expressions
int ternary = a ? b ? c : d : e;
