// Complex type expressions
void test()
{
  // Parameterized array type
  array(int) int_array;

  // Parameterized mapping type
  mapping(string: int) string_to_int;

  // Union type
  int|string value;

  // Qualified class type
  Stdio.File file;

  // Function return type
  function(int): string converter;

  // Generic function type
  function(mixed...: void) variadic_fn;
}
