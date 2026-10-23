let vocabulary = [];
let learnedWordIds = new Set(JSON.parse(localStorage.getItem('vt_learned_ids') || '[]'));
let favoriteWordIds = new Set(JSON.parse(localStorage.getItem('vt_favorite_ids') || '[]'));
let currentDay = parseInt(localStorage.getItem('vt_current_day') || '1');
let examHistory = JSON.parse(localStorage.getItem('vt_exam_history') || '[]');

function speakWord(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    } else {
        alert("দুঃখিত, আপনার ব্রাউজারে টেক্সট-টু-স্পিচ (উচ্চারণ) সার্ভিস সাপোর্টেড নয়।");
    }
}

function getTargetForDay(day) {
    let target = 0;
    for (let i = 1; i <= day; i++) {
        target += 20 + (i - 1) * 5;
    }
    return target;
}

function getDailyChunkSize(day) {
    return 20 + (day - 1) * 5;
}

document.addEventListener("DOMContentLoaded", async () => {
    initTheme();
    await loadVocabularyData();
    renderDashboard();
    renderExamHistory();
});

function initTheme() {
    const isDark = localStorage.getItem('vt_theme') === 'dark' || 
        (!('vt_theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');

    document.getElementById('themeToggle').addEventListener('click', () => {
        const dark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('vt_theme', dark ? 'dark' : 'light');
    });
}

async function loadVocabularyData() {
    const customData = localStorage.getItem('vt_custom_json');
    if (customData) {
        try {
            vocabulary = JSON.parse(customData);
            return;
        } catch (e) {
            console.error("Custom JSON parsing failed, loading fallback json.", e);
        }
    }

    try {
        const response = await fetch('vocabulary.json');
        vocabulary = await response.json();
    } catch (err) {
        console.error("Failed to fetch vocabulary.json", err);
        vocabulary = [];
    }
}

function switchTab(tabName) {
    ['dashboard', 'learn', 'quiz', 'favorites', 'update-json'].forEach(tab => {
        const sec = document.getElementById(`sec-${tab}`);
        if (sec) sec.classList.add('hidden');
        const btn = document.getElementById(`tab-${tab}`);
        if (btn) {
            btn.classList.remove('border-brand-600', 'text-brand-600');
            btn.classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-400');
        }
    });

    const activeSec = document.getElementById(`sec-${tabName}`);
    if (activeSec) activeSec.classList.remove('hidden');
    
    const activeBtn = document.getElementById(`tab-${tabName}`);
    if (activeBtn) {
        activeBtn.classList.add('border-brand-600', 'text-brand-600');
        activeBtn.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400');
    }

    if (tabName === 'dashboard') renderDashboard();
    if (tabName === 'learn') renderLearnTab();
    if (tabName === 'favorites') renderFavorites();
    if (tabName === 'quiz') renderExamHistory();
    if (tabName === 'update-json') renderUpdateJsonTab();
}

function renderDashboard() {
    const totalWords = vocabulary.length;
    const learnedCount = learnedWordIds.size;
    const targetCount = getTargetForDay(currentDay);

    document.getElementById('stat-total-words').innerText = totalWords;
    document.getElementById('stat-learned-words').innerText = learnedCount;
    document.getElementById('stat-current-day').innerText = currentDay;
    document.getElementById('stat-today-target').innerText = Math.min(targetCount, totalWords);

    const progressPercent = totalWords > 0 ? Math.round((learnedCount / totalWords) * 100) : 0;
    document.getElementById('overall-progress-bar').style.width = `${progressPercent}%`;
    document.getElementById('overall-progress-text').innerText = `${progressPercent}% সম্পন্ন (${learnedCount}/${totalWords})`;

    const roadmap = document.getElementById('roadmap-container');
    roadmap.innerHTML = '';
    
    let simulatedDay = 1;
    let accumulatedWords = 0;

    while (accumulatedWords < totalWords && simulatedDay <= 30) {
        const dailyCount = getDailyChunkSize(simulatedDay);
        const prevAccumulated = accumulatedWords;
        accumulatedWords += dailyCount;

        const isCurrent = simulatedDay === currentDay;
        const isCompleted = simulatedDay < currentDay;

        const card = document.createElement('div');
        card.className = `p-4 rounded-xl border transition ${
            isCurrent ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 ring-2 ring-brand-500' :
            isCompleted ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50' :
            'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
        }`;

        card.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <span class="font-bold text-sm">Day ${simulatedDay}</span>
                ${isCompleted ? '<i class="fa-solid fa-circle-check text-brand-600"></i>' : ''}
                ${isCurrent ? '<span class="text-xs bg-brand-600 text-white px-2 py-0.5 rounded-full">চলমান</span>' : ''}
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400">টাস্ক: ${dailyCount}টি নতুন শব্দ</p>
            <p class="text-xs text-gray-400 mt-1">শব্দ সীমা: ${prevAccumulated + 1} - ${Math.min(accumulatedWords, totalWords)}</p>
        `;
        roadmap.appendChild(card);
        simulatedDay++;
    }
}

function renderLearnTab() {
    const targetIndex = getTargetForDay(currentDay);
    const startIndex = getTargetForDay(currentDay - 1);
    const todayWords = vocabulary.slice(startIndex, targetIndex);

    document.getElementById('learn-heading').innerText = `Day ${currentDay} Task (${todayWords.length} টি শব্দ)`;

    const container = document.getElementById('words-container');
    container.innerHTML = '';

    if (todayWords.length === 0) {
        container.innerHTML = `<p class="col-span-full text-center text-gray-500 py-10">আর কোনো নতুন শব্দ নেই অথবা আপনি আজকের টাস্ক সম্পন্ন করেছেন!</p>`;
        return;
    }

    todayWords.forEach(word => {
        const isLearned = learnedWordIds.has(word.id);
        const isFav = favoriteWordIds.has(word.id);

        const card = document.createElement('div');
        card.className = `p-5 rounded-xl border transition ${
            isLearned ? 'bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'
        }`;

        card.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div class="flex items-center space-x-2">
                    <h3 class="text-lg font-bold text-brand-600 dark:text-brand-400">${word.english}</h3>
                    <button onclick="speakWord('${word.english}')" title="উচ্চারণ শুনুন" class="p-1 text-gray-500 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400 transition">
                        <i class="fa-solid fa-volume-high"></i>
                    </button>
                    <span class="text-xs px-2 py-0.5 rounded border capitalize ${
                        word.learnLevel === 'easy' ? 'border-green-500 text-green-600' :
                        word.learnLevel === 'medium' ? 'border-yellow-500 text-yellow-600' : 'border-red-500 text-red-600'
                    }">${word.learnLevel}</span>
                </div>
                <button onclick="toggleFavorite(${word.id})" class="text-lg text-gray-400 hover:text-amber-400">
                    <i class="${isFav ? 'fa-solid text-amber-400' : 'fa-regular'} fa-star"></i>
                </button>
            </div>
            <p class="text-base font-semibold mb-2 text-gray-800 dark:text-gray-200">${word.bangla}</p>
            <div class="flex items-center justify-between mb-4">
                <p class="text-sm text-gray-500 dark:text-gray-400 italic">"${word.example}"</p>
                <button onclick="speakWord('${word.example.replace(/'/g, "\\'")}')" title="বাক্যের উচ্চারণ শুনুন" class="ml-2 text-xs text-gray-400 hover:text-brand-600">
                    <i class="fa-solid fa-volume-low"></i>
                </button>
            </div>
            
            <button onclick="toggleLearned(${word.id})" class="w-full py-2 rounded-lg text-sm font-semibold border transition ${
                isLearned ? 'bg-green-600 text-white border-green-600' : 'border-gray-300 dark:border-gray-600 hover:border-brand-600'
            }">
                <i class="fa-solid ${isLearned ? 'fa-check' : 'fa-plus'} mr-1"></i> ${isLearned ? 'পড়া সম্পন্ন হয়েছে' : 'মার্ক করুন (Learned)'}
            </button>
        `;
        container.appendChild(card);
    });
}

