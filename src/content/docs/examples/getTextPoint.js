drawCoordinateSystem();
var corner = new TextPoint(convertToRealCoord([4, 3]));
corner.path.name = 'corner';
new TextPoint(convertToRealCoord([8, 6]));
var found = getTextPoint('cor'); // no point is named exactly 'cor', so the first name starting with it wins
found.path.fillColor = 'red';
console.log('found ' + found.path.name);
