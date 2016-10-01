function TextPoint(x,y){

    if ((typeof TextPoint.id == 'undefined'))
        TextPoint.id = 0;

    this.id = TextPoint.id++;

    this.pos = new Point(x,y);
    this.path = null;

    var self = this;

    this.draw = function(){

        drawables.push(new PointText({ matrix: new Matrix(1,0,0,-1, self.pos.x+3, self.pos.y+5), fontSize: '16px', fillColor: 'black', content: ' '+ self.id}));

        self.path = new Path.Circle({name: '_p'+self.id, center: self.pos, radius: 5, fillColor: 'black'});
        drawables.push(self.path);

        self.path.onMouseDrag = function(event){
            self.mouseDragEvent(event);
        }
    };
    this.draw();


    this.mouseDragEvent = function(event){

        clearDrawables();

        console.log('default mouse drag event on a TextPoint '+self.id)
        self.pos += event.delta * [1, -1];

        for(var i=0; i < points.length; i++)
            points[i].draw();

        //convexHull(points);
    };

    this.toString = function() {
        return ''+self.path.name+' ';
        //        return ''+self.path.name+' '+self.pos;
    };
};


function getTextPoint(str){
    for(var i=0; i < points.length; i++){
        if(points[i].path.name.startsWith(str))
            return points[i];
    }
}

////////////////////////////// Points Temp Object ////////////////////////////////
function PointsTempObject()
{
    var self = this;

    function clearDrawables2(){
        for(i=0; i<drawables.length; i++) // it is for lines, circles, texts etc.
            drawables[i].remove();
        //TextPoint.id = 0;
    }

    var ids = [];

    this.createRandom = function(n){

        var temp = []

        for(var i=0; i < n; i++)
        {
            var x = getRandomInt(50, 500);
            var y = getRandomInt(30, 300);
            var tmpP = new TextPoint(x,y);

            temp.push(tmpP);
            ids.push(tmpP.path.name); // store points names in an array when they are created
        }
        return temp;
    }

    this.sortX = function(points, dir){
        var points2 = points.sort(function(a, b) {return a.pos.x - b.pos.x;});

        clearDrawables2();

        for(var i=0; i < points2.length; i++)
            points2[i].draw();

        return points2;
    }

    this.sortY = function(points){
        var points2 = points.sort(function(a, b) {return a.pos.y - b.pos.y;});

        clearDrawables2();

        for(var i=0; i < points2.length; i++)
        {
            points2[i].draw();
            TextPoint.id++;
        }
        return points2;
    }

        var count = 0;
    this.animateVibrate = function(fn, points){

        clearDrawables();

        var offset = new Point(2, 1) * [Math.sin(count / 30), Math.sin(count / 40)];

        for(var i=0; i < points.length; i++)
            getTextPoint(ids[i]).pos +=  offset * getRandomInt(-5,5);

        for(var i=0; i < points.length; i++)
            points[i].draw();

        fn(points);
        count++;
    }

    this.animateRandom = function(fn, points){

        clearDrawables();

        for(var i=0; i < ids.length; i++)
            //points[ids[i]].pos +=  new Point(3, 2) * [Math.sin((i+10)/3 * count / 170), Math.sin( (i+10)/3 * count / 90)];
            getTextPoint(ids[i]).pos += new Point(3, 2) * [Math.sin((i+10)/3 * count / 170), Math.sin( (i+10)/3 * count / 90)];
        for(var i=0; i < points.length; i++)
            points[i].draw();

        fn(points);
        count++;
    }

    this.drawPoints = function(points){

        for(var i=0; i < points.length; i++)
            points[i].draw();
    }
}

var Points = new PointsTempObject();



/////////////////////////////////////////  Math function  ////////////////////////////////////////////////////

function add(p1, p2){
    return p1.pos + p2.pos;
}

function subtract(p1, p2){
    return p1.pos - p2.pos;
}

/////////////////////////////////////////  Visual  ////////////////////////////////////////////////////


function drawLine(p1, p2){
    drawables.push(new Path.Line({from: p1.pos, to: p2.pos, strokeColor: 'black', strokeWidth:2}))
}

function drawLines(points){
    for(var i=0; i < points.length-1; i++){
        drawLine(points[i], points[i+1])
    }
}


