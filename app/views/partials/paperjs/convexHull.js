function convexHull(points){
    points = Points.sortX(points); // n log n time complexity

    var Lupper = [], Llower = [];      // initialize upper and lower points
    Lupper.push(points[0], points[1]); // add p_0 and p_1

    for(var i=2; i<points.length; i++) // starting from p2
    {
        Lupper.push(points[i]);
        var last = Lupper.length-1;

        while(Lupper.length > 2 && isLeftTurn(Lupper) ){
            last = Lupper.length-1;
            Lupper = Lupper.slice(0,last-1).concat(Lupper.slice(last)); //delete the middle of the last three points
        }
    }

    var last = points.length-1;
    Llower.push(points[last], points[last-1]); // add p_n and p_n-1
    for(var i=last-2; i >= 0; i--) // starting from p_n-2
    {
        Llower.push(points[i]);
        var last = Llower.length-1;

        while(Llower.length > 2 && isLeftTurn(Llower) ){
            last = Llower.length-1;
            Llower = Llower.slice(0,last-1).concat(Llower.slice(last)); //delete the middle of the last three points
        }
    }
    return Lupper.concat(Llower); // return upper and lower part
}

function isLeftTurn(Lupper){
    var last = Lupper.length-1;

    var v1 = subtract(Lupper[last], Lupper[last-1]);
    var v2 = subtract(Lupper[last-1], Lupper[last-2]);

    return (crossProduct(v1, v2) < 0)
}
