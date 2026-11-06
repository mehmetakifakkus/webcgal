var express = require('express');
var router = express.Router();

// Algorithm pages that have no entry in linkData but still have a view.
var extraPages = {
  '/algorithms/duality': 'Duality'
};

// Looks up the page title for a known algorithm URL; returns undefined for
// unknown URLs so they can be answered with 404 instead of a render error.
function findPageName(data, path) {
  if (extraPages.hasOwnProperty(path)) return extraPages[path];

  var lists = [data.example_links, data.dual_links];
  for (var i = 0; i < lists.length; i++) {
    for (var j = 0; j < lists[i].length; j++) {
      if (lists[i][j].link == path) return lists[i][j].name;
    }
  }
}

function renderAlgorithm(req, res, next, viewPath) {
  var name = findPageName(req.app.get('linkData'), '/' + viewPath);
  if (name === undefined) return next(); // falls through to Express 404

  res.render(viewPath, {
    pageTitle: name,
    pageID: req.params.item1 || req.params.item
  });
}

router.get('/algorithms', function(req, res) {
  res.render('algorithmsPage', {
    pageTitle: 'Algorithm',
    pageID: 'algorithms'
  });
});

router.get('/algorithms/:item', function(req, res, next) {
  renderAlgorithm(req, res, next, 'algorithms/' + req.params.item);
});

router.get('/algorithms/:item1/:item2', function(req, res, next) {
  renderAlgorithm(req, res, next, 'algorithms/' + req.params.item1 + '/' + req.params.item2);
});

module.exports = router;
