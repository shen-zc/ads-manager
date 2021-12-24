import { VASTClient, VASTTracker } from 'vast-client';

var AdsManager = function(adContainer) {

  if(!(adContainer instanceof Element || adContainer instanceof HTMLDocument)) {
    throw new Error('ad container is not defined');
  }

  this._version = '1.0.0';

  // Ad Container
  this._adContainer = adContainer;

  // Slot
  this._slot = null;
  // Video Slot
  this._videoSlot = null;
  // Create Video Slot
  //this.createVideoSlot();

  // Create Slot
  this.createSlot();

  this.EVENTS = {
    AdsManagerLoaded: "AdsManagerLoaded", // After success ad request, when vast xml is parsed and ready
    AdStarted: "AdStarted", //
    AdStopped: "AdStopped", //
    AdSkipped: "AdSkipped", //
    AdLoaded: "AdLoaded", //
    AdLinearChange: "AdLinearChange",
    AdSizeChange: "AdSizeChange",
    AdExpandedChange: "AdExpandedChange",
    AdSkippableStateChange: "AdSkippableStateChange",
    AdDurationChange: "AdDurationChange",
    AdRemainingTimeChange: "AdRemainingTimeChange",
    AdVolumeChange: "AdVolumeChange",
    AdImpression: "AdImpression", //
    AdClickThru: "AdClickThru",
    AdInteraction: "AdInteraction",
    AdVideoStart: "AdVideoStart", //
    AdVideoFirstQuartile: "AdVideoFirstQuartile", //
    AdVideoMidpoint: "AdVideoMidpoint", //
    AdVideoThirdQuartile: "AdVideoThirdQuartile", //
    AdVideoComplete: "AdVideoComplete", //
    AdUserAcceptInvitation: "AdUserAcceptInvitation",
    AdUserMinimize: "AdUserMinimize",
    AdUserClose: "AdUserClose",
    AdPaused: "AdPaused",
    AdPlaying: "AdPlaying",
    AdError: "AdError",
    AdLog: "AdLog",
    AllAdsCompleted: "AllAdsCompleted" // After all ads completed, vast, vpaid, vmap
  };
  this._eventCallbacks = {};
  this._creativeEventCallbacks = {};

  this._attributes = {
    width : 300,
    height : 154,
    viewMode : 'normal',
    desiredBitrate : 268,
    duration : 10,
    remainingTime : 10,
    currentTime : 0
  }

  this._vastClient = null;
  this._vastTracker = null;

  this._ad = null;
  this._creative = null;
  this._mediaFiles = null;
  this._mediaFileIndex = 0;
  this._mediaFile = null;

  this._isVPAID = false;
  this._vpaidCreative = null;
  this._vpaidProgressCounter = null;

  this.SUPPORTED_CREATIVE_VPAID_VERSION_MIN = 2;

  this._nextQuartileIndex = 0;
  this._hasImpression = false;
  this._hasStarted = false;
}
AdsManager.prototype.getVersion = function() {
  return this._version;
}
AdsManager.prototype.createSlot = function() {
  this._slot = document.createElement('div');
  this._slot.style.position = 'absolute';
  this._slot.style.display = 'none';
  this._adContainer.appendChild(this._slot);
  this.createVideoSlot();
}
AdsManager.prototype.removeSlot = function() {
  this._slot.parentNode.removeChild(this._slot);
  this.createSlot();
}
AdsManager.prototype.showSlot = function() {
  console.log('show slot');
  // Check if video slot has src, if no then hide video slot
  if(this._videoSlot.src === '') {
    this.hideVideoSlot();
  }
  // Show slot
  this._slot.style.display = 'block';
}
AdsManager.prototype.resizeSlot = function(width, height) {
  this._slot.style.width = width + 'px';
  this._slot.style.height = height + 'px';
}
AdsManager.prototype.createVideoSlot = function() {
  this._videoSlot = document.createElement('video');
  this._videoSlot.setAttribute('webkit-playsinline', true);
  this._videoSlot.setAttribute('playsinline', true);
  //this._videoSlot.setAttribute('preload', 'none');
  this._videoSlot.style.width = '100%';
  this._videoSlot.style.height = '100%';
  this._videoSlot.style.backgroundColor = 'rgb(0, 0, 0)';
  //this._adContainer.appendChild(this._videoSlot);
  this._slot.appendChild(this._videoSlot);
}
AdsManager.prototype.hideVideoSlot = function() {
  this._videoSlot.style.display = 'none';
}
/*
AdsManager.prototype.removeVideoSlot = function() {
    this._videoSlot.parentNode.removeChild(this._videoSlot);
    this.createVideoSlot();
}
 */