function toggleLearned(id) {
    if (learnedWordIds.has(id)) learnedWordIds.delete(id);
    else learnedWordIds.add(id);

    localStorage.setItem('vt_learned_ids', JSON.stringify([...learnedWordIds]));
    renderLearnTab();
}

function toggleFavorite(id) {
    if (favoriteWordIds.has(id)) favoriteWordIds.delete(id);
    else favoriteWordIds.add(id);

    localStorage.setItem('vt_favorite_ids', JSON.stringify([...favoriteWordIds]));
    renderLearnTab();
}

function finishTodayTask() {
    const targetIndex = getTargetForDay(currentDay);
    const startIndex = getTargetForDay(currentDay - 1);
    const todayWords = vocabulary.slice(startIndex, targetIndex);

    todayWords.forEach(w => learnedWordIds.add(w.id));
    localStorage.setItem('vt_learned_ids', JSON.stringify([...learnedWordIds]));

    currentDay += 1;
    localStorage.setItem('vt_current_day', currentDay.toString());

    alert('অভিনন্দন! আজকের টাস্ক সম্পন্ন হয়েছে। আগামী দিনের টাস্ক আনলক করা হয়েছে।');
    renderDashboard();
    renderLearnTab();
}

// কুইজ এক্সাম লজিক (শর্ত অনুযায়ী প্রশ্ন সংখ্যা নির্ধারণ)
function startQuiz(type) {
    const learnedWords = vocabulary.filter(w => learnedWordIds.has(w.id));
    const learnedCount = learnedWords.length;
    
    // ২০টির কম পড়া হলে কুইজ হবে না
    if (learnedCount < 20) {
        alert(`দুঃখিত! কুইজ শুরু করার জন্য কমপক্ষে ২০টি শব্দ পড়া সম্পন্ন থাকতে হবে। আপনার পড়া আছে ${learnedCount}টি শব্দ।`);
        return;
    }

    let questionCount = 25; // ৩০ বা ৪০টি পড়া হলে ২৫টি প্রশ্ন
    if (learnedCount >= 50) {
        questionCount = 50; // ৫০ বা তার বেশি পড়া হলে ৫০টি র‍্যান্ডম প্রশ্ন
    }

    const quizArea = document.getElementById('quiz-area');
    const quizBox = document.getElementById('quiz-box');
    const quizResults = document.getElementById('quiz-results');
    
    quizArea.classList.remove('hidden');
    quizResults.classList.add('hidden');
    quizBox.innerHTML = '';

    const shuffled = [...learnedWords].sort(() => 0.5 - Math.random());
    const questions = shuffled.slice(0, Math.min(questionCount, shuffled.length));

    renderMCQQuiz(questions, learnedWords);
}

