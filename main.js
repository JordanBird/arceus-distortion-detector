const video = document.querySelector('video');
const canvas = document.querySelector("canvas");

let worker;

let stream;
let recorder;

let isWatching = false;
let detected = false;
let timersRunning = false;

let dynamicTimerRunning = true;
let dynamicTimerPause = false;

let defaultScreenRatio = 3;
let dynamicTimerScreenRatio = 1;

let rectangles = [
  {
    name: "Space Time Distortion",
    rect: { left: 25, top: 10, width: 50, height: 15 },
    lookups: {
      all: [],
      any: [ "SPACE", "TIME", "DISTORTION" ],
      none: [ "SATCHEL", "ITEM", "FADED", "ANYTIME" ]
    },
    mode: "Space Time",
    dynamic: false
  },
  {
  name: "Overworld",
  rect: { left: 3, top: 75, width: 5, height: 8 },
  lookups: {
    all: [ "VO" ], //The dash we're monitoring is picked up as VO, so for now, we match VO
    any: [],
    none: []
  },
  mode: "Overworld",
  dynamic: true
},
{
  name: "Bottom Right",
  rect: { left: 75, top: 95, width: 25, height: 5 },
  lookups: {
    all: [],
    any: [ "EXIT", "BACK", "QUIT" ],
    none: []
  },
  mode: "Menu",
  dynamic: true
},
{
  name: "Top Left",
  rect: { left: 0, top: 0, width: 25, height: 7 },
  lookups: {
    all: [],
    any: [ "SATCHEL", "SAVE", "COMMUNICATIONS", "HELP" ],
    none: []
  },
  mode: "Menu",
  dynamic: true
},
{
  name: "Battle",
  rect: { left: 7, top: 82, width: 10, height: 7 },
  lookups: {
    all: [],
    any: [ "LV." ],
    none: []
  },
  mode: "Battle",
  dynamic: true
}];

let currentMode = "";

async function initWorker() {
  worker = await Tesseract.createWorker();
  await worker.loadLanguage('eng');
  await worker.initialize('eng');
}

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

  $('#dynamicswitch').on('change', function (e) {
    e.preventDefault();

    dynamicTimerRunning = $(this).is(":checked");
  });

  $('.toggle-debug-visibility').on('click', function (e) {
    e.preventDefault();

    toggleDebugControls();
  });
}

async function startTesseract() {
  if (!isWatching) {
    return;
  }

  var anyMatch = false;
  for (let i = 0; i < rectangles.length; i++) {
    if (!dynamicTimerRunning && rectangles[i].dynamic) {
      continue;
    }

    let result;
    if (dynamicTimerRunning) {
      result = await worker.recognize(canvas, { rectangle: percentageRectangleToTesseractRectangle(rectangles[i].rect) });
    }
    else {
      result = await worker.recognize(canvas);
    }

    var matched = processText(result.data.text, rectangles[i].lookups);
    if (matched) {
      anyMatch = true;

      updateMode(rectangles[i].mode);
    }
  }

  if (!anyMatch) {
    //Do something, maybe game isn't running? Cutscene? Loading? Accurate enough to stop timer in this case?
    //updateMode("Unknown");
  }

  if (isWatching) {
    watchTick();
  }
}

function processText(text, lookups) {
  text = text.toUpperCase();

  for (let i = 0; i < lookups.none.length; i++) {
    if (text.indexOf(lookups.none[i]) > -1) {
      return false;
    }
  }

  for (let i = 0; i < lookups.all.length; i++) {
    if (text.indexOf(lookups.all[i]) == -1) {
      return false;
    }
  }

  if (lookups.all.length > 0) {
    return true;
  }

  for (let i = 0; i < lookups.any.length; i++) {
    if (text.indexOf(lookups.any[i]) > -1) {
      return true;
    }
  }

  return false;
}

function updateMode(mode) {
  if (currentMode == mode) {
    return;
  }

  currentMode = mode;

  switch (mode) {
    case "Space Time":
      $('.tracker-card').removeClass('battle-mode');
      $('.tracker-card').removeClass('unknown-mode');
      $('.tracker-card').removeClass('menu-mode');

      dynamicTimerPause = false;

      onDetected();
      return;
    case "Overworld":
      $('.tracker-card').removeClass('battle-mode');
      $('.tracker-card').removeClass('unknown-mode');
      $('.tracker-card').removeClass('menu-mode');

      dynamicTimerPause = false;
      return;
    case "Menu":
      $('.tracker-card').removeClass('battle-mode');
      $('.tracker-card').removeClass('unknown-mode');
      $('.tracker-card').addClass('menu-mode');
  
      dynamicTimerPause = true;
      return;
    case "Battle":
      $('.tracker-card').removeClass('menu-mode');
      $('.tracker-card').removeClass('unknown-mode');
      $('.tracker-card').addClass('battle-mode');

      dynamicTimerPause = true;
      return;
    case "Unknown":
      $('.tracker-card').removeClass('menu-mode');
      $('.tracker-card').removeClass('battle-mode');
      $('.tracker-card').addClass('unknown-mode');

      dynamicTimerPause = false;
      return;
    default:
        dynamicTimerPause = false;
        return;
  }
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
    .then(async (imageBitmap) => {
      canvas.width = imageBitmap.width;

      if (dynamicTimerRunning) {
        canvas.height = imageBitmap.height / dynamicTimerScreenRatio; //When we're not running in dynamic mode, speed up OCR by a different ratio
      }
      else {
        canvas.height = imageBitmap.height / defaultScreenRatio;
      }

      // /3 to make faster and only monitor top of screen.
      canvas.getContext("2d").drawImage(imageBitmap, 0, 0);
      canvas.classList.remove("hidden");

      await startTesseract();
    })
    .catch((error) => {
      console.error("watchTick() error: ", error);

      setTimeout(watchTick, 500);
    });
}

