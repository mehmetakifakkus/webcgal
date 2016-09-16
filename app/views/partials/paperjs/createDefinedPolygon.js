function createRandomPolygon(){ 

    var sel = Math.floor(Math.random() * 3)
    var polygons = [
                    [[350.5,104],[300.5,231],[326.5,359],[236.5,335],[37.5,194],[181.5,161],[257.5,57]],
                    [[401.5,104],[450.5,246],[386.5,379],[236.5,335],[97.5,194],[287.5,222],[257.5,57]],
                    [[432.5,100],[481.5,242],[417.5,375],[267.5,331],[128.5,190],[200.5,90],[288.5,53]]
                   ];
                              
    var pols = polygons[sel];                
    var polygon = new Polygon('random');
    
    for(var k=0; k < pols.length; k++)
        polygon.addPoint(new Point(pols[k]));
    
    return polygon;
}

polys = project.importSVG(document.getElementById("polygons"));
for(var t=0; t<polys.children.length; t++)
    polys.children[t].visible = false;

function createPolygon(str, position, scaleFactor ){ 
    
    var web = polys.children[str];
    if(typeof web == 'undefined')
    {
        alert('not defined polygon')
        return;
    }
    
    web.visible = false;
    web.style = {fillColor: 'white', strokeColor: 'black', strokeWidth: 2}

    web.position = position || [250, 210];
    web.scale(scaleFactor || 1);

    var polygon = new Polygon(str);

    for(var k=0; k < web.children[0].segments.length; k++)
    {
        var p = new Point(web.children[0].segments[k].point);
        polygon.addPoint(p);
    }
    
    return polygon;
}
