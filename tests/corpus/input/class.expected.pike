class Outer
{
  int foo;
  string bar = "hello";

  class Inner
  {
    int x;

    void create()
    {
      x = 42;
    }
  }

  void method()
  {
    Inner i = Inner();
    foo = i.x;
  }
}
