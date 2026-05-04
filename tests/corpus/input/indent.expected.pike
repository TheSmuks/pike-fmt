void deeply_nested()
{
  if (true) {
    for (int i = 0; i < 10; i++) {
      foreach (({1, 2, 3}); int v;) {
        while (true) {
          do {
            switch (v) {
              case 1: {
                if (true) {
                  write("deep\n");
                }
              }
            }
            break;
          } while (true);
          break;
        }
      }
    }
  }
}
