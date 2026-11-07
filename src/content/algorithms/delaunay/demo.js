var points = Points.createRandom(12);
var result = delaunay(points);
drawTriangulation(points, result);
console.log(result.triangles.length + ' triangle(s), ' + result.edges.length + ' edge(s)');
