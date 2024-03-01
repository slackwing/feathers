#!/usr/bin/env wolframscript

SetOptions[$Output, FormatType -> OutputForm];
MyPrint[msg_, arg1_] := Print[StringForm[msg, arg1]];

u = {1, 0};
d = {0, 1};
allPossiblePairsOfCoefficients = Tuples[{1/2, -1/2, I/2, -I/2}, 2]; 
allPossibleChoicesOfPairsForRLOI = Tuples[allPossiblePairsOfCoefficients, 4];

MyPrint[
  "`1` possible combinations of pairs of coefficients for |r>, |l>, |o>, and |i>.",
  Length[allPossibleChoicesOfPairsForRLOI]
];

withOrthogonality = Cases[
  allPossibleChoicesOfPairsForRLOI,
  {r_, l_, o_, i_} /;
    Dot[r, Transpose[l]] == 0 && Dot[o, Transpose[i]] == 0
];

MyPrint[
  "`1` possible combinations where <r|l> = 0 and <o|i> = 0.",
  Length[withOrthogonality]
];

withPerpendicularity = Cases[
  withOrthogonality,
  {r_, l_, o_, i_}/;
    Abs[Dot[u, Transpose[r]]] == 1/2 &&
    Abs[Dot[u, Transpose[l]]] == 1/2 &&
    Abs[Dot[u, Transpose[o]]] == 1/2 &&
    Abs[Dot[u, Transpose[i]]] == 1/2 &&
    Abs[Dot[d, Transpose[r]]] == 1/2 &&
    Abs[Dot[d, Transpose[l]]] == 1/2 &&
    Abs[Dot[d, Transpose[o]]] == 1/2 &&
    Abs[Dot[d, Transpose[i]]] == 1/2 &&
    Abs[Dot[r, Transpose[o]]] == 1/2 &&
    Abs[Dot[r, Transpose[i]]] == 1/2 &&
    Abs[Dot[l, Transpose[o]]] == 1/2 &&
    Abs[Dot[l, Transpose[i]]] == 1/2
];

MyPrint[
  "`1` possible combinations where all perpendicular <X|Y> are 1/2.",
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


(* first = withPerpendicularity[[1]];
Print[Column[first] // OutputForm];
a = first[[1]];
b = first[[2]];
Print[Cross[a,b] // OutputForm];
Print[MatrixRank[{a,b}] // OutputForm]; *)

(* Print[Column[withoutDuplicates] // OutputForm] *)