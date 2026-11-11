var points = Points.createRandom(25, 250, 600, 120, 300);
var disk = smallestEnclosingDisk(points);
drawCircle(miniDisc(points));
var inside = points.filter(function (p) { return inCircle(disk.center, disk.radius, p) <= 1e-9; });
console.log('radius ' + Math.round(disk.radius) + ' · ' + inside.length + ' points inside');
