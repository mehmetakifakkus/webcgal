
///////////////////////////////    Visual Part      ///////////////////////////////

function clearScreen(){
    for(i=0; i<drawables.length; i++) // it is for lines, circles, texts etc.
        drawables[i].remove();
    //PolygonPoint.counter = 0;
}

Array.prototype.clear = function() {
  while (this.length)
    this.pop();
};