function renderMCQQuiz(questions, pool) {
    const quizBox = document.getElementById('quiz-box');
    quizBox.innerHTML = '';

    questions.forEach((q, idx) => {
        const wrongOptions = pool.filter(w => w.id !== q.id).sort(() => 0.5 - Math.random()).slice(0, 3);
        const options = [...wrongOptions, q].sort(() => 0.5 - Math.random());

        const qCard = document.createElement('div');
        qCard.className = "p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3 question-card";
        qCard.setAttribute('id', `q_card_${idx}`);
        qCard.innerHTML = `
            <div class="flex items-center justify-between">
                <p class="font-bold">${idx + 1}. "${q.english}" শব্দটির সঠিক অর্থ কোনটি?</p>
                <button onclick="speakWord('${q.english}')" class="text-gray-500 hover:text-brand-600"><i class="fa-solid fa-volume-high"></i></button>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2" id="options_container_${idx}">
                ${options.map(opt => `
                    <label class="flex items-center p-3 border dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 option-label" data-opt-id="${opt.id}">
                        <input type="radio" name="q_${idx}" value="${opt.id}" class="mr-2">
                        <span>${opt.bangla}</span>
                    </label>
                `).join('')}
            </div>
            <input type="hidden" id="ans_${idx}" value="${q.id}">
            <div id="feedback_${idx}" class="text-sm font-semibold mt-2 hidden"></div>
        `;
        quizBox.appendChild(qCard);
    });

    const submitBtn = document.createElement('button');
    submitBtn.className = "px-6 py-2.5 bg-brand-600 text-white font-bold rounded-lg mt-4 shadow";
    submitBtn.innerText = "উত্তর জমা দিন";
    submitBtn.onclick = () => evaluateMCQ(questions.length);
    quizBox.appendChild(submitBtn);
}

