var xs = range(60, 700, 80);
xs.forEach(function (x) {
  drawCircle({ center: [x, 180], radius: getRandomInt(10, 40) });
});
console.log(xs.length + ' circles');
