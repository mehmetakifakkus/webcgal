function miniDisc(points){
    var ps = shuffle(points);
    var lastCircle = getCenterAndRadius2(ps[0].pos, ps[1].pos);

    for(i=2; i<ps.length; i++)
        if(inCircle(lastCircle.center, lastCircle.radius, ps[i].pos) > 0)
            lastCircle = miniDiscWithPoint(ps.slice(0, i), ps[i])

    return lastCircle;
}

function miniDiscWithPoint(points, q){
    var ps = shuffle(points);
    var lastCircle = getCenterAndRadius2(ps[0].pos, q.pos);

    for(j=1; j<ps.length; j++)
        if(inCircle(lastCircle.center, lastCircle.radius, ps[j].pos) > 0)
            lastCircle = miniDiscWitTwoPoints(ps.slice(0, j), ps[j], q)

    return lastCircle;
}

function miniDiscWitTwoPoints(points, q1, q2){
    var lastCircle = getCenterAndRadius2(q1.pos, q2.pos);

    for(k=0; k<points.length; k++)
        if(inCircle(lastCircle.center, lastCircle.radius, points[k].pos) > 0)
            lastCircle = getCenterAndRadius3(q1.pos, q2.pos, points[k].pos);

    return lastCircle;
}
