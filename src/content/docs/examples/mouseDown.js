var points = Points.createRandom(7);
drawCircle(miniDisc(points));

function mouseDown(point){
   points.push(point); // store point in other 7

   Points.drawPoints(points); // clear olds, draw points again
   drawCircle(miniDisc(points));
}
