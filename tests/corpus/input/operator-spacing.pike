// Operator spacing normalization
void test()
{
  // Binary operators - should have spaces on both sides
  int a=1+2;
  int b=3-4;
  int c=5*6;
  int d=7/8;
  int e=10%3;

  // Comparison operators
  bool x=a>0&&b<10;
  bool y=c==5||d!=0;

  // Assignment operators
  int f=10;
  f+=5;
  f-=3;

  // Ternary operator
  int g=a>0?b:c;

  // Comma operator
  int h=(1,2,3);
}
