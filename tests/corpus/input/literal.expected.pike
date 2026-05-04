void test()
{
  // Array literals - no indentation inside
  mixed arr = ({ 1, 2, ({ 3, 4 }) });

  // Mapping literals
  mapping m = ([ "key": "value", "nested": ([ "a": 1 ]) ]);

  // Multiset literals
  multiset ms = (< "foo", "bar", "baz" >);

  // Nested mixed
  mixed complex = ({ ([ "arr": ({ 1, 2 }) ]), ([ (< 1, 2 >) ]) });
  }