AdsManager.prototype.updateVPAIDProgress = function() {
  // Check remaining time
  this._attributes.remainingTime = this._isCreativeFunctionInvokable("getAdRemainingTime") ? this._vpaidCreative.getAdRemainingTime() : -1;
  console.log('getAdRemainingTime', this._attributes.remainingTime);
  if(!isNaN(this._attributes.remainingTime) && this._attributes.remainingTime != 1) {
    this._attributes.currentTime = this._attributes.duration - this._attributes.remainingTime;
    // Track progress
    this._vastTracker.setProgress(this._attributes.currentTime);
  }
}
AdsManager.prototype.startVPAIDProgress = function() {
  var that = this;
  console.log('start vpaid progress');
  if(this._vpaidProgressCounter) {
    clearInterval(this._vpaidProgressCounter);
    this._vpaidProgressCounter = null;
  }
  this._vpaidProgressCounter = setInterval(function() {
    if(that._isVPAID && that._vpaidCreative && that._vastTracker) {
      that.updateVPAIDProgress();
    } else {
      console.log('stop VPAID progress');
      that.stopVPAIDProgress();
    }
  }, 1000);
}
AdsManager.prototype.stopVPAIDProgress = function() {
  console.log('stop VPAID progress > executed');
  if(this._vpaidProgressCounter) {
    clearInterval(this._vpaidProgressCounter);
    this._vpaidProgressCounter = null;
  }
}
AdsManager.prototype.addEventListener = function(eventName, callback, context) {
  console.log('subscribe for event', eventName);
  var givenCallback = callback.bind(context);
  this._eventCallbacks[eventName] = givenCallback;
}
AdsManager.prototype.removeEventListener = function(eventName) {
  this._eventCallbacks[eventName] = null;
}
AdsManager.prototype.onAdsManagerLoaded = function() {
  console.log('onAdsManagerLoaded');
  if (this.EVENTS.AdsManagerLoaded in this._eventCallbacks) {
    if(typeof this._eventCallbacks[this.EVENTS.AdsManagerLoaded] === 'function') {
      this._eventCallbacks[this.EVENTS.AdsManagerLoaded]();
    }
  }
}
AdsManager.prototype.onAdLoaded = function() {
  console.log('onAdLoaded', this._creative);
  if (this.EVENTS.AdLoaded in this._eventCallbacks) {
    if(typeof this._eventCallbacks[this.EVENTS.AdLoaded] === 'function') {
      this._eventCallbacks[this.EVENTS.AdLoaded](this._creative);
    }
  }
}
AdsManager.prototype.onAdDurationChange = function() {
  console.log('onAdDurationChange');
  if(this._isVPAID && this._vpaidCreative && this._vastTracker) {
    this._attributes.duration = this._isCreativeFunctionInvokable("getAdDuration") ? this._vpaidCreative.getAdDuration() : -1;
    console.log('update tracker with new duration', this._attributes.duration);
    if(this._attributes.duration != -1) {
      this._vastTracker.setDuration(this._attributes.duration);
    }
  }
  if (this.EVENTS.AdDurationChange in this._eventCallbacks) {
    if(typeof this._eventCallbacks[this.EVENTS.AdDurationChange] === 'function') {
      this._eventCallbacks[this.EVENTS.AdDurationChange]();
    }
  }
}
AdsManager.prototype.onAdSizeChange = function() {
  console.log('onAdSizeChange');
  if (this.EVENTS.AdSizeChange in this._eventCallbacks) {
    if(typeof this._eventCallbacks[this.EVENTS.AdSizeChange] === 'function') {
      this._eventCallbacks[this.EVENTS.AdSizeChange]();
    }
  }
}
AdsManager.prototype.onAdStarted = function() {
  console.log('onAdStarted', this._videoSlot.src);
  // Show ad slot
  this.showSlot();

  if (this.EVENTS.AdStarted in this._eventCallbacks) {
    if(typeof this._eventCallbacks[this.EVENTS.AdStarted] === 'function') {
      this._eventCallbacks[this.EVENTS.AdStarted]();
    }
  }
}
AdsManager.prototype.onAdVideoStart = function() {
  console.log('onAdVideoStart');
  if(this._isVPAID && this._vpaidCreative && this._vastTracker) {
    this.updateVPAIDProgress();
  }
  if (this.EVENTS.AdVideoStart in this._eventCallbacks) {
    if(typeof this._eventCallbacks[this.EVENTS.AdVideoStart] === 'function') {
      this._eventCallbacks[this.EVENTS.AdVideoStart]();
    }
  }
}
AdsManager.prototype.onAdStopped = function() {
  console.log('onAdStopped > remove ad from UI');
  if (this.EVENTS.AdStopped in this._eventCallbacks) {
    if(typeof this._eventCallbacks[this.EVENTS.AdStopped] === 'function') {
      this._eventCallbacks[this.EVENTS.AdStopped]();
    }
  }
  // Then destroy ad, unsubscribe and e.t.c
  this.destroyAd();
}
AdsManager.prototype.onAdSkipped = function() {
  console.log('onAdSkipped');
  if (this.EVENTS.AdSkipped in this._eventCallbacks) {
    if(typeof this._eventCallbacks[this.EVENTS.AdSkipped] === 'function') {
      this._eventCallbacks[this.EVENTS.AdSkipped]();
    }
  }
  // Then destroy ad, unsubscribe and e.t.c
  this.destroyAd();
}
AdsManager.prototype.onAdVolumeChange = function() {
  console.log('onAdVolumeChange');
  if (this.EVENTS.AdVolumeChange in this._eventCallbacks) {
    if(typeof this._eventCallbacks[this.EVENTS.AdVolumeChange] === 'function') {
      this._eventCallbacks[this.EVENTS.AdVolumeChange]();
    }
  }
}
AdsManager.prototype.onAdImpression = function() {
  console.log('onAdImpression');
  if(this._isVPAID && this._vpaidCreative && this._vastTracker) {
    if (!this._hasImpression) {
      // Check duration
      this._attributes.duration = this._isCreativeFunctionInvokable("getAdDuration") ? this._vpaidCreative.getAdDuration() : -1;
      console.log('update tracker with new duration', this._attributes.duration);
      if(this._attributes.duration != -1) {
        this._vastTracker.setDuration(this._attributes.duration);
      }
      /*
      // Check remaining time
      this._attributes.remainingTime = this._isCreativeFunctionInvokable("getAdRemainingTime") ? this._vpaidCreative.getAdRemainingTime() : -1;
      console.log('update tracker with new remainingTime', this._attributes.remainingTime);
      console.log('update tracker with new duration', this._attributes.duration);
       */
      // Track impression
      this._vastTracker.trackImpression();

      // Start VPAID process
      this.startVPAIDProgress();

      this._hasImpression = true;
    }
  }
  if (this.EVENTS.AdImpression in this._eventCallbacks) {
    if(typeof this._eventCallbacks[this.EVENTS.AdImpression] === 'function') {
      this._eventCallbacks[this.EVENTS.AdImpression]();
    }
  }
}
AdsManager.prototype.onAdClickThru = function(url, id, playerHandles) {
  // TODO:
  console.log('onAdClickThru', url, id, playerHandles);
  if(this._isVPAID && this._vpaidCreative && this._vastTracker) {
    this._vastTracker.click();
  }
  if (this.EVENTS.AdClickThru in this._eventCallbacks) {
    if(typeof this._eventCallbacks[this.EVENTS.AdClickThru] === 'function') {
      this._eventCallbacks[this.EVENTS.AdClickThru](url, id, playerHandles);
    }
  }
}
AdsManager.prototype.onAdVideoFirstQuartile = function() {
  console.log('onAdVideoFirstQuartile');
  if(this._isVPAID && this._vpaidCreative && this._vastTracker) {
    this.updateVPAIDProgress();
  }
  if (this.EVENTS.AdVideoFirstQuartile in this._eventCallbacks) {
    if(typeof this._eventCallbacks[this.EVENTS.AdVideoFirstQuartile] === 'function') {
      this._eventCallbacks[this.EVENTS.AdVideoFirstQuartile]();
    }
  }
};
AdsManager.prototype.onAdVideoMidpoint = function() {
  console.log('onAdVideoMidpoint');
  if(this._isVPAID && this._vpaidCreative && this._vastTracker) {
    this.updateVPAIDProgress();
  }
  if (this.EVENTS.AdVideoMidpoint in this._eventCallbacks) {
    if(typeof this._eventCallbacks[this.EVENTS.AdVideoMidpoint] === 'function') {
      this._eventCallbacks[this.EVENTS.AdVideoMidpoint]();
    }
  }
};
AdsManager.prototype.onAdVideoThirdQuartile = function() {
  console.log('onAdVideoThirdQuartile');
  if(this._isVPAID && this._vpaidCreative && this._vastTracker) {
    this.updateVPAIDProgress();
  }
  if (this.EVENTS.AdVideoThirdQuartile in this._eventCallbacks) {
    if(typeof this._eventCallbacks[this.EVENTS.AdVideoThirdQuartile] === 'function') {
      this._eventCallbacks[this.EVENTS.AdVideoThirdQuartile]();
    }
  }
};
AdsManager.prototype.onAdPaused = function() {
  console.log('onAdPaused');
  if(this._vastTracker) {
    this._vastTracker.setPaused(true);
  }
  if (this.EVENTS.AdPaused in this._eventCallbacks) {
    if(typeof this._eventCallbacks[this.EVENTS.AdPaused] === 'function') {
      this._eventCallbacks[this.EVENTS.AdPaused]();
    }
  }
};
AdsManager.prototype.onAdPlaying = function() {
  console.log('onAdPlaying');
  if(this._vastTracker) {
    this._vastTracker.setPaused(false);
  }
  if (this.EVENTS.AdPlaying in this._eventCallbacks) {
    if(typeof this._eventCallbacks[this.EVENTS.AdPlaying] === 'function') {
      this._eventCallbacks[this.EVENTS.AdPlaying]();
    }
  }
};
AdsManager.prototype.onAdVideoComplete = function() {
  console.log('onAdVideoComplete');
  if(this._isVPAID && this._vpaidCreative && this._vastTracker) {
    this._vastTracker.complete();
  }
  if (this.EVENTS.AdVideoComplete in this._eventCallbacks) {
    if(typeof this._eventCallbacks[this.EVENTS.AdVideoComplete] === 'function') {
      this._eventCallbacks[this.EVENTS.AdVideoComplete]();
    }
  }
}
AdsManager.prototype.onAllAdsCompleted = function() {
  console.log('onAllAdsCompleted');
  if (this.EVENTS.AllAdsCompleted in this._eventCallbacks) {
    if(typeof this._eventCallbacks[this.EVENTS.AllAdsCompleted] === 'function') {
      this._eventCallbacks[this.EVENTS.AllAdsCompleted]();
    }
  }
}
AdsManager.prototype.onAdError = function(message) {
  console.log('onAdError', message);
  if (this.EVENTS.AdError in this._eventCallbacks) {
    if(typeof this._eventCallbacks[this.EVENTS.AdError] === 'function') {
      this._eventCallbacks[this.EVENTS.AdError](message);
    }
  }
}
AdsManager.prototype.onAdLog = function(message) {
  console.log('onAdLog');
  if (this.EVENTS.AdLog in this._eventCallbacks) {
    if(typeof this._eventCallbacks[this.EVENTS.AdLog] === 'function') {
      this._eventCallbacks[this.EVENTS.AdLog](message);
    }
  }
}
AdsManager.prototype.requestAds = function(vastUrl, options = {}) {

  // destroy
  this.destroy();

  console.log('request ads', vastUrl);

  var that = this;
  this._vastClient = new VASTClient();
  this._vastClient
    .get(vastUrl, options)
    .then(res => {

      console.log(res);
      var ads = res.ads;
      if(ads.length != 0) {
        console.log('ads length', ads.length);
        if(ads.length > 1) {
          // Ad pod
          console.log('AdsManagerLoaded > ad pod');
          that.onAdsManagerLoaded();
        } else {
          // Ad
          console.log(that._videoSlot, ads[0]);

          that._ad = ads[0];
          // Filter linear creatives, get first
          that._creative = ads[0].creatives.filter(creative => creative.type === 'linear')[0];
          // Check if creative has media files
          if(that._creative && that._creative.mediaFiles.length != 0) {

            console.log('is linear creative ? > YES', that._creative);
            // Filter and check media files for mime type canPlay and if VPAID or not
            that._mediaFiles = that._creative.mediaFiles.filter(mediaFile => {
              // mime types -> mp4, webm, ogg
              if(that.canPlayVideoType(mediaFile.mimeType)) {
                console.log('can play', mediaFile);
                return mediaFile;
              } else if(mediaFile.mimeType === 'application/javascript') {
                // apiFramework -> mime type -> application/javascript
                console.log('can play -> vpaid', mediaFile);
                return mediaFile;
              }
            });//[0]; // take the first one

            // Sort media files by size
            that._mediaFiles.sort(function(a, b) {
              var aHeight = a.height;
              var bHeight = b.height;
              return (aHeight < bHeight) ? -1 : (aHeight > bHeight) ? 1 : 0;
            });

            console.log('sorted media files', that._mediaFiles);

            if(that._mediaFiles && that._mediaFiles.length != 0) {
              // TODO: move after adLoaded
              // Init VAST Tracker for tracking events
              that._vastTracker = new VASTTracker(that._vastClient, that._ad, that._creative);
              that._vastTracker.load();

              // If not VPAID dispatch AdsManagerLoaded event -> ad is ready for init
              that.onAdsManagerLoaded();
            } else {
              console.log('no media compatible files');
            }

          } else {
            console.log('NOT LINEAR');
          }
        }

      } else {
        // TODO:
        that.onAdError('The VAST response document is empty.');
      }

    })
    .catch(err => {
      console.log(err);
      that.onAdError(err.message);
    });

}
AdsManager.prototype.canPlayVideoType = function(mimeType) {
  if(mimeType === 'video/webm' && this.supportsWebmVideo()) {
    return true;
  } else if(mimeType === 'video/ogg' && this.supportsOggTheoraVideo()) {
    return true;
  } else if(mimeType === 'video/mp4' && this.supportsH264BaselineVideo()) {
    return true;
  }
  return false;
}
AdsManager.prototype.supportsVideo = function() {
  return !!document.createElement('video').canPlayType;
}
AdsManager.prototype.supportsH264BaselineVideo = function() {
  if(!this.supportsVideo()) return false;
  var video = document.createElement('video');
  return video.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"');
}
AdsManager.prototype.supportsOggTheoraVideo = function() {
  if(!this.supportsVideo()) return false;
  var video = document.createElement('video');
  return video.canPlayType('video/ogg; codecs="theora, vorbis"');
}
AdsManager.prototype.supportsWebmVideo = function() {
  if(!this.supportsVideo()) return false;
  var video = document.createElement('video');
  return video.canPlayType('video/webm; codecs="vp8, vorbis"');
}
AdsManager.prototype.handshakeVersion = function(version) {
  console.log('VPAID Creative: handshakeVersion(' + version + ')');
  return this._vpaidCreative.handshakeVersion(version);
}
AdsManager.prototype._isCreativeFunctionInvokable = function(a) {
  return this._vpaidCreative ? (a = this._vpaidCreative[a]) && typeof a === 'function' : false;
}
AdsManager.prototype.checkVPAIDInterface = function(a) {
  for (var b = { passed: true, missingInterfaces: ''}, d = a.length - 1; 0 <= d; d--)
    this._isCreativeFunctionInvokable(a[d]) || (b.passed = false, b.missingInterfaces += a[d] + ' ');
  return b;
}
AdsManager.prototype.setCallbacksForCreative = function(eventCallbacks, context) {
  for (var event in eventCallbacks) eventCallbacks.hasOwnProperty(event) && this._vpaidCreative.subscribe(eventCallbacks[event], event, context)
}
AdsManager.prototype.removeCallbacksForCreative = function(eventCallbacks) {
  for (var event in eventCallbacks) {
    console.log('removeCallback', event);
    eventCallbacks.hasOwnProperty(event) && this._vpaidCreative.unsubscribe(event); // && this._vpaidCreative.unsubscribe(eventCallbacks[event], event);
  }
}
AdsManager.prototype.creativeAssetLoaded = function() {
  console.log('creative asset loaded');
  console.log(this._vpaidCreative);
  console.log('check VPAID creative');
  var that = this,
    checkVPAIDMinVersion = function() {
      console.log('check VPAID min version');
      var c = that.handshakeVersion(that.SUPPORTED_CREATIVE_VPAID_VERSION_MIN.toFixed(1));
      console.log('VPAID min version is', c);
      return c ? parseFloat(c) < that.SUPPORTED_CREATIVE_VPAID_VERSION_MIN ? (that.onAdError('Only support creatives with VPAID version >= ' + that.SUPPORTED_CREATIVE_VPAID_VERSION_MIN.toFixed(1)), !1) : !0 : (that.onAdError('Cannot get VPAID version from the creative'), !1)
    };
  if (function() {
    var c = that.checkVPAIDInterface('handshakeVersion initAd startAd stopAd subscribe unsubscribe getAdLinear'.split(' '));
    c.passed || that.onAdError('Missing interfaces in the VPAID creative: ' + c.missingInterfaces);
    return c.passed
  }() && checkVPAIDMinVersion()) {

    console.log('VPAID is OK');

    that._creativeEventCallbacks = {
      AdStarted: that.onAdStarted,
      AdStopped: that.onAdStopped,
      AdSkipped: that.onAdSkipped,
      AdLoaded: that.onAdLoaded,
      //AdLinearChange: that.onAdLinearChange,
      AdSizeChange: that.onAdSizeChange,
      //AdExpandedChange: that.onAdExpandedChange,
      AdDurationChange: that.onAdDurationChange,
      AdVolumeChange: that.onAdVolumeChange,
      AdImpression: that.onAdImpression,
      AdClickThru: that.onAdClickThru,
      //AdInteraction: that.onAdInteraction,
      AdVideoStart: that.onAdVideoStart,
      AdVideoFirstQuartile: that.onAdVideoFirstQuartile,
      AdVideoMidpoint: that.onAdVideoMidpoint,
      AdVideoThirdQuartile: that.onAdVideoThirdQuartile,
      AdVideoComplete: that.onAdVideoComplete,
      //AdUserAcceptInvitation: that.onAdUserAcceptInvitation,
      //AdUserMinimize: that.onAdUserMinimize,
      //AdUserClose: that.onAdUserClose,
      AdPaused: that.onAdPaused,
      AdPlaying: that.onAdPlaying, // onAdResumed
      AdError: that.onAdError,
      AdLog: that.onAdLog
    }

    // Subscribe for VPAID events
    console.log('subscribe for VPAID events');
    that.setCallbacksForCreative(that._creativeEventCallbacks, that);

    // Prepare for iniAd
    var width = that._attributes.width; //that._videoSlot.clientWidth;
    var height = that._attributes.height; // that._videoSlot.clientHeight;
    var creativeData = {
      AdParameters: that._creative.adParameters
    };
    var environmentVars = {
      slot: that._slot,
      videoSlot: that._videoSlot,
      videoSlotCanAutoPlay: true
    };
    // iniAd(width, height, viewMode, desiredBitrate, creativeData, environmentVars)
    console.log('vpaid initAd >', width, height, that._attributes.viewMode, that._attributes.desiredBitrate, creativeData, environmentVars);
    that._vpaidCreative.initAd(width, height, that._attributes.viewMode, that._attributes.desiredBitrate, creativeData, environmentVars);

  }
}
AdsManager.prototype.loadCreativeAsset = function(fileURL) {
  console.log('load creative asset >', fileURL);
  var vpaidIframe = document.getElementById('vpaidIframe'),
    iframe = document.createElement('iframe');

  iframe.id = 'vpaidIframe';
  vpaidIframe == null ? document.body.appendChild(iframe) : document.body.replaceChild(iframe, vpaidIframe); // this._adContainer.appendChild(iframe) : this._adContainer.replaceChild(iframe, vpaidIframe);
  iframe.width = 0;
  iframe.height = 0;
  iframe.style.display = "none";
  iframe.setAttribute('allowfullscreen', '');
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
  iframe.setAttribute('allow', "autoplay;");
  iframe.tabIndex = -1;
  iframe.contentWindow.document.open();
  // CORS?
  iframe.contentWindow.document.write('<script type="text/javascript" src="' + fileURL + '"> \x3c/script>');
  iframe.contentWindow.document.close();
  var that = this;
  this._loadIntervalTimer = setInterval(function() {
    var VPAIDAd = document.getElementById("vpaidIframe").contentWindow.getVPAIDAd;
    VPAIDAd && typeof VPAIDAd === 'function' && (clearInterval(that._loadIntervalTimer), VPAIDAd = VPAIDAd(), typeof VPAIDAd === 'undefined' ? console.log('getVPAIDAd() returns undefined value') : VPAIDAd == null ? console.log('getVPAIDAd() returns null') : (that._vpaidCreative = VPAIDAd, that.creativeAssetLoaded()))
  }, 200);

}
AdsManager.prototype.removeCreativeAsset = function() {
  // Remove VPAID iframe
  var vpaidIframe = document.getElementById('vpaidIframe');
  if(vpaidIframe) {
    vpaidIframe.parentNode.removeChild(vpaidIframe);
  }
}
AdsManager.prototype.destroyAd = function() {

  console.log('destroyAd');
  /*
  if(this._isVPAID) {
      // Unsubscribe for VPAID events
      console.log('unsubscribe for VPAID events');
      this.removeCallbacksForCreative(this._creativeEventCallbacks);
      this.removeCreativeAsset();
  }
  //this.removeVideoSlot();
  this.removeSlot();

  // Reset global variables to default values
  this._isVPAID = false;

  this._hasImpression = false;
  this._hasStarted = false;

  this._ad = null;
  this._creative = null;
  this._mediaFile = null;
  this._vpaidCreative = null;
  this._vastTracker = null;
   */
  this.destroy();

  // Dispatch AllAdsCompleted
  this.onAllAdsCompleted();
}
AdsManager.prototype.isCreativeExists = function() {
  return this._creative && this._creative.mediaFiles.length != 0;
}
AdsManager.prototype.init = function(width, height, viewMode) {
  console.log('init > ad', width, height, viewMode, this.isCreativeExists());

  var that = this;
  if(this.isCreativeExists()) {

    // Find the best resolution for mediaFile
    console.log('media files', this._mediaFiles);
    this._mediaFileIndex = this._mediaFiles.findIndex(function(item) {
      return item.height >= height
    });

    console.log('media file index is', this._mediaFileIndex);
    if(this._mediaFileIndex != -1) {
      this._mediaFile = this._mediaFiles[this._mediaFileIndex];
    } else {
      // Get the last from array
      console.log('get the last');
      this._mediaFile = this._mediaFiles[this._mediaFiles.length - 1];
    }
    console.log('media file is', this._mediaFile);
    if(this._mediaFile) {
      // Check if VPAID
      if (this._mediaFile.mimeType === 'application/javascript') {
        this._isVPAID = true;
      }

      console.log('is VPAID?', this._isVPAID);
      console.log(this._mediaFile);

      this._attributes.width = width;
      this._attributes.height = height;
      this._attributes.viewMode = viewMode;

      // Resize slot
      this.resizeSlot(this._attributes.width, this._attributes.height);

      if(this._isVPAID) {
        // VPAID
        console.log('vpaid >>>>>>>>>>>>>> todo', this._mediaFile.fileURL);
        console.log('ad is VPAID -> inject VPAID javascript of ad and validate for existing VPAID api functionality, the dispatch AdLoaded or AdError');
        this.loadCreativeAsset(this._mediaFile.fileURL);
      } else {
        // regular
        console.log('regular > set video slot src >', this._mediaFile.fileURL);
        this._videoSlot.setAttribute('src', this._mediaFile.fileURL);

        // Events
        this._slot.addEventListener('click', function() {
          console.log('click');
          if(!that._isVPAID && that._vastTracker) {
            that._vastTracker.click();
          }
        }, false);
        this._videoSlot.addEventListener('canplay', function() {
          console.log('video slot can play');
        }, false);
        this._videoSlot.addEventListener('volumechange', function(event) {
          that._vastTracker && that._vastTracker.setMuted(event.target.muted);
        }, false);
        this._videoSlot.addEventListener('timeupdate', function(event) {
          if(that.isCreativeExists()) {
            var percentPlayed = event.target.currentTime * 100.0 / event.target.duration;
            if (percentPlayed >= 0) {
              if (!that._hasImpression) {
                that._vastTracker && that._vastTracker.trackImpression();
                that._hasImpression = true;
              }
            }
            that._vastTracker && that._vastTracker.setProgress(event.target.currentTime);
            if (event.target.duration > 0) {
              that._attributes.remainingTime = event.target.duration - event.target.currentTime;
            }
          }
        }, true);
        this._videoSlot.addEventListener('loadedmetadata', function(event) {
          console.log('LOADED META DATA', event.target.duration);
          that._attributes.duration = event.target.duration;
          // Update tracking duration with real media meta data
          that._vastTracker && that._vastTracker.setDuration(event.target.duration);
          if(!that._isVPAID) {
            that.onAdDurationChange();
          }
        }, false);
        this._videoSlot.addEventListener('ended', function() {
          // Complete
          console.log('video > ended');
          that._vastTracker && that._vastTracker.complete();
        }, false);


        this.onAdLoaded();
      }

      // Tracking
      if(this._vastTracker) {

        this._vastTracker.on('clickthrough', function (url) {
          console.log('click', url);
          if (!that._isVPAID) {
            that.onAdClickThru(url);
          }
          console.log('open window', url);
          // Open the resolved clickThrough url
          var opener = window.open(url, '_blank');
          void 0 !== opener ? opener.focus() : window.location.href = url;
        });
        this._vastTracker.on('creativeView', () => {
          console.log('creativeView -> impression');
          if (!that._isVPAID) {
            that.onAdImpression();
          }
        });
        this._vastTracker.on('start', () => {
          console.log('start');
          if (!that._isVPAID) {
            that.onAdVideoStart();
          }
        });
        this._vastTracker.on('firstQuartile', () => {
          console.log('firstQuartile');
          if (!that._isVPAID) {
            that.onAdVideoFirstQuartile();
          }
        });
        this._vastTracker.on('midpoint', () => {
          console.log('midpoint');
          if (!that._isVPAID) {
            that.onAdVideoMidpoint();
          }
        });
        this._vastTracker.on('thirdQuartile', () => {
          console.log('thirdQuartile');
          if (!that._isVPAID) {
            that.onAdVideoThirdQuartile();
          }
        });
        this._vastTracker.on('complete', () => {
          console.log('complete');
          if (!that._isVPAID) {
            that.onAdVideoComplete();
            that.onAdStopped();
          }
        });
      }

    } else {
      console.log('media file not found');
    }

  } else {
    this.onAdError('');
  }
}
AdsManager.prototype.start = function() {

  console.log('start > ad');
  var that = this;
  if(this.isCreativeExists()) {
    this._videoSlot.muted = true;

    if (this._isVPAID && this._vpaidCreative) {
      console.log('start > vpaid', this._isVPAID, this._vpaidCreative);
      this._vpaidCreative.startAd();
    } else {

      //this._videoSlot.autoplay = true;
      this._videoSlot.load();
      this._videoSlot.play();

      that.onAdStarted();
    }
  }
}
AdsManager.prototype.getDuration = function() {
  return this.isCreativeExists() && this._attributes.duration;
}
AdsManager.prototype.pause = function() {
  if(this.isCreativeExists()) {
    if (this._isVPAID) {
      this._isCreativeFunctionInvokable("pauseAd") && this._vpaidCreative.pauseAd();
    } else {
      console.log('pause > video');
      this._videoSlot.pause();
      this.onAdPaused();
    }
  }
}
AdsManager.prototype.resume = function() {
  if(this.isCreativeExists()) {
    if (this._isVPAID) {
      this._isCreativeFunctionInvokable("resumeAd") && this._vpaidCreative.resumeAd();
    } else {
      console.log('resume > video');
      this._videoSlot.play();
      this.onAdPlaying();
    }
  }
}
AdsManager.prototype.stop = function() {
  if(this.isCreativeExists()) {
    if (this._isVPAID) {
      this._vpaidCreative.stopAd();
    } else {
      this.onAdStopped();
    }
  }
}
AdsManager.prototype.skip = function() {
  if(this.isCreativeExists()) {
    if (this._isVPAID) {
      this._isCreativeFunctionInvokable("skipAd") && this._vpaidCreative.skipAd();
    } else {
      console.log('skip > video');
      this.onAdSkipped();
    }
  }
}
AdsManager.prototype.resize = function(width, height, viewMode) {
  if(this.isCreativeExists()) {

    this._attributes.width = width;
    this._attributes.height = height;
    this._attributes.viewMode = viewMode;

    // Resize slot
    this.resizeSlot(this._attributes.width, this._attributes.height);

    if (this._isVPAID && this._vpaidCreative) {
      console.log('resize > vpaid', width, height, viewMode);
      this._isCreativeFunctionInvokable("resizeAd") && this._vpaidCreative.resizeAd(width, height, viewMode);
    } else {
      console.log('resize > video', width, height, viewMode);
      this.onAdSizeChange();
    }
  }
}
AdsManager.prototype.getVolume = function() {
  if(this.isCreativeExists()) {
    if (this._isVPAID) {
      return this._isCreativeFunctionInvokable("getAdVolume") ? this._vpaidCreative.getAdVolume() : -1;
    } else {
      console.log('getVolume > video');
    }
  }
}
AdsManager.prototype.setVolume = function(value) {
  if(this.isCreativeExists()) {
    if (this._isVPAID) {
      this._isCreativeFunctionInvokable("setAdVolume") && this._vpaidCreative.setAdVolume(value);
    } else {
      console.log('setVolume > video');
    }
  }
}
AdsManager.prototype.getRemainingTime = function() {
  if(this.isCreativeExists()) {
    if (this._isVPAID) {
      return this._isCreativeFunctionInvokable("getAdRemainingTime") ? this._vpaidCreative.getAdRemainingTime() : -1
    } else {
      return this._attributes.remainingTime;
    }
  }
}
AdsManager.prototype.collapse = function() {
  if(this.isCreativeExists()) {
    // TODO:
  }
}
AdsManager.prototype.expand = function() {
  if(this.isCreativeExists()) {
    // TODO:
  }
}
AdsManager.prototype.destroy = function() {
  if(this.isCreativeExists()) {
    //this.destroyAd();
  }
  console.log('destroy');

  if(this._isVPAID) {
    // Unsubscribe for VPAID events
    console.log('unsubscribe for VPAID events');
    this.removeCallbacksForCreative(this._creativeEventCallbacks);
    this.removeCreativeAsset();
  }

  // Reset global variables to default values
  this._isVPAID = false;

  this._hasImpression = false;
  this._hasStarted = false;

  this._ad = null;
  this._creative = null;
  this._mediaFile = null;
  this._vpaidCreative = null;
  this._vastTracker = null;

  //this.removeVideoSlot();
  console.log('remove slot');
  this.removeSlot();

}

export { AdsManager }