// closure.pike — tests }-semicolon handling

// Lambda with block body
function(int:int) f = lambda(int x) {
  return x * 2;
};

// Lambda inside a function call (nested expression context)
array a = ({1, 3, 2});
sort(a, lambda(int a, int b) {
  return a > b;
});

// Catch expression
mixed result = catch {
  if(x > 0) {
    write("positive\n");
  }
};

// Gauge expression
float elapsed = gauge {
  for(int i = 0; i < 1000; i++) {
    write(i + "\n");
  }
};

// Local function declaration (at top level)
local void helper(int n) {
  if(n > 0) {
    write(n + "\n");
  }
};
