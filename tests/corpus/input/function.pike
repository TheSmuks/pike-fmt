void foo()
{
	return 42;
}

int bar(int x, int y)
{
	int sum = x + y;
	return sum;
}

void local_func()
{
	void inner()
	{
		write("nested\n");
	}
	inner();
}
