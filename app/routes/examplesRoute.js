var express = require('express');
var router = express.Router();

router.get('/examples', function(req, res) {

 res.render('examplesPage', {
    pageTitle: 'Examples',
    pageID: 'examples'
  });
});



router.get('/examples/:item', function(req, res) {
  var name;
  var data = req.app.get('linkData');

  data.example_links.forEach(function(it){ // search in objects
    if(it.link == req.originalUrl){
         name = it.name;
    }
  });

  console.log(req.originalUrl.slice(1) + " will be opened.")

  res.render(req.originalUrl.slice(1), {
    pageTitle: name,
    pageID: req.params.item
  });

});



router.get('/examples/:item1/:item2', function(req, res) {
  var name;
  var data = req.app.get('linkData');

  data.dual_links.forEach(function(it){ // search in objects
    if(it.link == req.originalUrl){
         name = it.name;
    }
  });

  console.log(req.originalUrl.slice(1) + " will be opened.")

  res.render(req.originalUrl.slice(1), {
    pageTitle: name,
    pageID: req.params.item
  });

});


module.exports = router;

