// Lambda expressions
function f = lambda(int x) { return x + 1; };

// Arrow lambda
array arr = ({});
sort(arr, lambda(int a, int b) { return a > b; });

// Typed lambda
function(int, int : int) cmp = lambda(int a, int b) { return a - b; };
