/**
 *  This function analyzes another function representing a 16-bit LCG ("linear
 *  congruential generator"). Which is simply a function with the form,
 *  f(x) = (ax + c) mod 2^16. Super Metroid's RNG, for example, is
 *  f(x) = (5x + 273) mod 2^16 (although in a handful of cases it actually adds
 *  274, making it not truly an LCG).
 *  
 *  The analysis is based on looking at the LCG function as a directed graph.
 *  Each number x is a node, and its successor, i.e. f(x), is the next node that
 *  it points to. For example, 0 -> 273 -> 1638 -> 8463 -> 42588 -> 16605.
 *  
 *  It considers each number a "node" in a directed graph described by calling
 *  the LCG function on itself, e.g. x -> f(x) -> f(f(x)) -> f(f(f(x))) -> ...
 *  
 *  The function returns an object with various results of the analysis, mostly
 *  Map objects but some Arrays.
 * 
 *    analysis.next.get(x)          Given x, return the next random number, i.e.
 *                                  lcg_fn(x).
 * 
 *    analysis.prev.get(x)          Given x, return the previous random number.
 *                                  This could sometimes be 2 different numbers
 *                                  because of the modulo operation, e.g. both
 *                                  9 and 13116 map to 318 in Super Metroid.
 *                                  
 *    analysis.junction_nodes       Nodes that "junctions". This is related to
 *                                  `prev`. Any nodes that do have more than 1
 *                                  previous value 
 * 
 *    analysis.junctions_in_cycles    d
 * 
 *  
 * 
 * 
  analysis["node_to_cycle"] = node_to_cycle;
  analysis["cycles"] = cycles;
  analysis["cycle_sizes"] = cycle_sizes;
  analysis["junctions_in_cycles"] = junctions_in_cycles;
  analysis["junctions_in_tails"] = junctions_in_tails;
  analysis["special_nodes"] = special_nodes;
  analysis["leaf_nodes"] = leaf_nodes;
  analysis["key_nodes"] = key_nodes;
  analysis["is_special_node"] = is_special_node;
  analysis["is_key_node"] = is_key_node;
  analysis["edges"] = edges;
  analysis["edge_nodes"] = edge_nodes;
  analysis["edge_sizes"] = edge_sizes;
 * 
 * 
 */


// write("Found " + cycles.length + " cycles.");
// for (c of cycles) {
//     write("  - 'C" + c + "' with " + cycle_sizes.get(c) + " nodes.");
// }

// write("Nodes that are junctions: "
// + junction_nodes.length
// + " ("
// + junctions_in_cycles.length
// + " in cycles, "
// + junctions_in_tails.length
// + " not in cycles)");

// write("Nodes that are leafs: " + leaf_nodes.length);
// write("Nodes that are special nodes: " + special_nodes.length);
// write("Nodes that are cycle start nodes: " + cycles.length);
// write("Nodes that are key nodes: " + key_nodes.length);

        // write("Edges: " + edges.length);
        // write("Edges:\n" + edges.join(", "));


function analyze_lcg(lcg_fn) {

  let analysis = new Object();

  __compute_next_and_prev(analysis, lcg_fn);

  __find_cycles(analysis);

  __find_junction_and_leaf_nodes(analysis);

  analysis.special_nodes = [0x61, 0x11, 0x25, 0x17];

  analysis.key_nodes = [];
  analysis.key_nodes.push(...analysis.junction_nodes);
  analysis.key_nodes.push(...analysis.leaf_nodes);
  analysis.key_nodes.push(...analysis.special_nodes);
  // TODO: Dedupe? Precedence? (Leaf must be respected.)

  console.log(`Key nodes: ${analysis.key_nodes}`);

  analysis.is_key_node = new Map();
  for (i of analysis.key_nodes) analysis.is_key_node.set(i, true);

  // TODO: __enforce_minimum_key_nodes(analysis, 3);

  __identify_edges(analysis);

  return analysis;
}


function __compute_next_and_prev(analysis, lcg_fn) {

  let next = new Map();
  let prev = new Map();

  for (let i of __range(65536)) {
    let next_i = lcg_fn(i);
    next.set(i, next_i);
    if (!prev.has(next_i)) {
      prev.set(next_i, [i]);
    } else {
      prev.get(next_i).push(i);
    }
  }

  analysis["next"] = next;
  analysis["prev"] = prev;
}


function __find_cycles(analysis) {
  
  let cycles = [];
  let cycle_to_nodes = new Map();
  let node_to_cycle = new Map();

  let visited = Array(65536).fill(false);
  
  label_continue_scanning: for (let i of __range(65536)) {
    let j = i;
    if (visited[j] == true) continue;
    let visited_in_this_run = new Map();
    while (true) {
      visited_in_this_run.set(j, true);
      visited[j] = true;
      j = analysis.next.get(j);
      if (visited_in_this_run.has(j)) {
        // Found a cycle.
        break;
      }
      if (visited[j] == true) {
        continue label_continue_scanning;
      }
    }
    let cycle_origin = j;
    let nodes_in_cycle = [];
    // Take another ride around the cycle. Name cycle by size.
    do {
      nodes_in_cycle.push(j);
      j = analysis.next.get(j);
    } while (j != cycle_origin);
    let cycle_id = "C" + nodes_in_cycle.length;
    cycle_to_nodes.set(cycle_id, nodes_in_cycle);
    cycles.push(cycle_id);
    for (node of nodes_in_cycle) {
      node_to_cycle.set(node, cycle_id);
    }
  }

  console.log(`Cycles and their nodes: `);
  console.log(cycle_to_nodes);

  analysis["cycles"] = cycles;
  analysis["cycle_to_nodes"] = cycle_to_nodes;
  analysis["node_to_cycle"] = node_to_cycle;
}

