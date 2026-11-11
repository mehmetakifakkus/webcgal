var polygon = createPolygon('triangle_set');
polygon.draw();
var ranges = monotoneDirections(polygon);
var text = ranges.length === 0 ? 'none' : ranges.map(function (r) {
  return r[0] === r[1] ? r[0].toFixed(1) : r[0].toFixed(1) + ' to ' + r[1].toFixed(1);
}).join(', ');
console.log('monotone directions: ' + text + ' (degrees; y-monotone: ' + isMonotone(polygon, 90) + ')');
