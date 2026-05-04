// Lambda expressions
void test()
{
  // Function type declaration (takes two ints, returns int)
  function(int, int : int) callback;

  // Lambda with block body
  callback = lambda(int x, int y) { return x + y; };
}
