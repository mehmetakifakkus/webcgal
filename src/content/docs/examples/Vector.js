var v1 = new Vector(300, 80);
var v2 = new Vector(100, 200);
var sum = add(v1, v2);
drawLine(origin, v1);
drawLine(origin, v2);
drawLine(v1, sum); // the other two sides of the parallelogram
drawLine(v2, sum);
drawLine(origin, sum).strokeColor = 'red'; // the sum, in red
v1.draw();
v2.draw();
new Vector(sum.x, sum.y).draw();
console.log('sum (' + sum.x + ', ' + sum.y + ') · dot ' + dotProduct(v1, v2) + ' · cross ' + crossProduct(v1, v2));
