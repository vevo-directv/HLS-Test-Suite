//This module is in charge of providing information to the client such as:
//status of streams, stream lists, etc

module.exports = {
	start: function(expressApp, streamRegistry) {
		return new Informer(expressApp, streamRegistry);
	}
};

function Informer(expressApp, streamRegistry) {
	var that = this;

	//Core objects
	this.app = expressApp;
	this.streamRegistry = streamRegistry;
}

Informer.prototype.updateSocket = function(socket) {
	var that = this;
	this.socket = socket;
	
	//Event hookups
	this.socket.on('getStreamStatus', function(streamId) {
		that.socket.emit('updateStreamStatus', { id : streamId, status : that.streamRegistry[streamId].status});
	});
	this.socket.on('getStreamList', function() {
		console.log("Emitting stream list");
		that.socket.emit('updateStreamList', that.streamRegistry);
	});
} 