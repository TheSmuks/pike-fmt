void conditionals(int x)
{
  if(x > 0)
  {
    write("positive\n");
  }else{
    write("non-positive\n");
  }

  for(int i = 0; i < 10; i++)
  {
    write("loop\n");
  }

  while(true)
  {
    break;
  }

  do{
    x--;
  }while(x > 0);

  switch(x)
  {
    case 1:
      write("one\n");
    case 2:
      write("two\n");
    default:
      write("other\n");
  }
}
