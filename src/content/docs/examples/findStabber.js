// five vertical segments around a random line, so a stabbing line usually exists
var slope = getRandomInt(-10, 11) / 100;
var intercept = getRandomInt(150, 211);
var segments = [];
for (var x = 100; x <= 500; x += 100) {
  var y = slope * x + intercept + getRandomInt(-40, 41);
  segments.push([[x, y - getRandomInt(20, 51)], [x, y + getRandomInt(20, 51)]]);
}
segments.forEach(function (s) { drawLine(s[0], s[1]).strokeColor = 'blue'; });
var line = findStabber(segments);
if (line === null) {
  console.log('no stabbing line');
} else {
  drawLine([0, line.intercept], [600, line.slope * 600 + line.intercept]).strokeColor = 'red';
  var round = function (v) { return Math.round(v * 100) / 100; };
  console.log('stabber y = ' + round(line.slope) + '·x ' + (line.intercept < 0 ? '- ' : '+ ') + round(Math.abs(line.intercept)));
}
