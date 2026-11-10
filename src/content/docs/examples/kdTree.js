var points = Points.createRandom(30);
var tree = kdTree(points);
drawKdTree(points, tree);
var hits = rangeQuery(points, tree, { x0: 200, y0: 100, x1: 500, y1: 300 });
hits.forEach(function (i) { points[i].path.fillColor = 'red'; });
console.log(hits.length + ' point(s) in the range');
