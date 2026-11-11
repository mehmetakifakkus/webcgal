// five vertical segments at fixed x positions, with random heights
var segments = [];
for (var x = 100; x <= 500; x += 100) {
  var low = getRandomInt(80, 260);
  segments.push([[x, low], [x, low + getRandomInt(30, 120)]]);
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
