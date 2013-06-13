//This modules changes the Media Playlist URLs
//so that they point to the proxy server instead.

module.exports = {
	start: function(expressApp, streamRegistry) {
		return new ResourceProxy(expressApp, streamRegistry);
	}
};

function ResourceProxy(expressApp, streamRegistry) {
	var that = this;

	//Core objects
	this.app = expressApp;
	this.streamRegistry = streamRegistry;
	
	//HTTP middleware
	this.app.use('/streams', function(req, res, next) {
		that.redirectResources(req, res, next);
	});
}

ResourceProxy.prototype.updateSocket = function(socket) {
	var that = this;
	this.socket = socket;
} 

ResourceProxy.prototype.redirectResources = function(req, res, next) {
	if (req.HlsMetadata.isMediaPlaylist) {
		var lines = req.HlsMetadata.data;
		for (var i=0; i<lines.length; ++i) {
			if (lines[i][0] != "#") {
				lines[i] = req.HlsMetadata.streamId + "/" + lines[i]; //Modify the URL to the MediaSegment so we can intercept the requests
			}
		}
	}
	
	next();
}