function evaluateMCQ(total) {
    let score = 0;
    let wrong = 0;

    for (let i = 0; i < total; i++) {
        const selected = document.querySelector(`input[name="q_${i}"]:checked`);
        const correctId = parseInt(document.getElementById(`ans_${i}`).value);
        const feedbackDiv = document.getElementById(`feedback_${i}`);
        const optionsContainer = document.getElementById(`options_container_${i}`);
        
        // সমস্ত লেবেল ডিজেবল করা
        const labels = optionsContainer.querySelectorAll('.option-label');
        labels.forEach(lbl => {
            const radio = lbl.querySelector('input');
            radio.disabled = true;
            const optId = parseInt(lbl.getAttribute('data-opt-id'));
            
            // সঠিক উত্তর সবুজ করা[span_4](start_span)[span_4](end_span)
            if (optId === correctId) {
                lbl.classList.add('bg-green-100', 'dark:bg-green-900/40', 'border-green-500', 'text-green-700', 'dark:text-green-300');
            }
        });

        if (selected) {
            const selectedVal = parseInt(selected.value);
            if (selectedVal === correctId) {
                score++;
                feedbackDiv.innerHTML = `<span class="text-green-600">আপনার উত্তর সঠিক!</span>`;
            } else {
                wrong++;
                // ভুল উত্তর লাল করা[span_5](start_span)[span_5](end_span)
                labels.forEach(lbl => {
                    const optId = parseInt(lbl.getAttribute('data-opt-id'));
                    if (optId === selectedVal) {
                        lbl.classList.add('bg-red-100', 'dark:bg-red-900/40', 'border-red-500', 'text-red-700', 'dark:text-red-300');
                    }
                });
                feedbackDiv.innerHTML = `<span class="text-red-500">আপনার উত্তর ভুল ছিল। সঠিক উত্তরটি সবুজ রঙে চিহ্নিত করা হয়েছে।</span>`;
            }
        } else {
            wrong++;
            feedbackDiv.innerHTML = `<span class="text-yellow-500">আপনি কোনো উত্তর নির্বাচন করেননি। সঠিক উত্তরটি সবুজ রঙে চিহ্নিত করা হয়েছে।</span>`;
        }
        feedbackDiv.classList.remove('hidden');
    }

    // সাবমিট বাটন হাইড করা যাতে দুবার সাবমিট না হয়
    event.target.style.display = 'none';

    const res = document.getElementById('quiz-results');
    res.innerText = `পরীক্ষার ফলাফল: আপনি ${total} টির মধ্যে ${score} টি সঠিক এবং ${wrong} টি ভুল উত্তর দিয়েছেন!`;
    res.classList.remove('hidden');

    // ডাটাবেস/লোকালস্টোরেজে সংরক্ষণ[span_6](start_span)[span_6](end_span)
    saveExamRecord(total, score, wrong);
}

function saveExamRecord(total, score, wrong) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('bn-BD') + ' ' + now.toLocaleTimeString('bn-BD');
    const percentage = Math.round((score / total) * 100) + '%';

    const record = {
        date: dateStr,
        totalQuestions: total,
        correctAnswers: score,
        wrongAnswers: wrong,
        scorePercentage: percentage
    };

    examHistory.unshift(record); // নতুন রেকর্ড প্রথমে যুক্ত হবে
    localStorage.setItem('vt_exam_history', JSON.stringify(examHistory));
    renderExamHistory();
}

