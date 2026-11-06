// This demo uses canvas coordinates (y axis pointing down), as on the original page.
project.activeLayer.matrix = new Matrix();

var lineSegments = [];
var wedges = [];

var origin = new Point(180, 240);

var start;
var line = new Path.Line({name: 'temp'});

var counter = -1;
var definedLineSegment = [[300, 180], [240, 60], [60, 180], [120, 60]]; // line1 ending1, line1 ending2, line2 ending1....

colors = ['red', 'blue', 'green', 'yellow', 'magenta', 'black', 'grey'];

var booleanStyle = {
    strokeColor: new Color(0, 0, 0),
    strokeWidth: 1.5
};

var drawables = [];

var segment, path;
var hitOptions = {segments: true, stroke: true, tolerance: 15};

function onMouseMove(event) {
	project.activeLayer.selected = false;
    if (event.item)
    {
        if(event.item.name == 'lineSegment')
        {
            event.item.bringToFront()
            event.item.selected = true;
        }
    }
}

function onMouseDown(event) {

    segment = path = null;

	var hitResult = project.hitTest(event.point, hitOptions);

    if (hitResult && hitResult.item.name == 'lineSegment'){
        path = hitResult.item;
        if (hitResult.type == 'segment')
           segment = hitResult.segment
    }
    else
        start = event.point;
}

function onMouseDrag(event) {
    if (segment)
		segment.point += event.delta;
	else if (path)
		path.position += event.delta;

    if(line){    line.remove(); line = null; }
    if(start) // show temporarily
	   line = new Path.Line({name: 'temp', from: start, to: event.point, strokeColor: 'black', strokeWidth: 3});

    drawDualLines();
}

function onMouseUp(event) {   // The mouse was released, so we add the new location as the end segment of the line.
    if(line){
        lineSegments.push(new LineSegment(start, event.point));
        drawDualLines();
    }
    start = null;
}

//////////////////////////////////////  Classes  //////////////////////////////////////

function LineSegment(p1, p2){

    this.color = colors[counter++%6];

    this.p1 = p1; //one line ending;
    this.p2 = p2; //other line ending;

    this.line = new Path.Line({from: p1, to: p2, strokeColor: this.color, strokeWidth: 3, name: 'lineSegment'});

    //drawables.push(new PointText({ point: p  +[5, -5], fontSize: '16px', fillColor: 'black', content: ' '+ k}));
};

function Wedge(p1, p2, col){

    var dualLine1 = pointToDualLine(p1);
    var dualLine2 = pointToDualLine(p2);

    this.path = new Path({fillColor: col, name: 'wedge'});
    this.path.opacity = 0.15;

    this.path.add(dualLine1.from);
    this.path.add(dualLine1.to);
    this.path.add(dualLine2.to);
    this.path.add(dualLine2.from);
    this.path.closed = true;

    //drawables.push(new PointText({ point: p  +[5, -5], fontSize: '16px', fillColor: 'black', content: ' '+ k}));
};

/////////////////////////////////     Visual Part      //////////////////////////////////

function clear()
{
    for(i=0; i<drawables.length; i++) // it is for lines, circles, texts etc.
        drawables[i].remove();

    Pie.counter = -1;
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
    temp.y = 480 - temp.y;
    temp  -= new Point(180, 240);
    temp /= 50;

    //console.log(temp);
    return temp;
}

function convertToRealCoord(p){
    var temp = p.clone();
    temp *= 50;
    temp += new Point(180, 240);
    temp.y = 480 - temp.y;

    //console.log(temp);
    return temp;
}

function drawCoordinateSystem(){
    new Path.Line({name: 'x-coord', from: [0, origin.y], to:[490, origin.y], strokeColor:'black', strokeWidth: 2})
    new Path.Line({name: 'y-coord', from: [origin.x, 0], to:[origin.x, 490], strokeColor:'black', strokeWidth: 2})

    for(i = -5; i <= 5; i++)
       new Path.Line({name: 'coord', from: convertToRealCoord(new Point(-5, i)), to: convertToRealCoord(new Point(5, i)), strokeColor:'black', strokeWidth: 1, dashArray: [1,2]})

    for(i = -5; i <= 5; i++)
       new Path.Line({name: 'coord', from: convertToRealCoord(new Point(i, -5)), to: convertToRealCoord(new Point(i, 5)), strokeColor:'black', strokeWidth: 1, dashArray: [1,2]})
}
drawCoordinateSystem();

function enlargeLineEndings(p1, p2, coeff){
    return p1 * coeff  + p2 * (1 - coeff);
}

function pointToDualLine(p){

    var yCoorInter = -p.y;
    var xCoorInter = p.y/p.x;

    var p1 = new Point(0, yCoorInter);
    var p2 = new Point(xCoorInter, 0);

    return {from: convertToRealCoord(enlargeLineEndings(p1, p2, -99)), to: convertToRealCoord(enlargeLineEndings(p1, p2, 99))};
}

function drawDualLine(p, color){ // get a point and create a line (dual line)
    var dualLine = pointToDualLine(p);
    new Path.Line({from: dualLine.from, to:dualLine.to, strokeColor: color, strokeWidth: 2});
}

function drawDualLineSegment(p1, p2, color){ //dual of every segment consists of two dual lines
    drawDualLine(convertToDualCoord(p1), color);
    drawDualLine(convertToDualCoord(p2), color);

    wedges.push(new Wedge(convertToDualCoord(p1), convertToDualCoord(p2), color));
}

function drawLineSegment(){ // it is predefined line segments
    for(i=0; i<definedLineSegment.length; i+= 2)
            lineSegments.push(new LineSegment(new Point(definedLineSegment[i]), new Point(definedLineSegment[i+1])));
}


/////////////////////////////////////    Main   ////////////////////////////////////

var canvas = document.getElementById('myCanvas');
drawLineSegment();

function onFrame(event){}

// it is on another scope
function drawDualLines(){

    var scope = new paper.PaperScope();
    var canvas_2 = document.getElementById('canvas-2');
    scope.setup(canvas_2)
    canvas_2.width = 360;
    canvas_2.height = 480;

    drawCoordinateSystem();

    console.log(lineSegments.length, wedges.length);

    var len = wedges.length;
    for(i=0; i<len; i++) // clear all wedges
        wedges.pop();



    for(i=0; i < lineSegments.length; i++)
    {
        lineSegments[i].p1 = lineSegments[i].line.segments[0].point; // update line segments
        lineSegments[i].p2 = lineSegments[i].line.segments[1].point;

        drawDualLineSegment(lineSegments[i].p1, lineSegments[i].p2, lineSegments[i].color); // draw dual line segments and wedges
    }

    var intersectPath;
    if(wedges.length >= 1)
        intersectPath = wedges[0].path;


    for(i=1; i<wedges.length ;i++)
        intersectPath = intersectPath.intersect(wedges[i].path)

    intersectPath.fillColor = 'black';
    intersectPath.selected = true;


    scope.view.draw();
}
drawDualLines();
