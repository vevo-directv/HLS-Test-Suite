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

//The stream registry where all information about the streams
//will eventually go. Available to all modules.
var streamRegistry = {}

//Load server modules
var modules = [
	//The order of these modules does not matter
	require('./server_modules/Informer.js').start(app, streamRegistry),
	require('./server_modules/MasterPlaylistHandler.js').start(app, streamRegistry),
	
	//The order of these modules MATTERS. It describes the processing order of the HTTP requests
	require('./server_modules/Router.js').start(app, streamRegistry),
	require('./server_modules/Firewall.js').start(app, streamRegistry),
	require('./server_modules/ResourceHandler.js').start(app, streamRegistry),
	require('./server_modules/ByteRanger.js').start(app, streamRegistry),
	require('./server_modules/Encrypter.js').start(app, streamRegistry),
	require('./server_modules/ResourceProxy.js').start(app, streamRegistry),
	require('./server_modules/VersionChecker.js').start(app, streamRegistry),
	require('./server_modules/Transmitter.js').start(app, streamRegistry)
];

//Bind static HTML/js files
app.get('/', function (req, res) {
  res.sendfile(__dirname + '/html/admin_console.html');
});
app.use(express.static(__dirname + '/html'));

//Hookup the socket.io socket with all the modules
io.sockets.on('connection', function (s) {  

  for (var i=0; i<modules.length; ++i) {
	modules[i].updateSocket(s);
  }
  
});
