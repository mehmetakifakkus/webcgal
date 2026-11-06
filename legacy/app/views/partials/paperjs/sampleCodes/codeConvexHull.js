var points = Points.createRandom(7);

var p = new TextPoint(new Point(100,100));
points.push(p)

points = Points.sortY(points);


-------


drawCoordinateSystem();

var points = Points.createRandom(7);
points = Points.sortX(points); // n log n time complexity

var p1 = new TextPoint(100,100);
var p2 = new TextPoint(200,300);

var p3 = p1.add(p2);
console.log(p3)

var Lupper = []
Lupper.push(p1, p2);

drawLine(p1, p2)


---------

    drawCoordinateSystem();

var points = Points.createRandom(7);
points = Points.sortX(points); // n log n time complexity

var p3 = add(points[0], points[1]);

var Lupper = []
Lupper.push(points[0], points[1]); // add p0 and p1

for(var i=2; i<points.length; i++) // starting from p2
{
    Lupper.push(points[i]);
    //console.log(points[i].path.name+ ' eklendi');

    var last = Lupper.length-1;

    var v1 = subtract(Lupper[last], Lupper[last-1]);
    var v2 = subtract(Lupper[last-1], Lupper[last-2]);

    //debugger
    while(Lupper.length > 2 && crossProduct(v1, v2) < 0 ){
        //console.log(Lupper[last-2].path.name + ' -> '+ Lupper[last-1].path.name + ' -> '+(Lupper[last].path.name));
        //console.log(Lupper[last-1].path.name+ ' cikarildi.');

        Lupper = Lupper.slice(0,last-1).concat(Lupper.slice(last)); //delete the middle of the last three points
        //console.log(' '+Lupper);

        last = Lupper.length-1;
        if(Lupper.length > 2){
            v1 = subtract(Lupper[last], Lupper[last-1]);
            v2 = subtract(Lupper[last-1], Lupper[last-2]);
        }
    }
}

console.log(' '+Lupper)
