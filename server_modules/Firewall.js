//This provides functionality to disable certain variant streams
//from the master playlist.

module.exports = {
	start: function(expressApp, streamRegistry) {
		return new Firewall(expressApp, streamRegistry);
	}
};

function Firewall(expressApp, streamRegistry) {
	var that = this;

	//Core objects
	this.app = expressApp;
	this.streamRegistry = streamRegistry;
	
	//HTTP middleware
	this.app.use('/streams', function(req, res, next) {
		that.enforceAccessRules(req, res, next);
	});
}

Firewall.prototype.updateSocket = function(socket) {
	var that = this;
	this.socket = socket;
	
	//Event hookups
	this.socket.on('startStream', function(streamId) {
		console.log(streamId + "... UP");
		that.streamRegistry[streamId].status = true;
	});
	this.socket.on('stopStream', function(streamId) {
		console.log(streamId + "... DOWN");
		that.streamRegistry[streamId].status = false;
	});
} 

Firewall.prototype.enforceAccessRules = function(req, res, next) {
	if (!this.streamRegistry[req.HlsMetadata.streamId].status) {
		console.log("Firewall: attempting to access a disabled stream: " + req.HlsMetadata.streamId);
		res.send(404, "Not found");
	} else {
		next();
	}
}