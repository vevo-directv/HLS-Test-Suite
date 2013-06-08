var express = require('express');
var app = express()
  , http = require('http')
  , server = http.createServer(app)
  , io = require('socket.io').listen(server, { log: false });
var url = require('url');

//Setup HTTP server
var socket;
var port = 8081;
server.listen(port, '0.0.0.0'); 
console.log("Server running on port " + port.toString());

//Bind static HTML/js files
app.use(express.static(__dirname + '/html'));
app.get('/', function (req, res) {
  res.sendfile(__dirname + '/html/admin_console.html');
});

//The stream registry where all information about the streams
//will eventually go
var streamRegistry = {}

//Load server modules
var modules = [
	require('./server_modules/Firewall.js').start(app, streamRegistry),
	require('./server_modules/Informer.js').start(app, streamRegistry),
	require('./server_modules/MasterPlaylistHandler.js').start(app, streamRegistry),
	require('./server_modules/MediaPlaylistHandler.js').start(app, streamRegistry)
];

//Hookup the socket.io socket with all the modules
io.sockets.on('connection', function (s) {  

  for (var i=0; i<modules.length; ++i) {
	modules[i].updateSocket(s);
  }
  
});