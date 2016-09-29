var hitOptions = {segments: true, fill: true, stroke: true, tolerance: 10};

function onMouseMove(event) {
	project.activeLayer.selected = false;
    //if (event.item)
      //  event.item.bringToFront();
}

function onMouseDown(event) {

    path = polPoint =  null;

	var hitResult = project.hitTest(event.point, hitOptions);
    if (hitResult){                       //console.log(event.item.name)

        if(event.item.name.startsWith('path_polygon'))
            path = hitResult.item;
        else if (event.item.name.startsWith('p'))
            polPoint = event.item;
    }
}

function onMouseDrag(event) {
	if (path)
        polygon.changePosition(event.delta * [1, -1]); // mirroring on y-axis, since it is changed on active layer
    else if (polPoint)
        polygon.changePosition2(polPoint, event.delta * [1, -1]);
 }
