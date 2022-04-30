#include <iostream>
#include <fstream>
#include <string>
#include <sstream>

int main() {
    std::stringstream buf;
    std::ifstream file("clyph.cpp");
    buf << file.rdbuf();
    std::cout << buf.rdbuf();
    return 0;
}
