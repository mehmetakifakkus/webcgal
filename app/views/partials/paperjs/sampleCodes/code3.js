drawCoordinateSystem();
polygon = createPolygon('square'); // first create a random polygon, then modify by dragging

polygon.draw();

polygon.points.p0.mouseDragEvent = function(){ // event triggering to polygon point
    clearLog()
    printLog(polygon.points.p0) // print polygon point position
}


// end of script
