function Polygon(name){


    //if ((typeof Polygon.id == 'undefined'))
      //  Polygon.id = 0;

    this.name = name;
    //this.points = new Object();
    this.points = new Array();

    this.path = null;
    var tempObj = this;

    this.addPoint = function(p){
        //var polPoint = new PolygonPoint(p);
        //tempObj.points['p' + Object.keys(tempObj.points).length] = polPoint;
        var polPoint = new TextPoint(p);
        tempObj.points.push(polPoint);
    }

    this.changePosition = function(delta){
        for (var i in tempObj.points)
            tempObj.points[i].pos += delta;
        tempObj.draw();
    }

    this.changePosition2 = function(polPoint, delta){
        tempObj.points[polPoint.name].pos += delta;
        tempObj.draw();
    }

    this.draw = function(){ // silip tekrar cizdirir

        clearScreen();

        //for (var i in tempObj.points)
        for(var i=0; i<tempObj.points.length; i++) // this is array version
            tempObj.points[i].draw(i);

        tempObj.path = new Path({name: 'polygon_'+this.name, fillColor: 'white', strokeColor: 'black', strokeWidth: 2});
        tempObj.path.sendToBack();
        tempObj.path.closed = true;

        //for (var i in tempObj.points)
        for(var i=0; i<tempObj.points.length; i++) // this is array version
            tempObj.path.add(tempObj.points[i].pos);

        drawables.push(tempObj.path);

        tempObj.path.onMouseDrag = function(event){
            tempObj.mouseDragEvent(event);
        }
    };

    this.mouseDragEvent = function(){
        console.log('mouse drag event on a polygon')
    }

    this.sort = function(){
        tempObj.points.sort(function(a, b) {return a.point.x - b.point.x;});
    }
};

var Vector = Point.extend({
	_class: 'Vector',
	_readIndex: true,

	deneme: function(){return 'hey'}
});
