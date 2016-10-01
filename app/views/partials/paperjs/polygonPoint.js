function PolygonPoint(p){

    this.pos = p;
    this.path = null;
    
    var tempObj = this;
    
    this.draw = function(id){
        drawables.push(new PointText({ matrix: new Matrix(1,0,0,-1, tempObj.pos.x+3, tempObj.pos.y+5), fontSize: '16px', fillColor: 'black', content: ' '+ id[1]}));
        
        tempObj.path = new Path.Circle({ name: id, center: tempObj.pos, radius: 5, fillColor: 'black'});
        drawables.push(tempObj.path);
        
        tempObj.path.onMouseDrag = function(event){
            tempObj.mouseDragEvent(event);
        }
    };
    
    this.mouseDragEvent = function(){
        console.log('mouse drag event on a polygon point')	
    };
    
    this.toString = function ToString() {
        return tempObj.path.name+' '+tempObj.pos;  
    };
    
    return this;
};


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

        convexHull(points);
    };

    this.toString = function() {
        return ''+self.path.name+' ';
        //        return ''+self.path.name+' '+self.pos;
    };
};
