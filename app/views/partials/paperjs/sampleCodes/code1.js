drawCoordinateSystem();
polygon = createPolygon('square'); // create a square shape polygon, then modify by dragging

polygon.draw();

clear();
for(var i=0; i < polygon.points.length; i++) // access each polygon point
    print(polygon.points[i])

    
// end of script
