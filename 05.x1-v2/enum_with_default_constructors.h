//
// Created by Andrew Cheong on 5/8/22.
//

#ifndef INC_05___X1_2_ENUM_WITH_DEFAULT_CONSTRUCTORS_H
#define INC_05___X1_2_ENUM_WITH_DEFAULT_CONSTRUCTORS_H

/// See https://github.com/aantron/better-enums/issues/10.

#define BETTER_ENUMS_DEFAULT_CONSTRUCTOR(Enum) \
  public:                                      \
    Enum() = default;

#include "enum.h"

#endif //INC_05___X1_2_ENUM_WITH_DEFAULT_CONSTRUCTORS_H
