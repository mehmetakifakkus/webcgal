drawCoordinateSystem();
polygon = createPolygon('square'); // create a square shape polygon, then modify by dragging

polygon.draw();

clear();
for (var i in polygon.points) // access each polygon point
    print(polygon.points[i])

    
// end of script
