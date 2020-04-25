/**
 *  Given an array of elements and grouping function `fn`, return groups of adjacent elements e1,
 *  e1, e2, e3, ... that evaluate to the same fn(e1), fn(e2), fn(e3), ...
 *
 *  For instance, given array [1, 3, 5, 2, 4, 6, 7, 8, 9, 10, 42] and grouping function a => {a % 2}
 *  the expected result would be [[1, 3, 5], [2, 4, 6], [7], [8], [9], [10, 42]].
 */
 
//
//  This solution builds on https://stackoverflow.com/a/26675775/925913, using
//  Array.prototype.reduce to accumulate the subarrays, and a lexicographically
//  scoped `fn_prev` to avoid re-computing the previous `fn(val)`.
//
Object.defineProperty(Array.prototype, 'groupByAdjacent_reduce', {
  value: function(fn) {
    var fn_prev = null;
    return [].concat(this).reduce((acc, val) => {
      let fn_curr = fn(val);
      if (!acc.length || fn_curr !== fn_prev) {
        acc.push([val]);
      } else {
        acc[acc.length - 1].push(val);
      }
      fn_prev = fn_curr;
      return acc;
    }, []);
  }
});

//
//  However, I felt it was more straightforward to write a simple `for` loop.
//
Object.defineProperty(Array.prototype, 'groupByAdjacent', {
  value: function(fn) {
    let fn_prev = null;
    let acc = [];
    for (let val of [].concat(this)) {
      let fn_curr = fn(val);
      if (!acc.length || fn_curr !== fn_prev) {
        acc.push([val]);
      } else {
        acc[acc.length - 1].push(val);
      }
      fn_prev = fn_curr;
    }
    return acc;
  }
});

let x = [1, 3, 5, 2, 4, 6, 7, 8, 9, 10, 42];
console.log(x.groupByAdjacent_reduce(a => { return a % 2; }));
console.log(x.groupByAdjacent(a => { return a % 2; }));
