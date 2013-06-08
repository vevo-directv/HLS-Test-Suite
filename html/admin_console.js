var socket = io.connect('http://' + window.location.host);

socket.on('updateStreamStatus', function(data) {
	updateStreamStatus(data.id, data.status);
});

socket.on('updateStreamList', updateStreamList);

socket.on('updateLoadedMasterUri', updateLoadedMasterUri);

$("document").ready(function() {
	//Hook up load master playlist button
	$("#loadMaster").click(function () {
		var masterUri = $("#master").val();
		socket.emit('loadMasterPlaylist', masterUri);
	});
	
	socket.emit('getStreamList');
	socket.emit('getLoadedMasterUri');
});

function stopStream(streamId) {
	socket.emit('stopStream', streamId);
	socket.emit('getStreamStatus', streamId);
}

function startStream(streamId) {
	socket.emit('startStream', streamId);
	socket.emit('getStreamStatus', streamId);
}

function updateStreamStatus(streamId, isEnabled) {
	if (isEnabled) {
		$("#" + streamId).find(".startButton").attr("disabled", "disabled");
		$("#" + streamId).find(".stopButton").removeAttr("disabled");
	} else {
		$("#" + streamId).find(".startButton").removeAttr("disabled");
		$("#" + streamId).find(".stopButton").attr("disabled", "disabled");
	}
	
}

function updateLoadedMasterUri(uri) {
	if (uri == "") {
		uri = "Type the URL of the master playlist you would like to wrap here, and click \"Load\".";
	} else {
		$("#proxyLink").html("USE THIS LINK TO ACCESS THE WRAPPED STREAM: " + "<a href=\"master.m3u8\">http://" + window.location.host + "/master.m3u8</a>");
	}
	$("#master").val(uri);
}

function updateStreamList(streams) {

	var $streamContainer = $("#streamContainer");
	$streamContainer.html("");

	for (var streamId in streams) {
		console.log(streams[streamId]);
		
		$streamContainer.append(
			"<div class=\"stream\" id=\"" + streamId + "\">\n" +
				"<span>" + streams[streamId].uri + ":\t</span><span class=\"streamId\"></span><button class=\"startButton\"" + 
				(streams[streamId].status ? "disabled=\"disabled\"" : "") + ">Start</button><button class=\"stopButton\"" + 
				(!streams[streamId].status ? "disabled=\"disabled\"" : "") + ">Stop</button>\n" +
			"</div>");
			
		//Initialize button handlers
		var $startButton = $("#" + streamId).find(".startButton");
		var $stopButton = $("#" + streamId).find(".stopButton");
	
		$startButton.click(function() {
			startStream($(this).parent().attr("id"));
		});
		
		$stopButton.click(function() {
			stopStream($(this).parent().attr("id"));
		});
		
		socket.emit('getLoadedMasterUri');
	}
}
