//This module contains all the processing required to load the master playlist,
//parse the links to the variant streams, and provide a proxy address for the master
//playlist file.

module.exports = {
	start: function(expressApp, streamRegistry) {
		return new MasterPlaylistHandler(expressApp, streamRegistry);
	}
};

var http = require('http');

function MasterPlaylistHandler(expressApp, streamRegistry) {
	var that = this;

	//Core objects
	this.app = expressApp;
	this.streamRegistry = streamRegistry;
	
	//Class variables
	this.masterUri = "";
	this.baseRemoteUri = "";
	this.masterLines = new Array();
	
	//HTTP redirections
	this.app.get('/master.m3u8', function(req, res) {
		that.masterFileProxy(req, res);
	});
}

MasterPlaylistHandler.prototype.updateSocket = function(socket) {
	var that = this;
	this.socket = socket;
	
	//Event hookups
	this.socket.on('loadMasterPlaylist', function(uri) {
		that.loadMasterPlaylist(uri);
	});
	this.socket.on('getLoadedMasterUri', function() {
		that.socket.emit('updateLoadedMasterUri', that.masterUri);
	});
} 

//Handles http://hostname/master.m3u8
MasterPlaylistHandler.prototype.masterFileProxy = function(req, res) {
	if (this.masterLines.length == 0) {
		res.send(404, "Not found");
	} else {
	
		res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
		res.setHeader("Cache-Control", "no-cache");
		
		var masterFile = "";
		for (var i=0; i<this.masterLines.length; ++i) {
			masterFile += this.masterLines[i] + "\n";
		}
		
		res.send(200, masterFile);
		console.log("Accessing master");
	}
}

MasterPlaylistHandler.prototype.clearData = function() {
	this.masterUri = "";
	this.baseRemoteUri = "";
	this.masterLines = new Array();
	
	for (prop in this.streamRegistry) {
		delete this.streamRegistry[prop];
	}
}

MasterPlaylistHandler.prototype.loadMasterPlaylist = function(uri) {
	var that = this;
	
	this.clearData();
	this.masterUri = uri;
	
	var lastSlash = this.masterUri.lastIndexOf('/');
	this.baseRemoteUri = this.masterUri.substr(0, lastSlash+1);
	console.log("Base URI: " + this.baseRemoteUri);
	
	var currentLine = "";
	
	http.get(this.masterUri, function(res) {
	  res.setEncoding('utf8');
	  res.on('data', function(chunk) {
		//Seperate lines
		for (var i=0; i<chunk.length; ++i) {
			if (chunk[i].search(/[^\r\n]/) >= 0) {
				currentLine += chunk[i];
			} else if (chunk[i].search(/$/) >= 0 && currentLine.length != 0) {
				console.log("Line: " + currentLine);
				that.masterLines.push(currentLine);
				currentLine = ""
			}
		}
	  }).on('end', function() {
		if (currentLine.length > 0) that.masterLines.push(currentLine);
		that.parseVariantStreams();
	  });
	}).on('error', function(e) {
	  console.log("Got error: " + e.message);
	});
	
}

MasterPlaylistHandler.prototype.parseVariantStreams = function() {
	for (var i=0; i<this.masterLines.length; ++i) {
	
		var line = this.masterLines[i];
	
		if (line[0] == '#') {
			continue;
		}
		
		var currentStream = {};
		var streamId = "stream" + (Object.keys(this.streamRegistry).length + 1);
		
		if (line.search(/:\/\//) >= 0) {
			currentStream.uri = line; //absolute uri, use as is
		} else {
			currentStream.uri = this.baseRemoteUri + line;
		}
		currentStream.status = false;
		
		
		this.streamRegistry[streamId] = currentStream;
		
		console.log("Creating new stream at URI: " + currentStream.uri);
		
		this.masterLines[i] = "streams/" + streamId + ".m3u8";
	}
	
	this.socket.emit('updateStreamList', this.streamRegistry);
}