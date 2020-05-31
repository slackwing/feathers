### Exploring an LCG with VivaGraphJS

Given today's computing power, I didn't imagine that drawing a graph of 65,000 nodes could take minutes or crash the browser. I was wrong.

I was trying to write a browser visualization / navigation tool, so I wanted to stick to Javascript. In 2019, it seemed Andrei Kashcha's VivaGraphJS was the fastest library available for large graphs. [His video](https://www.youtube.com/watch?v=Ax7KSQZ0_hk) (2014) has a nice comparison of 12 libraries.

[Here's](#todo) a naive setup running on a subset of the graph.

[Here's](#todo) the same setup running on the full graph. It takes a while and never settles in.

What I actually need is a hook to inject an initial layout that should greatly help running a force-directed algorithm afterward, but I was running into a lot of errors trying to do that. _Todo._
