#!/usr/bin/env wolframscript

SetOptions[$Output, FormatType -> OutputForm];
MyPrint[msg_, arg1_] := Print[StringForm[msg, arg1]];

u = {1, 0};
d = {0, 1};
allPossiblePairsOfCoefficients = Tuples[{1/Sqrt[2], -1/Sqrt[2], I/Sqrt[2], -I/Sqrt[2]}, 2]; 
allPossibleChoicesOfPairsForRLOI = Tuples[allPossiblePairsOfCoefficients, 4];

MyPrint[
  "`1` possible combinations of pairs of coefficients for |r>, |l>, |o>, and |i>.",
  Length[allPossibleChoicesOfPairsForRLOI]
];

withOrthogonality = Cases[
  allPossibleChoicesOfPairsForRLOI,
  {r_, l_, o_, i_} /;
    Dot[Conjugate[r], l] == 0 &&
    Dot[Conjugate[l], r] == 0 &&
    Dot[Conjugate[o], i] == 0 &&
    Dot[Conjugate[i], o] == 0
];

MyPrint[
  "`1` possible combinations where <r|l> = 0, <o|i> = 0, <l|r> = 0, and <i|o> = 0.",
  Length[withOrthogonality]
];

withPerpendicularity = Cases[
  withOrthogonality,
  {r_, l_, o_, i_}/;
    Dot[Conjugate[u], r]Dot[Conjugate[r], u] == 1/2 &&
    Dot[Conjugate[u], l]Dot[Conjugate[l], u] == 1/2 &&
    Dot[Conjugate[u], o]Dot[Conjugate[o], u] == 1/2 &&
    Dot[Conjugate[u], i]Dot[Conjugate[i], u] == 1/2 &&
    Dot[Conjugate[d], r]Dot[Conjugate[r], d] == 1/2 &&
    Dot[Conjugate[d], l]Dot[Conjugate[l], d] == 1/2 &&
    Dot[Conjugate[d], o]Dot[Conjugate[o], d] == 1/2 &&
    Dot[Conjugate[d], i]Dot[Conjugate[i], d] == 1/2 &&
    Dot[Conjugate[r], o]Dot[Conjugate[o], r] == 1/2 &&
    Dot[Conjugate[r], i]Dot[Conjugate[i], r] == 1/2 &&
    Dot[Conjugate[l], o]Dot[Conjugate[o], l] == 1/2 &&
    Dot[Conjugate[l], i]Dot[Conjugate[i], l] == 1/2
];

MyPrint[
  "`1` possible combinations where all perpendicular <X|Y> are 1/Sqrt[2].",
  Length[withPerpendicularity]
];

withoutScalarMultiples = Cases[
  withPerpendicularity,
  {r_, l_, o_, i_} /;
    MatrixRank[{r, l}] != 1 && MatrixRank[{o, i}] != 1
];

MyPrint[
  "`1` possible combinations where |r> and |l>, and |o> and |i>, are not parallel.",
  Length[withoutScalarMultiples]
];

getSpinOperators[r_, l_, o_, i_] :=
  Module[{sx, sy, sz},

    sx = {{sx11, sx12}, {sx21, sx22}};
    sxSolved = Solve[sx.r == r && sx.l == -l, Flatten[sx]];
    sxSolvedMatrix = ArrayReshape[sxSolved[[1, All, 2]], {2, 2}];

    sy = {{sy11, sy12}, {sy21, sy22}};
    sySolved = Solve[sy.o == o && sy.i == -i, Flatten[sy]];
    sySolvedMatrix = ArrayReshape[sySolved[[1, All, 2]], {2, 2}];

    sz = {{sz11, sz12}, {sz21, sz22}};
    szSolved = Solve[sz.u == u && sz.d == -d, Flatten[sz]];
    szSolvedMatrix = ArrayReshape[szSolved[[1, All, 2]], {2, 2}];

    {sxSolvedMatrix, sySolvedMatrix, szSolvedMatrix}
  ];

withoutDuplicates = DeleteDuplicates[
  getSpinOperators @@@ withoutScalarMultiples,
  (Sort[#]===Sort[#2])&
];

Print[TableForm@withoutDuplicates];