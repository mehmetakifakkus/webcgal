// a random star-shaped room of 10 to 15 corners around the centre of the view
var n = getRandomInt(10, 16);
polygon = new Polygon('gallery');
for (var i = 0; i < n; i++)
  polygon.addPoint(view.center + new Point({ angle: (360 / n) * i, length: getRandomInt(50, 150) }));
polygon.draw();
var result = artGallery(polygon);
drawArtGallery(polygon, result, 'orange');
console.log(result.cameras.length + ' camera(s) for ' + n + ' vertices');
