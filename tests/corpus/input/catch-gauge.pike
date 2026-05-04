// Catch and gauge expressions
void test()
{
  // Catch expression
  mixed result = catch {
    // This code will fail
    error("oops");
  };

  // Gauge expression
  float elapsed = gauge {
    // Code to measure
    for (int i = 0; i < 1000; i++) {
      // work
    }
  };
}