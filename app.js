// =====================================================================
// VOCAB CHAMP - Interactive Logic Engine
// Handles: Gamification, TTS Speech, Audio Synthesis, Confetti & Print
// =====================================================================

(function () {
  'use strict';

  // State
  let currentCategory = 'all';
  let activeQuestions = [];
  let currentIndex = 0;
  let score = 0;
  let streak = 0;
  let stars = parseInt(localStorage.getItem('vocab_stars') || '0', 10);
  let soundEnabled = true;
  let hasAnsweredCurrent = false;

  // Audio Context (Synthesized sounds without external mp3s)
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playTone(freq, duration, type = 'sine', gainVal = 0.15) {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn("Audio error:", e);
    }
  }

  function playSuccessSound() {
    playTone(523.25, 0.12, 'triangle', 0.2); // C5
    setTimeout(() => playTone(659.25, 0.14, 'triangle', 0.2), 100); // E5
    setTimeout(() => playTone(783.99, 0.25, 'triangle', 0.25), 200); // G5
  }

  function playWrongSound() {
    playTone(260, 0.15, 'sawtooth', 0.15);
    setTimeout(() => playTone(200, 0.2, 'sawtooth', 0.12), 120);
  }

  function playFanfareSound() {
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      setTimeout(() => playTone(freq, 0.35, 'triangle', 0.25), idx * 160);
    });
  }

  // Text-To-Speech (Native Web Speech API)
  function speakSentence(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel(); // Stop current speech
    const cleanText = text.replace(/_+/g, "blank").replace(/[\/\\()]/g, " ");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-US';
    utterance.rate = 0.85; // Slightly slower for 5yo child
    utterance.pitch = 1.15; // Friendly higher pitch
    window.speechSynthesis.speak(utterance);
  }

  // DOM Elements
  const starCountEl = document.getElementById('star-count');
  const streakCountEl = document.getElementById('streak-count');
  const btnToggleSound = document.getElementById('btn-toggle-sound');
  const modeTabs = document.querySelectorAll('.mode-tab');
  const progressQuestionLabel = document.getElementById('progress-question-label');
  const progressScoreLabel = document.getElementById('progress-score-label');
  const progressFill = document.getElementById('progress-fill');
  const categoryBadge = document.getElementById('category-badge');
  const btnReadAloud = document.getElementById('btn-read-aloud');
  const visualContainer = document.getElementById('visual-container');
  const visualEmoji = document.getElementById('visual-emoji');
  const questionText = document.getElementById('question-text');
  const questionHint = document.getElementById('question-hint');
  const optionsGrid = document.getElementById('options-grid');
  const feedbackBanner = document.getElementById('feedback-banner');
  const feedbackIcon = document.getElementById('feedback-icon');
  const feedbackMsg = document.getElementById('feedback-msg');
  const btnNext = document.getElementById('btn-next');
  const btnRestartRound = document.getElementById('btn-restart-round');
  const btnPracticeAll = document.getElementById('btn-practice-all');
  const btnWordListModal = document.getElementById('btn-word-list-modal');

  // Modals
  const victoryModal = document.getElementById('victory-modal');
  const victorySummary = document.getElementById('victory-summary');
  const victoryStars = document.getElementById('victory-stars');
  const btnPlayAgain = document.getElementById('btn-play-again');
  const btnVictoryPrint = document.getElementById('btn-victory-print');
  const wordsModal = document.getElementById('words-modal');
  const wordsGridContainer = document.getElementById('words-grid-container');
  const btnCloseWords = document.getElementById('btn-close-words');
  const btnDoneWords = document.getElementById('btn-done-words');
  const printModal = document.getElementById('print-modal');
  const btnOpenPrint = document.getElementById('btn-open-print');
  const btnClosePrint = document.getElementById('btn-close-print');
  const btnDoPrint = document.getElementById('btn-do-print');
  const printTypeSelect = document.getElementById('print-type-select');
  const printableSheet = document.getElementById('printable-sheet');

  // Confetti Engine
  const canvas = document.getElementById('confetti-canvas');
  let ctx = canvas.getContext('2d');
  let confettiPieces = [];
  let confettiActive = false;

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function triggerConfetti(duration = 2000) {
    confettiPieces = [];
    const colors = ['#F59E0B', '#10B981', '#6366F1', '#EC4899', '#3B82F6', '#8B5CF6'];
    for (let i = 0; i < 90; i++) {
      confettiPieces.push({
        x: Math.random() * canvas.width,
        y: -10 - Math.random() * 50,
        r: 6 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 4,
        vy: 3 + Math.random() * 4,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 8
      });
    }
    confettiActive = true;
    setTimeout(() => { confettiActive = false; }, duration);
  }

  function renderConfetti() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (confettiActive || confettiPieces.length > 0) {
      confettiPieces.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotSpeed;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.5);
        ctx.restore();
      });
      // Remove offscreen
      confettiPieces = confettiPieces.filter(p => p.y < canvas.height + 20);
    }
    requestAnimationFrame(renderConfetti);
  }
  requestAnimationFrame(renderConfetti);

  // Fisher-Yates Shuffle
  function shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // Filter & Initialize Questions Round
  function initRound(category = currentCategory, roundSize = 10) {
    currentCategory = category;
    let pool = [];

    if (category === 'all') {
      pool = shuffleArray(QUESTIONS_DATA);
    } else {
      pool = shuffleArray(QUESTIONS_DATA.filter(q => q.category === category));
    }

    if (roundSize === 'max') {
      activeQuestions = pool;
    } else {
      activeQuestions = pool.slice(0, Math.min(roundSize, pool.length));
    }

    currentIndex = 0;
    score = 0;
    hasAnsweredCurrent = false;
    updateStatsDisplay();
    renderCurrentQuestion();
  }

  function updateStatsDisplay() {
    starCountEl.textContent = stars;
    streakCountEl.textContent = streak;
    progressScoreLabel.textContent = `Score: ${score}`;
  }

  // Render Current Question
  function renderCurrentQuestion() {
    hasAnsweredCurrent = false;
    feedbackBanner.style.display = 'none';

    if (currentIndex >= activeQuestions.length) {
      showVictoryModal();
      return;
    }

    const q = activeQuestions[currentIndex];

    // Progress bar
    progressQuestionLabel.textContent = `Question ${currentIndex + 1} of ${activeQuestions.length}`;
    const percent = ((currentIndex) / activeQuestions.length) * 100;
    progressFill.style.width = `${Math.max(percent, 8)}%`;

    // Category badge
    if (q.category === 'spelling') {
      categoryBadge.textContent = '🔤 SPELLING CHOICE';
      categoryBadge.style.color = '#4338CA';
      categoryBadge.style.background = '#EEF2FF';
    } else if (q.category === 'picture') {
      categoryBadge.textContent = '🖼️ LOOK & IDENTIFY';
      categoryBadge.style.color = '#047857';
      categoryBadge.style.background = '#ECFDF5';
    } else {
      categoryBadge.textContent = '💡 SOCHO & FILL (RIDDLE)';
      categoryBadge.style.color = '#B45309';
      categoryBadge.style.background = '#FEF3C7';
    }

    // Visual emoji container
    if (q.category === 'picture' || q.emoji) {
      visualContainer.style.display = 'flex';
      visualEmoji.textContent = q.emoji || '⭐';
    } else {
      visualContainer.style.display = 'none';
    }

    // Texts
    questionText.textContent = q.text;
    questionHint.textContent = q.hint || "Choose the best option:";

    // Render Options
    optionsGrid.innerHTML = '';
    const shuffledOptions = shuffleArray(q.options);
    shuffledOptions.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.textContent = opt;
      btn.addEventListener('click', () => handleOptionClick(btn, opt, q));
      optionsGrid.appendChild(btn);
    });

    // Automatically speak for convenience if speech is supported
    // speakSentence(`${q.text}`);
  }

  // Check Answer Handler
  function handleOptionClick(btnElement, selectedOption, q) {
    if (hasAnsweredCurrent) return;

    const isMatch = selectedOption.trim().toLowerCase() === q.correct.trim().toLowerCase();

    if (isMatch) {
      hasAnsweredCurrent = true;
      btnElement.classList.add('correct');
      playSuccessSound();
      triggerConfetti(1400);

      score++;
      streak++;
      stars += 2;
      localStorage.setItem('vocab_stars', stars);
      updateStatsDisplay();

      // Feedback banner
      feedbackBanner.className = 'feedback-banner';
      feedbackIcon.textContent = '🎉';
      const praiseWords = ['Super Star!', 'Awesome Job!', 'Brilliant!', 'Spot On!', 'Champ!'];
      const randomPraise = praiseWords[Math.floor(Math.random() * praiseWords.length)];
      feedbackMsg.textContent = `${randomPraise} The answer is "${q.correct}".`;
      feedbackBanner.style.display = 'flex';

      // Say congratulations out loud
      speakSentence(`${q.correct}! Well done!`);

    } else {
      btnElement.classList.add('wrong');
      playWrongSound();
      streak = 0;
      updateStatsDisplay();

      feedbackBanner.className = 'feedback-banner wrong-banner';
      feedbackIcon.textContent = '🤔';
      feedbackMsg.textContent = `Oops! Give it another try!`;
      feedbackBanner.style.display = 'flex';

      // Remove wrong state after a moment so child can re-try!
      setTimeout(() => {
        btnElement.classList.remove('wrong');
      }, 700);
    }
  }

  // Next Question Button
  btnNext.addEventListener('click', () => {
    currentIndex++;
    renderCurrentQuestion();
  });

  // Read Aloud Button
  btnReadAloud.addEventListener('click', () => {
    const q = activeQuestions[currentIndex];
    if (q) {
      speakSentence(`${q.text}`);
    }
  });

  // Sound Toggle
  btnToggleSound.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    btnToggleSound.textContent = soundEnabled ? '🔊' : '🔇';
  });

  // Mode Selection Tabs
  modeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      modeTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const cat = tab.getAttribute('data-category');
      initRound(cat, 10);
    });
  });

  // Restart Round
  btnRestartRound.addEventListener('click', () => {
    initRound(currentCategory, 10);
  });

  // Practice All 100+
  btnPracticeAll.addEventListener('click', () => {
    if (confirm("Would you like to practice all 100+ questions in a mega champ marathon?")) {
      initRound('all', 'max');
    }
  });

  // Victory Modal
  function showVictoryModal() {
    playFanfareSound();
    triggerConfetti(3500);

    const total = activeQuestions.length;
    victorySummary.textContent = `You scored ${score} out of ${total} points!`;
    
    if (score === total) {
      victoryStars.textContent = '⭐⭐⭐⭐⭐';
    } else if (score >= total * 0.7) {
      victoryStars.textContent = '⭐⭐⭐⭐';
    } else {
      victoryStars.textContent = '⭐⭐⭐';
    }

    victoryModal.style.display = 'flex';
  }

  btnPlayAgain.addEventListener('click', () => {
    victoryModal.style.display = 'none';
    initRound(currentCategory, 10);
  });

  btnVictoryPrint.addEventListener('click', () => {
    victoryModal.style.display = 'none';
    openPrintWorksheet();
  });

  // Master Words List Modal
  btnWordListModal.addEventListener('click', () => {
    wordsGridContainer.innerHTML = '';
    VOCAB_WORDS.forEach(item => {
      const pill = document.createElement('div');
      pill.className = 'word-pill';
      pill.innerHTML = `
        <span>${item.emoji || '✨'} <strong>${item.word}</strong></span>
        <span class="word-type-tag">${item.form}</span>
      `;
      // Clicking says the word
      pill.style.cursor = 'pointer';
      pill.title = 'Click to hear pronunciation';
      pill.addEventListener('click', () => speakSentence(item.word));
      wordsGridContainer.appendChild(pill);
    });
    wordsModal.style.display = 'flex';
  });

  btnCloseWords.addEventListener('click', () => { wordsModal.style.display = 'none'; });
  btnDoneWords.addEventListener('click', () => { wordsModal.style.display = 'none'; });

  // =====================================================================
  // Printable Worksheet Generator (A4 Paper Print Ready)
  // =====================================================================
  function openPrintWorksheet() {
    generatePrintableSheet(printTypeSelect.value);
    printModal.style.display = 'flex';
  }

  btnOpenPrint.addEventListener('click', openPrintWorksheet);
  btnClosePrint.addEventListener('click', () => { printModal.style.display = 'none'; });
  printTypeSelect.addEventListener('change', () => generatePrintableSheet(printTypeSelect.value));
  btnDoPrint.addEventListener('click', () => window.print());

  function generatePrintableSheet(filterType) {
    let html = `
      <div class="worksheet-header">
        <div class="worksheet-title">
          <h1>🌟 Vocab Champ Practice Worksheet</h1>
          <p>Read the sentences carefully, think, and fill in the blanks with neat pencil handwriting.</p>
        </div>
        <div class="worksheet-student-meta">
          <div>Name: <span class="worksheet-line"></span></div>
          <div>Date: <span class="worksheet-line" style="width:100px;"></span></div>
          <div>Score: ______ / 50</div>
        </div>
      </div>
    `;

    if (filterType === 'all' || filterType === 'spelling') {
      const spellItems = QUESTIONS_DATA.filter(q => q.category === 'spelling').slice(0, 24);
      html += `
        <section class="worksheet-section">
          <h3>Part A: Choose & Circle the Correct Spelling</h3>
          <div class="worksheet-grid">
      `;
      spellItems.forEach((q, i) => {
        html += `
          <div class="ws-item">
            <strong>${i + 1}.</strong> ${q.text.replace('________', '<span class="ws-blank"></span>')}
            <br>
            &nbsp;&nbsp;&nbsp;&nbsp;<span class="ws-options">( ${q.options.join(' &nbsp;/&nbsp; ')} )</span>
          </div>
        `;
      });
      html += `</div></section>`;
    }

    if (filterType === 'all' || filterType === 'pictures') {
      const picItems = QUESTIONS_DATA.filter(q => q.category === 'picture').slice(0, 16);
      html += `
        <section class="worksheet-section" style="page-break-before: auto;">
          <h3>Part B: Look at the Picture & Write the Word</h3>
          <div class="worksheet-grid">
      `;
      picItems.forEach((q, i) => {
        html += `
          <div class="ws-item" style="display:flex; align-items:center; gap:12px;">
            <span style="font-size:2.2rem;">${q.emoji}</span>
            <div>
              <strong>${i + 1}.</strong> This is a <span class="ws-blank" style="width:110px;"></span>
              <br><small style="color:#64748B;">Word: ${q.correct}</small>
            </div>
          </div>
        `;
      });
      html += `</div></section>`;
    }

    if (filterType === 'all' || filterType === 'riddles') {
      const ridItems = QUESTIONS_DATA.filter(q => q.category === 'riddle').slice(0, 16);
      html += `
        <section class="worksheet-section">
          <h3>Part C: Think & Fill in the Blanks (Riddles & Clues)</h3>
          <div class="worksheet-grid">
      `;
      ridItems.forEach((q, i) => {
        html += `
          <div class="ws-item">
            <strong>${i + 1}.</strong> ${q.text.replace('________', '<span class="ws-blank" style="width:100px;"></span>')}
            <br>
            &nbsp;&nbsp;&nbsp;&nbsp;<span class="ws-options">[ ${q.options.join(' &nbsp;/&nbsp; ')} ]</span>
          </div>
        `;
      });
      html += `</div></section>`;
    }

    printableSheet.innerHTML = html;
  }

  // Initial Boot
  initRound('all', 10);

})();
