var segments = Segments.createRandom(7);
Segments.draw(segments);
var result = findIntersections(segments);   // try bruteForceIntersections(segments) too
drawIntersections(result);
console.log(result.points.length + ' intersection point(s), ' + result.overlaps.length + ' overlap(s)');
