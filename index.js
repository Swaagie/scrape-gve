'use strict';

var restify = require('restify')
  , scraper = require('./scraper')
  , fs = require('fs');

var server = restify.createServer()
  , port = process.env.PORT || 8080;

//
// Run scraper every 2 minutes.
//
var job = setInterval(scraper.run, 120000);
scraper.run();

//
// Start server to respond with JSON.
//
server.name = 'Scraper';
server.get('/', function respond(req, res, next) {
  try {
    res.json(scraper.projects);
  } catch(e) {
    res.send('Error parsing results!');
  }

  next();
});

server.listen(port, function() {
  console.log('%s listening at %s', server.name, server.url);
});