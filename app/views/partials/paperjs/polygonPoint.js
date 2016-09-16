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
    }
    
    this.toString = function ToString() {
        return tempObj.path.name+' '+tempObj.pos;  
    };
    
    return this;
};