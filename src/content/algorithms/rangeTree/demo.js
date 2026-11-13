var points = Points.createRandom(30);
var tree = rangeTree(points);
drawRangeTree(points, tree, 'lightgray');
new Path.Rectangle({ from: [200, 120], to: [500, 340], strokeColor: 'red' });
var hits = rangeTreeQuery(points, tree, { x0: 200, y0: 120, x1: 500, y1: 340 });
hits.forEach(function (i) { points[i].path.fillColor = 'red'; });
console.log(hits.length + ' point(s) in the range, storage ' + tree.storage);
