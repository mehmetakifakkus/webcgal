var express = require('express');
var reload = require('reload');

var app = express();

app.set('port', process.env.PORT || 3000 );
app.set('view engine', 'ejs');
app.set('views', 'app/views');

app.locals.siteTitle = "WebCgal";
app.locals.appData = require('./data/data.json');
var docsData = require('./data/documentation.json');
app.locals.documentsData = docsData;
app.set('documentsData', docsData);

app.use('/static', express.static('app/public'));


app.get('/', function(req, res) {
        
 res.render('index', {
    pageTitle: 'Home',
    pageID: '/'  
  });
});

app.get('/examples', function(req, res) {
        
 res.render('examplesPage', {
    pageTitle: 'Examples',
    pageID: 'examples'  
  });
});

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