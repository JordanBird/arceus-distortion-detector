const video = document.querySelector('video');
const canvas = document.querySelector("canvas");

let stream;
let recorder;

let isWatching = false;
let detected = false;
let timersRunning = false;

function initEvents() {
  $('.detect-toggle').on('click', async function (e) {
    e.preventDefault();

    if (!isWatching) {
      // Prompt the user to share their screen.
      stream = await navigator.mediaDevices.getDisplayMedia();
      recorder = new MediaRecorder(stream);
      // Preview the screen locally.
      video.srcObject = stream;
    
      startWatching();

      $(this).html("Stop Detecting");
    }
    else {
      stream.getTracks().forEach(track => track.stop());
      video.srcObject = null;
      
      stopWatching();

      $(this).html("Start Detecting");
    }
  });

  $('.dimiss-alert').on('click', function (e) {
    e.preventDefault();

    dismissDetection();
  });

  $('.toggle-timer').on('click', function (e) {
    e.preventDefault();

    timersRunning = !timersRunning;

    if (!timersRunning) {
      $(this).html("Start Timer");

      return;
    }
    
    $(this).html("Pause Timer");

    startTimers();
  });

  $('.stop-timer').on('click', function (e) {
    e.preventDefault();

    timersRunning = false;

    initTimers();
  });
}

function doTesStream() {
  if (!isWatching) {
    return;
  }

  Tesseract
    .recognize(canvas, 'eng', { logger: m => $('.parseProgress').html(m.progress) })
    .then(({ data: { text } }) => {
      $('.parsedText').html(text);

      if (isSpaceTime(text)) {
        onDetected();
      }

      if (isWatching) {
        watchTick();
      }
  })
}

function startWatching() {
  isWatching = true;
  watchTick();
}

function stopWatching() {
  isWatching = false;
}

function watchTick() {
  var tracks = stream.getVideoTracks();
    if (tracks == null || tracks.length == 0) {
      setTimeout(watchTick, 500);

      return;
    }

    new ImageCapture(tracks[0]).grabFrame()
    .then((imageBitmap) => {
      canvas.width = imageBitmap.width;
      canvas.height = imageBitmap.height / 3; // /3 to make faster and only monitor top of screen.
      canvas.getContext("2d").drawImage(imageBitmap, 0, 0);
      canvas.classList.remove("hidden");

      doTesStream();
    })
    .catch((error) => {
      console.error("watchTick() error: ", error);

      setTimeout(watchTick, 500);
    });
}

function isSpaceTime(match) {
  return match.toUpperCase().indexOf("SPACE") > -1 && match.toUpperCase().indexOf("TIME") > -1;
}

function initTimers() {
  var timers = $('[data-countdown]');
  for (var i = 0; i < timers.length; i++) {
    $(timers[i]).data('countdown-elapsed', 0);

    var totalTime = parseInt($(timers[i]).data('countdown'));
    var elapsedTime = parseInt($(timers[i]).data('countdown-elapsed'));

    $(timers[i]).html(getTimerText(totalTime, elapsedTime));
  }

  $('.toggle-timer').html("Start Timer");
}

function startTimers() {
  timersRunning = true;

  var timers = $('[data-countdown]');
  for (var i = 0; i < timers.length; i++) {
    tickTimer(timers[i]);
  }
}

function tickTimer(element) {
  if (!timersRunning) {
    return;
  }

  var totalTime = parseInt($(element).data('countdown'));
  var elapsedTime = parseInt($(element).data('countdown-elapsed'));

  $(element).html(getTimerText(totalTime, elapsedTime));

  $(element).data('countdown-elapsed', elapsedTime + 1);

  setTimeout(function () {
    tickTimer(element);
  }, 1000);
}

function getTimerText(totalTimeInMinutes, elapsedTimeInSeconds) {
  var remainingTime = (totalTimeInMinutes * 60) - elapsedTimeInSeconds;
  if (remainingTime <= 0) {
    return "00:00";
  }
  
  time = new Date(remainingTime * 1000);
  hours = time.getUTCHours();
  mins = time.getUTCMinutes();

  return (hours ? hours + ':' + twoDigits(mins) : mins) + ':' + twoDigits(time.getUTCSeconds());
}

function twoDigits(n)
{
    return (n <= 9 ? "0" + n : n);
}

function onDetected() {
  detected = true;

  alertUser();
}

function dismissDetection() {
  detected = false;

  $('.detector-alert').hide();

  document.title = "Space-time Distortions Detector";
}

function alertUser() {
  if (!detected) {
    return;
  }

  $('.detector-alert').show();

  var text = "Space-time Distortions Detector";
  if (new Date().getSeconds() % 2 == 0) {
    text = "--DETECTED--";
  }

  document.title = text;

  setTimeout(function () {
    alertUser();
  }, 500);
}

function init() {
  initEvents();

  initTimers();
}

$(document).ready(init);