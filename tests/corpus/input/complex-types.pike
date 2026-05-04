// Complex types
array(int) int_array;
mapping(string:int) string_to_int;
function(int:int) int_to_int_fn;
object(Program) program_obj;
array(mapping(string:array(int))) nested;

// Function types with modifiers
function(:void) void_fn;
function(int, string : bool) mixed_fn;
