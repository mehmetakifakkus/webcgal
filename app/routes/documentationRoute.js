var express = require('express');
var router = express.Router();

router.get('/documentation', function(req, res) {

    var selfLocal = req.app.locals;

    req.app.locals.findandChange = function(str){
        var output = str, re_start = new RegExp('link_to\\(','gi'), re_end = new RegExp('link_to\\(([a-z]+\\/*)+\\)','gi'); // 'gi' is  global match and ignore case
        re_start.exec(str); re_end.exec(str);
        if(re_end.lastIndex){
            var linkName = str.substring(re_start.lastIndex, re_end.lastIndex - 1);
            var splitted = linkName.split("/"); 
            var replace = "<a href='/"+linkName+"'>"+splitted.pop()+"</a>"; 
            output = [str.slice(0, re_start.lastIndex-8), replace, str.slice(re_end.lastIndex)].join('');   
        }
        return output; 
    }
    
    req.app.locals.myConcat = function(list){
        var total = '';
        var sl = selfLocal;
        list.forEach(function(item){ 
            var res = sl.findandChange(item); 
            while(res != item){item = res; res = sl.findandChange(item);} 
            total += item;});
        return total;
    } 
    
    req.app.locals.someHelper = function(name){
        return ("hello " + name);
    }
    
  res.render('documentation', {
    pageTitle: 'Documentation',
    pageID: 'documentation',
    pageURL: req.originalUrl  
  });
});

router.get('/documentation/:item', function(req, res) {
  var text;   
  var data = req.app.get('documentsData');  
    
  data.objects.forEach(function(it){ // search in objects
    if(it.name == req.params.item){
         text = it.text;   
    }  
  });    
    
  data.functions.forEach(function(it){ // search in functions
    if(it.name == req.params.item){
         text = it.text;
    }
  });

  res.render('documentationItem', {
    pageTitle: req.params.item,
    pageID: req.params.item,
    pageText: text,
    pageURL: req.originalUrl  
  });
});




module.exports = router;
