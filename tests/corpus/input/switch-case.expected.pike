// switch-case.pike — tests switch case/default

void classify(int x) {
  switch(x) {
    case 1:
    write("one\n");
    break;
    case 2:
    case 3:
    write("two or three\n");
    break;
    default:
    write("other\n");
    break;
  }
}

// Nested switch inside case body
void nested_switch(int x, int y) {
  switch(x) {
    case 1:
    switch(y) {
      case 1:
      write("1-1\n");
      break;
      default:
      write("1-other\n");
      break;
    }
    break;
    default:
    write("other\n");
    break;
  }
}

// Switch with case containing block
void case_with_block(int x) {
  switch(x) {
    case 1: {
      int y = x + 1;
      write(y + "\n");
      break;
    }
    default:
    write("default\n");
    break;
  }
}
