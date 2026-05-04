enum Color
{
	RED,
	GREEN,
	BLUE
}

enum State {
	Pending=1,
	Active=2,
	Done=3
}

void test() {
	Color c = RED;
	enum { Anonymous, Values=10 };
}