function isSpaceTime(match) {
  var normalisedMatch = match.toUpperCase();

  var lookups = getLookupResults(normalisedMatch, [
    { lookup: "SPACE", matched: false },
    { lookup: "TIME", matched: false },
    { lookup: "DISTORTION", matched: false }
  ]);

  if (lookups.every(x => x.matched)) {
    return true; //100% Confident
  }

  var excludes = getLookupResults(normalisedMatch, [
    { lookup: "SATCHEL", matched: false }
  ]);

  if (excludes.some(x => x.matched)) {
    return false;
  }

  if (lookups.filter(x => x.matched).length > 1) {
    return true;
  }

  return false;
}

function isMenu(match) {
  var normalisedMatch = match.toUpperCase();

  var lookups = getLookupResults(normalisedMatch, [
    // Stachel: 
    { "lookup": "SATCHEL", "matched": false },
    { "lookup": "EVERYDAY ITEMS", "matched": false },
    { "lookup": "CHECK SUMMARY", "matched": false },
    // Save:
    { "lookup": "Save", "matched": false },
    { "lookup": "PLAY TIME", "matched": false },
    { "lookup": "CURRENT TIME", "matched": false },
    { "lookup": "CURRENT LOCATION", "matched": false },
    // Communications:
    { "lookup": "COMMUNICATIONS", "matched": false },
    { "lookup": "FOUND", "matched": false },
    { "lookup": "MYSTERY", "matched": false },
    // Help:
    { "lookup": "HELP", "matched": false },
    { "lookup": "SURVEY TIPS", "matched": false },
    { "lookup": "GAME CONTROLS", "matched": false },
    { "lookup": "SETTINGS", "matched": false },
    // Map:
    { "lookup": "MAP", "matched": false },
    { "lookup": "CHOOSE DESTINATION", "matched": false },
    { "lookup": "MISSIONS", "matched": false },
    { "lookup": "GO HERE", "matched": false },
    { "lookup": "HISUI", "matched": false },
    // Pokedex:
    { "lookup": "SEEN", "matched": false },
    { "lookup": "CAUGHT", "matched": false },
    { "lookup": "MEMBER", "matched": false }
  ]);

  //Move Info
  //Back?
  //Yes
  //No
  //run away
  //Fight
  //Run

  return lookups.some(x => x.matched);
}

function isBattle(match) {
  var normalisedMatch = match.toUpperCase();

  var lookups = getLookupResults(normalisedMatch, [
    // Battle:
    { "lookup": "ACTION", "matched": false },
    { "lookup": "ORDER", "matched": false }
  ]);

  return lookups.some(x => x.matched);
}

function getLookupResults(lookupTerm, lookups) {
  for (var i = 0; i < lookups.length; i++) {
    lookups[i].matched = lookupTerm.indexOf(lookups[i].lookup) > -1;
  }

  return lookups;
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
  
  if (dynamicTimerPause) {
    setTimeout(function () {
      tickTimer(element);
    }, 1000);
    
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

function twoDigits(n) {
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

function renderDebugRectangles() {
  $('.video-container .debug-rectangle').remove();

  for (var i = 0; i < rectangles.length; i++) {
    $('.video-container').append(
      $('<div>')
        .addClass('debug-toggle')
        .addClass('debug-rectangle')
        .css('position', 'absolute')
        .css('top', rectangles[i].rect.top + '%')
        .css('left', rectangles[i].rect.left + '%')
        .css('width', rectangles[i].rect.width + '%')
        .css('height', rectangles[i].rect.height + '%')
        .css('background-color', 'red')
        .css('opacity', '0.25')
      );
  }
}

function toggleDebugControls() {
  $('.debug-toggle').toggle();
}

function percentageRectangleToTesseractRectangle(rect) {
  var width = canvas.width / 100;
  var height = canvas.height / 100;

  return { left: rect.left * width, top: rect.top * height, width: rect.width * width, height: rect.height * height };
}

function init() {
  initWorker();
  
  initEvents();

  initTimers();

  renderDebugRectangles();

  toggleDebugControls();
}

$(document).ready(init);