var points = Points.createRandom(7);

var chPoints = convexHull(points); // convex Hull points is stored here.
Points.drawLines(chPoints);
