var musicAudio;
var soundBonusAudio;
var soundCrashAudio;
var soundLastCrashAudio;

function setupAudio() {
  // background music
  musicAudio = new Howl({
    src: ["./assets/music.mp3"],
    autoplay: false,
    loop: true,
  });
  const musicId = musicAudio.play();
  musicAudio.fade(0, 0.01, 500, musicId);

  //sound effects
  soundBonusAudio = new Howl({
    src: ["./assets/bonus-sound.mp3"],
  });

  soundCrashAudio = new Howl({
    src: ["./assets/crash-sound.mp3"],
  });

  soundLastCrashAudio = new Howl({
    src: ["./assets/last-crash-sound.mp3"],
  });
}
