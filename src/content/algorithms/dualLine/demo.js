points = [];
var origin = new Point(180, 240);

var counter = -1;
var definedPoints = [[230, 290],[280, 290],[230, 390]];

colors = ['red', 'blue', 'green', 'yellow', 'magenta', 'black', 'grey'];

var booleanStyle = {
    strokeColor: new Color(0, 0, 0),
    strokeWidth: 1.5
};

var drawables = [];

var segment, path;
//var hitOptions = {segments: true, fill: true, stroke:true, tolerance: 15};
var hitOptions = {fill: true, tolerance: 15};

function onMouseMove(event) {
	project.activeLayer.selected = false;
    if (event.item)
    {
        if(event.item.name == 'point')
        {
            event.item.bringToFront()
            event.item.selected = true;
        }
    }
}

function onMouseDown(event) {

    segment = path = null;

	var hitResult = project.hitTest(event.point, hitOptions);
    if (hitResult){
		path = hitResult.item;
        if (hitResult.type == 'segment')
           segment = hitResult.segment
    }

     if (event.modifiers.shift) { // if control is pressed add new point
        points.push(new Path.Circle({ name: 'point', center: event.point, radius: 7, fillColor: colors[counter++%6]}));
        drawDualLines();
    }
}

function onMouseDrag(event) {
    if (segment)
		segment.point += event.delta;
	else if (path)
		path.position += event.delta * [1, -1];

    drawDualLines();
 }

///////////////////////////////   vector processes   //////////////////////////////////

function dotProduct(v1, v2){
    return v1.x * v2.x + v1.y * v2.y;
}

function crossProduct(v1, v2){
    return v1.x * v2.y - v2.x * v1.y;
}

//////////////////////////////////////  Classes  //////////////////////////////////////

function PolygonPoint(p){

    this.point = p;
    this.type = ''; // convex, concave

    this.v1; //incident vector1;
    this.v2; //incident vector2;

    drawables.push(new PointText({ point: p  +[5, -5], fontSize: '16px', fillColor: 'black', content: ' '+ k}));
};

function Pie(origin, from, through, to){

    if (typeof Pie.counter == 'undefined')
        Pie.counter = -1;

    this.id = Pie.counter++; // newly created vertex will have different id
    this.through = through;

    var arc = drawArc(origin, from, through, to);
    var pol = drawLines(origin, from, to);

    var un = arc.unite(pol); // they must be "closed path" for any boolean operation

    un.style = booleanStyle
    un.fillColor = colors[Pie.counter];
    un.fillColor.alpha = 0.4;

    this.path = un;
};

///////////////////////////////////////////     Visual Part      ////////////////////////////////////////////////

function clear()
{
    for(i=0; i<drawables.length; i++) // it is for lines, circles, texts etc.
        drawables[i].remove();

    Pie.counter = -1;
}

function drawArc(origin, from, through, to){
    var curve = new Path.Arc({from: origin + from, through: origin + through, to: origin + to, dashArray: [1,2] });
    curve.closed = true;
    return curve;
}

function drawLines(origin, v1, v2){
    var innerPart = new Path({dashArray: [1,2]});
    innerPart.add(origin);
    innerPart.add(origin + v1);
    innerPart.add(origin + v2);
    innerPart.closed = true;

    return innerPart;
}

function convertToDualCoord(p){
    var temp = p.clone();
    temp  -= new Point(180, 240);
    temp /= 50;
    temp = temp *[-1,1];

    //console.log(temp);
    return temp;
}

function convertToRealCoord(p){
    var temp = p.clone();
    temp *= 50;
    temp += new Point(180, 240);

    //console.log(temp);
    return temp;
}

function drawCoordinateSystem(){

    new Path.Line({from: [origin.x, 0], to:[origin.x, 490], strokeColor:'black', strokeWidth: 2})
    new Path.Line({from: [0, origin.y], to:[490, origin.y], strokeColor:'black', strokeWidth: 2})

    for(i = -4; i <= 4; i++)
       new Path.Line({from: convertToRealCoord(new Point(-5, i)), to: convertToRealCoord(new Point(5, i)), strokeColor:'black', strokeWidth: 1, dashArray: [1,2]})

    for(i = -4; i <= 4; i++)
       new Path.Line({from: convertToRealCoord(new Point(i, -5)), to: convertToRealCoord(new Point(i, 5)), strokeColor:'black', strokeWidth: 1, dashArray: [1,2]})
}
drawCoordinateSystem();

function enlargeLineEndings(p1, p2, coeff){
    return p1 * coeff  + p2 * (1 - coeff);
}

function drawDualLine(p, color){

    console.info(convertToDualCoord(p));

    var yCoorInter = -p.y;
    var xCoorInter = p.y/p.x;

    var p1 = new Point(0, yCoorInter);
    var p2 = new Point(xCoorInter, 0);
    drawables.push(new Path.Line({from: convertToRealCoord(enlargeLineEndings(p1, p2, -999)), to: convertToRealCoord(enlargeLineEndings(p1, p2, 999)), strokeColor: color, strokeWidth: 2}));
}

function drawPoints(){
    for(i=0; i<definedPoints.length; i++)
        points.push(new Path.Circle({ name: 'point', center: definedPoints[i], radius: 7, fillColor: colors[counter++%6]}));
}


///////////////////////////////////////////////    Main   /////////////////////////////////////////////////

var canvas = document.getElementById('myCanvas');
drawPoints();

function onFrame(event){}

// it is on another scope
function drawDualLines(){

    var scope = new paper.PaperScope();
    var canvas_2 = document.getElementById('canvas-2');
    scope.setup(canvas_2)
    canvas_2.width = 360;
    canvas_2.height = 480;

    drawCoordinateSystem();


    var pies = []; // stores each pie

    var origin = new Point(160, 120);

    for(i=0; i<points.length; i++)
    {
        drawDualLine(convertToDualCoord(points[i].position), points[i].fillColor);
    }

    scope.view.draw();
}

drawDualLines();
