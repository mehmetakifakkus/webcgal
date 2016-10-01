////////////////////    Circle Operation    /////////////////////////

function getCenterAndRadius3(p1, p2, p3){

    var eq1 = p1.x*p1.x + p1.y*p1.y +'+'+p1.x+'*d+'+p1.y+'*e+f=0';
    var eq2 = p2.x*p2.x + p2.y*p2.y +'+'+p2.x+'*d+'+p2.y+'*e+f=0';
    var eq3 = p3.x*p3.x + p3.y*p3.y +'+'+p3.x+'*d+'+p3.y+'*e+f=0';

    var sol = nerdamer.solveEquations([eq1, eq2, eq3]);

    var x = sol[0][1]/-2;
    var y = sol[1][1]/-2;

    var res = x*x + y*y+'+'+sol[0][1]+'*x+'+sol[1][1]+'*y+'+sol[2][1];
    var r2 = nerdamer(res, {x:x, y:y}, 'numer');
    var r = Math.sqrt(Math.abs(parseInt(r2.toString())));

    return {center: new Point(x,y), r:r}
}

function getCenterAndRadius2(p1, p2){
    return {center: (p1+p2)/2, r:(p1.getDistance(p2)/2)}
}

function inCircle(center, radius, p){
    return Math.sqrt(Math.pow(p.x-center.x, 2)+ Math.pow(p.y-center.y, 2)) - radius;
}
