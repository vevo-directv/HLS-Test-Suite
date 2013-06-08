//This module is in charge of augmenting a regular stream with
//byte range support.

module.exports = {
	start: function(expressApp, streamRegistry) {
		return new ByteRanger(expressApp, streamRegistry);
	}
};

function ByteRanger(expressApp, streamRegistry) {
	var that = this;

	//Core objects
	this.app = expressApp;
	this.streamRegistry = streamRegistry;
	
	//HTTP streams stack
	this.app.use("/streams", function(req, res, next) {
		that.applyByteRange(req, res, next);
	});
}

ByteRanger.prototype.updateSocket = function(socket) {
	var that = this;
	this.socket = socket;
}

ByteRanger.prototype.applyByteRange = function(req, res, next) {
	console.log("ByteRanger: checking if byte range is activated");
	next();
}