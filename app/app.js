var express = require('express');
var reload = require('reload');

var app = express();

app.set('port', process.env.PORT || 3000 );
//app.set('views',  'app/views');
app.set('views',  __dirname+'/views');
app.set('view engine', 'ejs');

app.locals.siteTitle = "WebCgal";

app.locals.linkData =  require('./data/linkData.json');
app.set('linkData', app.locals.linkData);

app.locals.docsData = require('./data/documentationData.json')
app.set('docsData', app.locals.docsData);

app.use('/static', express.static(__dirname+'/public'));


app.get('/', function(req, res) {
        
 res.render('index', {
    pageTitle: 'Home',
    pageID: ''  
  });
});


app.use(require('./routes/algorithmsRoute'));
app.use(require('./routes/documentationRoute'));


app.get('/playground', function(req, res) {
        
 res.render('playground', {
    pageTitle: 'Playground',
    pageID: 'playground'  
  });
});

app.get('/duality', function(req, res) {
        
 res.render('dualityPage', {
    pageTitle: 'Duality',
    pageID: 'duality'  
  });
});

app.get('/smallestEnclosingDisk', function(req, res) {

  res.render('smallestEnclosingDisk', {
    pageTitle: 'Smallest Enclosing Disk',
    pageID: 'smallestEnclosingDisk'  
  });
});

//app.get('/', function(req, res) {
//  var info = '';
//  dataFile.links.forEach(function(item) {
//    info += `
//    <li>
//      <h2>${item.name}</h2>
//      
//      <a href=${item.link}>
//            <img src=${item.image} height="100px" style="float:left; margin:5px; border: padding:5px; border:1px solid #021a40;">
//      </a>
//
//        <p>${item.description}</p>
//    </li>
// <br>
//    `;
//  });
//info += '<link rel="stylesheet" type="text/css" href="css/style.css">';
//      
//  res.send(`
//      <h1>Akif's Javascript Apps Lab </h1>
//      ${info}
//      <script src="/reload/reload.js"></script>
//  `);
//});

var server = app.listen(app.get('port'), function() {
  console.log('Listening on port ' + app.get('port'));
});

reload(server, app);
