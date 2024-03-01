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

Print[Column[withPerpendicularity[[1234]]] // OutputForm]

(* first = withOrthogonality[[500]]; *)
(* Print[Column[first] // OutputForm]; *)
(* Print[first[[3]] // OutputForm]; *)
(* Print[Conjugate[first[[3]]] // OutputForm]; *)
(* Print["*****************************"]; *)
(* R = {1/Sqrt[2], 1/Sqrt[2]}; *)
(* L = {1/Sqrt[2], -1/Sqrt[2]}; *)
(* P = {1/Sqrt[2], I/Sqrt[2]}; *)
(* J = {1/Sqrt[2], -I/Sqrt[2]}; *)
(* Print[Dot[Conjugate[u], R]Dot[Conjugate[R], u] // OutputForm]; *)
(* Print[Dot[Conjugate[u], L]Dot[Conjugate[L], u] // OutputForm]; *)
(* Print[Dot[Conjugate[u], P]Dot[Conjugate[P], u] // OutputForm]; *)
(* Print[Dot[Conjugate[u], J]Dot[Conjugate[J], u] // OutputForm]; *)
(* Print[Dot[Conjugate[d], R]Dot[Conjugate[R], d] // OutputForm]; *)
(* Print[Dot[Conjugate[d], L]Dot[Conjugate[L], d] // OutputForm]; *)
(* Print[Dot[Conjugate[d], P]Dot[Conjugate[P], d] // OutputForm]; *)
(* Print[Dot[Conjugate[d], J]Dot[Conjugate[J], d] // OutputForm]; *)
(* Print[Dot[Conjugate[R], P]Dot[Conjugate[P], R] // OutputForm]; *)
(* Print[Dot[Conjugate[R], J]Dot[Conjugate[J], R] // OutputForm]; *)
(* Print[Dot[Conjugate[L], P]Dot[Conjugate[P], L] // OutputForm]; *)
(* Print[Dot[Conjugate[L], J]Dot[Conjugate[J], L] // OutputForm]; *)

(* first = withPerpendicularity[[1]];
Print[Column[first] // OutputForm];
a = first[[1]];
b = first[[2]];
Print[Cross[a,b] // OutputForm];
Print[MatrixRank[{a,b}] // OutputForm]; *)

(* Print[Column[withoutDuplicates] // OutputForm] *)