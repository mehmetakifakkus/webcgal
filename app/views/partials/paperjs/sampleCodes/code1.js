drawCoordinateSystem();
polygon = createPolygon('square'); // create a square shape polygon, then modify by dragging

polygon.draw();

clearLog();
for(var i=0; i < polygon.points.length; i++) // access each polygon point
    printLog(polygon.points[i])
