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

    this.createRandom = function(n, minX, maxX, minY, maxY){

        var temp = []

        var x_ = maxX || view.size.width;
        var y_ = maxY || view.size.height;

        for(var i=0; i < n; i++)
        {
            var x = getRandomInt(minX || 0.1 * x_, 0.8 * x_);
            var y = getRandomInt(minY || 0.1 * y_, 0.8 * y_);
            var tmpP = new TextPoint(x,y);

            temp.push(tmpP);
            ids.push(tmpP.path.name); // store points names in an array when they are created
        }
        return temp;
    }

    this.sortX = function(points){
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
    this.animateVibrate = function(points, fn){

        clearDrawables();

        var offset = new Point(2, 1) * [Math.sin(count / 30), Math.sin(count / 40)];

        for(var i=0; i < points.length; i++)
            getTextPoint(ids[i]).pos +=  offset * getRandomInt(-5,5);

        for(var i=0; i < points.length; i++)
            points[i].draw();

        var func = fn || function(){};

        var chPoints = func(points);

        count++;
        return chPoints;
    }

    this.animateRandom = function(points, fn){

        clearDrawables();

        for(var i=0; i < ids.length; i++)
            //points[ids[i]].pos +=  new Point(3, 2) * [Math.sin((i+10)/3 * count / 170), Math.sin( (i+10)/3 * count / 90)];
            getTextPoint(ids[i]).pos += new Point(2, 1) * [Math.sin((i+10)/3 * count / 170), Math.sin( (i+10)/3 * count / 90)];
        for(var i=0; i < points.length; i++)
            points[i].draw();

        var func = fn || function(){};

        var chPoints = func(points);
        count++;
        return chPoints;
    }


    this.animateRandomWide = function(points, fn){

        clearDrawables();

        for(var i=0; i < ids.length; i++)
            //points[ids[i]].pos +=  new Point(3, 2) * [Math.sin((i+10)/3 * count / 170), Math.sin( (i+10)/3 * count / 90)];
            getTextPoint(ids[i]).pos += new Point(i < ids.length/2 ? 2: -2, i < ids.length/2 ? 1: -2) * [Math.sin((i+10)/3 * count / 270), Math.sin( (i+10)/3 * count / 290)];
        for(var i=0; i < points.length; i++)
            points[i].draw();

        var func = fn || function(){};

        var chPoints = fn(points);
        count++;
        return chPoints;
    }


    this.drawPoints = function(points){  // they are automatically drawed

        for(var i=0; i < points.length; i++)
            points[i].draw();
    }

    this.shuffle = function(a) {
        var result = [], j, i, temp = a.slice(0); // copy the content

        for (i = temp.length; i; i--) {
            j = Math.floor(Math.random() * i);
            result.push(temp[j])
            temp.splice(j, 1) //bu eksiltme işlemi burada gerçekleşiyor
        }
        return result;
    }

    /////////////////////////////////////////  Visual  ////////////////////////////////////////////////////


    this.drawLine = function(p1, p2){
        drawables.push(new Path.Line({from: p1.pos, to: p2.pos, strokeColor: 'black', strokeWidth:2}))
    }

    this.drawLines = function(points){
        for(var i=0; i < points.length-1; i++){
            self.drawLine(points[i], points[i+1])
        }
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



