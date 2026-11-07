var points = Points.createRandom(12);
var result = voronoi(points);
drawVoronoi(points, result);
console.log(result.vertices.length + ' vertex/vertices, ' + result.edges.length + ' edge(s), ' + result.cells.length + ' cell(s)');
