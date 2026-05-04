// nested-closure.pike — deeply nested closures

// Lambda returning lambda (double };)
function(int:function(int:int)) make_adder(int base) {
  return lambda(int offset) {
    return lambda(int x) {
      return x + base + offset;
    };
  };
}

// Catch inside gauge
float timed_safe() {
  return gauge {
    mixed r = catch {
      if(something) {
        error("boom");
      }
    };
    write("done\n");
  };
}

// Lambda inside class body
class Handler {
  function callback = lambda(mixed data) {
    if(mappingp(data)) {
      foreach(indices(data), string key) {
        write(key + ": " + data[key] + "\n");
      }
    }
  };

  void process(mixed data) {
    callback(data);
  }
}

// Lambda inside catch inside foreach
void complex() {
  foreach(({"a", "b", "c"}), string s) {
    mixed r = catch {
      function f = lambda() {
        write(s + "\n");
      };
      f();
    };
    if(r) write("error for " + s + "\n");
  }
}