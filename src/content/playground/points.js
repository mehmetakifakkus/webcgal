var count = 6
var origin = view.size/2;

for (var i = 0; i < count; i++) {
    var vector = new Point({
        angle: 360/count * i,
        length: getRandomInt(50,200)
    });

	print(origin+vector)
	new TextPoint(origin+vector)
}