function renderExamHistory() {
    const tbody = document.getElementById('exam-history-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (examHistory.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-gray-500">এখনও কোনো এক্সাম দেওয়া হয়নি।</td></tr>`;
        return;
    }

    examHistory.forEach(item => {
        const row = document.createElement('tr');
        row.className = "border-b dark:border-gray-700 text-sm";
        row.innerHTML = `
            <td class="py-3 px-4">${item.date}</td>
            <td class="py-3 px-4 font-semibold">${item.totalQuestions}</td>
            <td class="py-3 px-4 text-emerald-600 font-bold">${item.correctAnswers}</td>
            <td class="py-3 px-4 text-red-500 font-bold">${item.wrongAnswers}</td>
            <td class="py-3 px-4 font-extrabold text-brand-600">${item.scorePercentage}</td>
        `;
        tbody.appendChild(row);
    });
}

function renderFavorites() {
    const container = document.getElementById('favorites-container');
    container.innerHTML = '';

    const favWords = vocabulary.filter(w => favoriteWordIds.has(w.id));

    if (favWords.length === 0) {
        container.innerHTML = `<p class="col-span-full text-center text-gray-500 py-10">আপনার পছন্দের কোনো শব্দ এখনও বুকমার্ক করেননি!</p>`;
        return;
    }

    favWords.forEach(word => {
        const card = document.createElement('div');
        card.className = "p-5 rounded-xl border bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700";
        card.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div class="flex items-center space-x-2">
                    <h3 class="text-lg font-bold text-brand-600 dark:text-brand-400">${word.english}</h3>
                    <button onclick="speakWord('${word.english}')" class="text-gray-500 hover:text-brand-600"><i class="fa-solid fa-volume-high"></i></button>
                </div>
                <button onclick="toggleFavorite(${word.id}); renderFavorites();" class="text-amber-400">
                    <i class="fa-solid fa-star"></i>
                </button>
            </div>
            <p class="text-base font-semibold mb-2">${word.bangla}</p>
            <p class="text-sm text-gray-500 dark:text-gray-400 italic">"${word.example}"</p>
        `;
        container.appendChild(card);
    });
}

function renderUpdateJsonTab() {
    const area = document.getElementById('jsonUpdateArea');
    if (area) {
        area.value = JSON.stringify(vocabulary, null, 2);
    }
}

function handleAddNewWord(e) {
    e.preventDefault();
    const english = document.getElementById('newEnglish').value.trim();
    const bangla = document.getElementById('newBangla').value.trim();
    const example = document.getElementById('newExample').value.trim();
    const learnLevel = document.getElementById('newLevel').value;

    if (!english || !bangla) return;

    const maxId = vocabulary.reduce((max, item) => item.id > max ? item.id : max, 0);
    const newWordObj = {
        id: maxId + 1,
        english,
        bangla,
        example,
        learnLevel
    };

    vocabulary.push(newWordObj);
    localStorage.setItem('vt_custom_json', JSON.stringify(vocabulary));

    document.getElementById('addWordForm').reset();
    renderUpdateJsonTab();
    alert(`"${english}" শব্দটিকে সফলভাবে যোগ করা হয়েছে!`);
}

function saveBulkJSONFromArea() {
    const areaVal = document.getElementById('jsonUpdateArea').value;
    try {
        const parsed = JSON.parse(areaVal);
        if (Array.isArray(parsed)) {
            vocabulary = parsed;
            localStorage.setItem('vt_custom_json', JSON.stringify(parsed));
            alert('JSON সফলভাবে আপডেট ও লোকাল মেমরিতে সেভ করা হয়েছে!');
        } else {
            alert('JSON টি অবশ্যই একটি Array হতে হবে!');
        }
    } catch (e) {
        alert('অকার্যকর JSON ফরম্যাট!');
    }
}

function resetToOriginalJSON() {
    if (confirm("আপনি কি নিশ্চিত যে লোকাল পরিবর্তন মুছে মূল ফাইল ডাটাতে ফিরে যেতে চান?")) {
        localStorage.removeItem('vt_custom_json');
        loadVocabularyData().then(() => {
            renderUpdateJsonTab();
            alert("অরিজিনাল ডাটায় রিকভার করা হয়েছে।");
        });
    }
}

function downloadUpdatedJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(vocabulary, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "vocabulary.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}