function __find_junction_and_leaf_nodes(analysis) {

  let junction_nodes = [];
  let leaf_nodes = [];

  for (let i of __range(65536)) {
    let previous_nodes = analysis.prev.has(i) ? analysis.prev.get(i) : [];
    switch (previous_nodes.length) {
      case 0:
        leaf_nodes.push(i);
        break;
      case 1:
        break;
      case 2:
        junction_nodes.push(i);

        break;
      default:
        let msg = `Nodes in an LCG can't have ${previous_nodes.length} previous nodes.`;
        throw new Error(msg);
    }
  }

  console.log(`Junction nodes (${junction_nodes.length}): ${junction_nodes}`);
  console.log(`Leaf nodes (${leaf_nodes.length}): ${leaf_nodes}`);

  analysis["junction_nodes"] = junction_nodes;
  analysis["leaf_nodes"] = leaf_nodes;
}

function __enforce_minimum_key_nodes(analysis, minimum) {
  // TODO
}

function __identify_edges(analysis) {

  analysis["edges"] = [];
  analysis["edge_to_nodes"] = new Map();
  analysis["edge_to_number_of_nodes"] = new Map();

  // Perform a recursive DFS starting from each cycle.
  for (cycle_id of analysis.cycles) {

    let key_node_in_cycle = null;
    for (node of analysis.key_nodes) {
      if (analysis.node_to_cycle.has(node) &&
          analysis.node_to_cycle.get(node) == cycle_id) {
        key_node_in_cycle = node;
        break;
      }
    }

    if (key_node_in_cycle == null) {
      let msg = `Could not find a key node in ${cycle_id} to start with.`;
      throw new Error(msg);
    }
    
    __identify_edges_recursively(analysis, key_node_in_cycle);
    // NB: Possible for a cycle to have no previous nodes; an island on its own.
  }
}

function __identify_edges_recursively(analysis, edge_end) {
  // This should not be necessary to check but just being cautious.
  if (!analysis.is_key_node.has(edge_end)) {
    let msg = `Must recurse on a key node; was given ${edge_end}.`;
    throw new Error(msg);
  }
  for (let j of analysis.prev.get(edge_end)) {
    let edge_nodes = [edge_end];
    while (!analysis.is_key_node.has(j)) {
      // This should not be necessary to check but just being cautious.
      if (analysis.prev.get(j).length != 1) {
        let msg = `Nodes with 0 or 2 predecessors should have been marked as `
                + `leaf and junction key nodes; not the case for ${j}.`;
        throw new Error(msg);
      }
      edge_nodes.unshift(j); // Since we're traversing backwards.
      j = analysis.prev.get(j)[0]; // Guaranteed 1 element by check above.
    }
    // Found the key node.
    let edge_begin = j;
    edge_nodes.unshift(edge_begin); // Since we're traversing backwards.
    let edge_id = edge_begin + "-" + edge_end;
    analysis.edges.push(edge_id)
    analysis.edge_to_nodes.set(edge_id, edge_nodes);
    analysis.edge_to_number_of_nodes.set(edge_id, edge_nodes.length);
    __identify_edges_recursively(analysis, edge_begin);
  }
}








//   for (j of junctions_in_cycles) is_cycle_junction.set(j, true);

//   analysis["node_to_cycle"] = node_to_cycle;
//   analysis["cycles"] = cycles;
//   analysis["cycle_sizes"] = cycle_sizes;
//   analysis["junctions_in_cycles"] = junctions_in_cycles;
//   analysis["junctions_in_tails"] = junctions_in_tails;
//   analysis["is_cycle_junction"] = is_cycle_junction;
// }


// function __compute_node_to_cycle(analysis) {
  
//   let cycles = [];
//   let cycle_to_nodes = new Map();
//   let junctions_in_cycles = [];
//   let junctions_in_tails = [];
//   let is_cycle_junction = new Map();


// function __compute_key_nodes(analysis, special_nodes) {
  
//   let leaf_nodes = [];
//   let key_nodes = [];
//   let is_special_node = new Map();
//   let is_key_node = new Map();
  
//   for (j of special_nodes) {
//     is_special_node.set(j, true);
//   }
  
//   for (let i of __range(65536)) {
//     if (!analysis.prev.has(i)) {
//       leaf_nodes.push(Number(i));
//     }
//   }
  
//   key_nodes = analysis.junction_nodes
//       .concat(leaf_nodes)
//       .concat(special_nodes);

//   key_nodes = Array.from(new Set(key_nodes)); // Only unique nodes.
  


//   analysis["special_nodes"] = special_nodes;
//   analysis["leaf_nodes"] = leaf_nodes;
//   analysis["key_nodes"] = key_nodes;
//   analysis["is_special_node"] = is_special_node;
//   analysis["is_key_node"] = is_key_node;
// }


// function __compute_edges(analysis) {

//   let edges = [];
//   let edge_nodes = new Map();
//   let edge_sizes = new Map();
  
//   for (j of analysis.key_nodes) {
//     let nodes = [j];
//     let i = j;
//     do {
//       i = analysis.next.get(i);
//       nodes.push(i);
//     } while (!analysis.is_key_node.has(i));
//     edges.push(j + "-" + i);
//     edge_nodes.set(j + "-" + i, nodes);
//     edge_sizes.set(j + "-" + i, nodes.length);
//   }

//   analysis["edges"] = edges;
//   analysis["edge_nodes"] = edge_nodes;
//   analysis["edge_sizes"] = edge_sizes;
// }


function __range(size) {
  return [...Array(size).keys()]
}
