function drawCoordinateSystem(){ 
    new Path.Circle({ center: [0,0], radius: 5, fillColor: 'black'});
    new PointText({ fontSize: '14px', fillColor: 'black', content: '(0,0)', matrix: new Matrix(1,0,0,-1, 10, 10) });

    new Path.Line({name: 'x-coord', from: [-400, origin.y], to:[892, origin.y], strokeColor:'black', strokeWidth: 2})
    new Path.Line({name: 'y-coord', from: [origin.x, -400], to:[origin.x, 420], strokeColor:'black', strokeWidth: 2})
    
    for(i = 0; i <= 10; i++)
       new Path.Line({name: 'coord', from: convertToRealCoord(new Point(0, i)), to: convertToRealCoord(new Point(18, i)), strokeColor:'black', strokeWidth: 1, dashArray: [1,2]})
 
    for(i = 0; i <= 18; i++)
       new Path.Line({name: 'coord', from: convertToRealCoord(new Point(i, 0)), to: convertToRealCoord(new Point(i, 18)), strokeColor:'black', strokeWidth: 1, dashArray: [1,2]})  
}