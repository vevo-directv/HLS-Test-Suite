//This module is in charge of detecting which stream is being
//requested. It extracts the streamId and the correct uri
//to the stream's resource that is requested (.m3u8 or .ts, etc)

var url = require('url');

module.exports = {
	start: function(expressApp, streamRegistry) {
		return new Router(expressApp, streamRegistry);
	}
};

function Router(expressApp, streamRegistry) {
	var that = this;

	//Core objects
	this.app = expressApp;
	this.streamRegistry = streamRegistry;
	
	//HTTP streams stack
	this.app.use("/streams", function(req, res, next) {
		that.routeRequest(req, res, next);
	});
}

Router.prototype.updateSocket = function(socket) {
	var that = this;
	this.socket = socket;
}

Router.prototype.routeRequest = function(req, res, next) {

	req.HlsMetadata = {};
	var metadata = req.HlsMetadata;

	console.log("Router: Client requested URL: " + req.url);
	var tokens = url.parse(req.url).path.split("/"); //Remove http://hostname from url
	
	//Format of req.url should be http://hostname/streamId.m3u8 or http://hostname/streamId/SomeUrlToMediaSegment
	//Tokens should contain [streamId.m3u8] or [streamId, SomeUrlToMediaSegment]
	if (tokens.length == 2) {
		//We are getting the sub stream playlist, not a .ts
		metadata.streamId = tokens[1].split(".")[0];
		metadata.resource = ""; // No resource was requested because this is a media playlist request
	} else {
		//Getting a Media Segment
		metadata.streamId = tokens[1];
		
		var resourceUri = "";
		//Concatenate all the rest of the tokens together to form the complete resource uri
		for (var i=2; i<tokens.length; ++i) {
			resourceUri += tokens[i];
			if (i < tokens.length - 1) resourceUri += "/" //Reinsert the / that were taken out during the split
		}
		metadata.resource = resourceUri;
	}
	
	//console.log("Router: routed resource: " + metadata.resource);
	
	if (typeof this.streamRegistry[metadata.streamId] === 'undefined') {
		console.log("router: attempting to access non existing stream: " + metadata.streamId);
		res.send(404, "Not found");
	} else {
		next();
	}
}