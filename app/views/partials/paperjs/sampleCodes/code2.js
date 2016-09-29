drawCoordinateSystem();
polygon = createRandomPolygon(); // first create a random polygon, then modify by dragging

polygon.draw();

polygon.mouseDragEvent = function(){ // event triggering to polygon, when its dragged
    clear();
	for (var i in polygon.points) // access each polygon point
		print(polygon.points[i])
}


// end of script
