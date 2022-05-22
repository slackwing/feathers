cmake_minimum_required(VERSION 3.22)
project(05___X1_2)

set(CMAKE_CXX_STANDARD 20)
# set(CMAKE_CXX_COMPILER /usr/local/clang_14.0.0/bin/clang++)

# set(CMAKE_CXX_FLAGS "-I /usr/local/opt/openssl@1.1/include/")

add_executable(05___X1_2 main.cpp authorized_rest_client.cpp authorized_rest_client.h authorized_rest_client_config.h markdown_table_scanner.h enum.h enum_with_default_constructors.h base64.cpp base64.h)

# first had to do `brew install boost`
include_directories("/usr/local/opt/boost@1.78/include")
set(Boost_USE_STATIC_LIBS OFF)
set(Boost_USE_MULTITHREADED ON)
set(Boost_USE_STATIC_RUNTIME OFF)
find_package(Boost 1.78.0 COMPONENTS iostreams)
if(Boost_FOUND)
    target_link_libraries(05___X1_2 PRIVATE Boost::iostreams)
endif()

# from https://github.com/libcpr/cpr
include(FetchContent)
FetchContent_Declare(
        cpr GIT_REPOSITORY https://github.com/libcpr/cpr.git
        GIT_TAG db351ffbbadc6c4e9239daaa26e9aefa9f0ec82d) # 1.8.3
FetchContent_MakeAvailable(cpr)
target_link_libraries(05___X1_2 PRIVATE cpr::cpr)

# first had to do `brew install openssl`
# not sure why target_compile_definitions wouldn't work
# target_compile_definitions(x1 PUBLIC OPENSSL_ROOT_DIR="/usr/local/opt/openssl")
# target_compile_definitions(x1 PUBLIC OPENSSL_CRYPTO_LIBRARY="/usr/local/opt/openssl/lib")
# target_compile_definitions(x1 PUBLIC OPENSSL_INCLUDE_DIR="/usr/local/opt/openssl/include")
set(OPENSSL_ROOT_DIR "/usr/local/opt/openssl")
set(OPENSSL_CRYPTO_LIBRARY "/usr/local/opt/openssl/lib/libcrypto.dylib")
set(OPENSSL_INCLUDE_DIR "/usr/local/opt/openssl/include")
find_package(OpenSSL REQUIRED)
target_link_libraries(05___X1_2 PRIVATE OpenSSL::SSL)
