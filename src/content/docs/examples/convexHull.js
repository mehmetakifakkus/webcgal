var points = Points.createRandom(20);
var hull = convexHull(points);
drawLines(hull);
hull.forEach(function (p) { p.path.fillColor = 'red'; });
console.log((hull.length - 1) + ' of ' + points.length + ' points on the hull');
