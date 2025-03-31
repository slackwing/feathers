#include <iostream>
#include <vector>
#include <map>
#include <fstream>
#include <sstream>

static const long INIT_SIZE = 1024;

static long T = 0;

template <class X> class Tape {
public:
    Tape(): forward_(INIT_SIZE), reverse_(1), lbound_(0), rbound_(0) {}
    X& operator[](long i) {
        const long absolute_time = T + i;
        touch(absolute_time);
        if (rbound_ <= absolute_time) rbound_ = absolute_time + 1;
        if (lbound_ >= absolute_time) lbound_ = absolute_time - 1;
        return absolute_time >= 0 ? forward_[absolute_time] : reverse_[absolute_time];
    }
    // Note that this overload returns by value not by reference.
    X operator[](long i) const {
        const long absolute_time = T + i;
        touch(absolute_time);
        return absolute_time >= 0 ? forward_[absolute_time] : reverse_[absolute_time];
    }
    long lbound() { return lbound_; }
    long rbound() { return rbound_; }
private:
    // This is not truly const since we're resizing vectors, but that's exactly what we mean to hide from the developer.
    // So we are const_cast'ing by design here.
    void touch(long absolute_time) const {
        if (absolute_time >= 0) {
            const long overflow_time = absolute_time - static_cast<long>(forward_.size());
            if (overflow_time >= 0) {
                const long new_size = std::max((absolute_time + overflow_time) * 2, INIT_SIZE);
                const_cast<std::vector<X>*>(&forward_)->resize(new_size, 0);
            }
        } else {
            const long underflow_time = absolute_time + static_cast<long>(reverse_.size());
            if (underflow_time <= 0) {
                const long new_size = std::abs(std::min((absolute_time + underflow_time) * 2, -INIT_SIZE));
                const_cast<std::vector<X>*>(&reverse_)->resize(new_size, 0);
            }
        }
    }
    std::vector<X> forward_;
    std::vector<X> reverse_; // reverse_[0] is never used; it represents the same as forward_[0].
    long lbound_;
    long rbound_;
};

template <class X> class Series {
public:
    X min(int w) const { return 43; }
    X max(int w) const { return 43; }
    // Enables LHS syntax `X = ...` to mean `X[0] = ...`
    Series& operator=(double val) {
        data_[0] = val;
        return *this; // Overloading `=` operator requires returning the class type.
    }
    // Enables LHS syntax `X[i] = ...` to mean `X[i] = ...`.
    X& operator[](int i) {
        // TODO: T-i < 0
        // TODO: also generate()?
        return data_[i];
    }
    // Intentionally not explicit. Enables RHS syntax that casts X to X[0].
    operator X() const {
        X val = data_[0];
        return val;
    }
    X min(int w) const {
        
    }
// Cool but no use since operator= overload.
//    double& operator+() {
//        return data_[0];
//    };
protected:
    Tape<X> data_;
    std::map<int, Tape<X>> min_;
    std::map<int, Tape<X>> max_;
};

class FastStochastic : public Series {
public:
    FastStochastic(int w) {
        w_ = w;
    }
    void generator(Series const &H, Series const &L, Series const &C, Series K) const {
        K = (C - L.min(w_)) / (H.max(w_) - L.min(w_));
    }
protected:
    int w_;
};

void loadOHLCV(std::string filepath, Series &O, Series &H, Series &L, Series &C, Series &V) {
    std::ifstream filestream(filepath);
    std::string row;
    std::string cell;
    if (filestream.is_open()) {
        while (std::getline(filestream, row)) {
            std::istringstream iss(row);
            std::getline(iss, cell, ','); // Skip time for now.
            std::getline(iss, cell, ','); +O = strtod(cell.c_str(), nullptr);
            std::getline(iss, cell, ','); +H = strtod(cell.c_str(), nullptr);
            std::getline(iss, cell, ','); +L = strtod(cell.c_str(), nullptr);
            std::getline(iss, cell, ','); +C = strtod(cell.c_str(), nullptr);
            std::getline(iss, cell, ','); +V = strtod(cell.c_str(), nullptr);
            T++;
        }
    }
}

int main() {
    Series O;
    Series H;
    Series L;
    Series C;
    Series V;
    loadOHLCV("../../07 - X1_3/btc-usd-1d", O, H, L, C, V);
    std::cout << T << std::endl;
    std::cout << C[-4] << std::endl;
    return 0;
}

/**
 * Learn:
 *      explicit
 *      const
 */