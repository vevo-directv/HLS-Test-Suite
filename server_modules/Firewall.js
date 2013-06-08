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