/* Short fan-recognizable song cues; keep controls understandable and playlist names intact. */
(function () {
  const slots = {
    system: 'ARYAN FM · IS THIS IT? · v.2.001',
    palette: 'Eternal Summer mode',
    boot: 'SOMEDAY • LIVE FOREVER • THIS IS THE ONE • HUMAN SADNESS',
    intro: 'Someday belongs to the replay button. If Sundays feel depressing, there is always one more song.',
    arcade: 'Is This the One? Arcade',
    shuffle: 'Leave It in My Dreams / random shuffle',
    instructions: 'Seventeen seconds from a Heavy Rotation track. Name the song, reveal the artist, or slide away to the next one.',
    answerLabel: 'Name that song:',
    submit: 'This is the one · submit',
    hint: 'Give me an artist hint',
    skip: 'Slide away / next song',
    section: 'Some might say: choose your noise',
    loading: 'Finding the one…',
    heavyTicker: 'This is the one • this is the one • this is the oooooone • this is the one • Made of Stone • are we etched in stone? •',
    essentialsTicker: 'In many ways • we miss the gold ol\' days • somday • someday • Fourth of July • did you get enough love? •',
    replayTicker: 'I kinda miss the 9 to 5 • do not think that you can hide • i scramble fight just like a child • yeah yeeaaaaahhhh • Human Sadness • Why Are Sundays So Depressing? • Live Forever • you and I are gonna live forever •',
    home: 'Return home · Don’t Look Back in Anger ↗',
    win: 'This is the one. Your prize is a deeply unnecessary amount of confetti.',
    next: 'Someday / next mystery song'
  };

  const messages = {
    paletteOff: 'Eternal Summer mode',
    paletteOn: 'Back to the New Abnormal',
    ready: 'One of the ones is ready. Press play when you are.',
    audioFailure: 'Hard to Explain: the audio failed. Try loading the clue again.',
    previewFailure: 'This one did not play. Sliding away to another mystery song…',
    correct: 'THIS IS THE ONE. You got it.',
    wrong: 'Not this one. Try another title.',
    empty: 'Type a song title first; telepathy is still in beta.',
    cannotClose: 'It’s my life and I can’t delete it. GuessTheSong.exe refuses to close.',
    catalogFailure: 'Heavy Rotation did not load. Check your connection and refresh.'
  };

  document.querySelectorAll('[data-lyric-slot]').forEach(function (element) {
    const key = element.getAttribute('data-lyric-slot');
    if (Object.prototype.hasOwnProperty.call(slots, key)) {
      element.textContent = slots[key];
    }
  });
  document.querySelectorAll('[data-lyric-placeholder]').forEach(function (element) {
    element.setAttribute('placeholder', 'Is this it? Type the title…');
  });

  window.musicCopy = { slots: slots, messages: messages };
})();
