drawCoordinateSystem();
polygon = createRandomPolygon();
polygon.draw();
var result = triangulate(polygon);
drawDiagonals(polygon, result.partitionDiagonals, 'red');
drawDiagonals(polygon, result.triangulationDiagonals, 'blue');
console.log(result.triangles.length + ' triangle(s), ' + result.partitionDiagonals.length + ' partition diagonal(s)');
