let vocabulary = [];
let learnedWordIds = new Set(JSON.parse(localStorage.getItem('vt_learned_ids') || '[]'));
let favoriteWordIds = new Set(JSON.parse(localStorage.getItem('vt_favorite_ids') || '[]'));
let currentDay = parseInt(localStorage.getItem('vt_current_day') || '1');

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

function startQuiz(type) {
    const learnedWords = vocabulary.filter(w => learnedWordIds.has(w.id));
    
    if (learnedWords.length < 4) {
        alert("কুইজ শুরু করার জন্য অন্তত ৪টি শব্দ পড়া সম্পন্ন (Mark Learned) থাকতে হবে!");
        return;
    }

    const quizArea = document.getElementById('quiz-area');
    const quizBox = document.getElementById('quiz-box');
    const quizResults = document.getElementById('quiz-results');
    
    quizArea.classList.remove('hidden');
    quizResults.classList.add('hidden');
    quizBox.innerHTML = '';

    const shuffled = [...learnedWords].sort(() => 0.5 - Math.random());
    const questions = shuffled.slice(0, 5);

    if (type === 'mcq') {
        renderMCQQuiz(questions, learnedWords);
    } else {
        renderWrittenQuiz(questions);
    }
}

function renderMCQQuiz(questions, pool) {
    const quizBox = document.getElementById('quiz-box');
    quizBox.setAttribute('data-quiz-type', 'mcq');

    questions.forEach((q, idx) => {
        const wrongOptions = pool.filter(w => w.id !== q.id).sort(() => 0.5 - Math.random()).slice(0, 3);
        const options = [...wrongOptions, q].sort(() => 0.5 - Math.random());

        const qCard = document.createElement('div');
        qCard.className = "p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3";
        qCard.innerHTML = `
            <div class="flex items-center justify-between">
                <p class="font-bold">${idx + 1}. "${q.english}" শব্দটির সঠিক অর্থ কোনটি?</p>
                <button onclick="speakWord('${q.english}')" class="text-gray-500 hover:text-brand-600"><i class="fa-solid fa-volume-high"></i></button>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                ${options.map(opt => `
                    <label class="flex items-center p-3 border dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                        <input type="radio" name="q_${idx}" value="${opt.id}" class="mr-2">
                        <span>${opt.bangla}</span>
                    </label>
                `).join('')}
            </div>
            <input type="hidden" id="ans_${idx}" value="${q.id}">
        `;
        quizBox.appendChild(qCard);
    });

    const submitBtn = document.createElement('button');
    submitBtn.className = "px-6 py-2.5 bg-brand-600 text-white font-bold rounded-lg mt-4";
    submitBtn.innerText = "উত্তর জমা দিন";
    submitBtn.onclick = () => evaluateMCQ(questions.length);
    quizBox.appendChild(submitBtn);
}

function evaluateMCQ(total) {
    let score = 0;
    for (let i = 0; i < total; i++) {
        const selected = document.querySelector(`input[name="q_${i}"]:checked`);
        const correctId = document.getElementById(`ans_${i}`).value;
        if (selected && selected.value === correctId) {
            score++;
        }
    }

    const res = document.getElementById('quiz-results');
    res.innerText = `পরীক্ষার ফলাফল: আপনি ${total} টির মধ্যে ${score} টি সঠিক উত্তর দিয়েছেন!`;
    res.classList.remove('hidden');
}

function renderWrittenQuiz(questions) {
    const quizBox = document.getElementById('quiz-box');
    quizBox.innerHTML = '';

    questions.forEach((q, idx) => {
        const qCard = document.createElement('div');
        qCard.className = "p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3";
        qCard.innerHTML = `
            <p class="font-bold">${idx + 1}. "<strong>${q.bangla}</strong>" এর ইংরেজি শব্দ কী?</p>
            <input type="text" id="written_ans_${idx}" class="w-full p-2 border rounded-lg dark:bg-gray-900 border-gray-300 dark:border-gray-700" placeholder="ইংরেজি বানানটি লিখুন...">
            <input type="hidden" id="written_correct_${idx}" value="${q.english.toLowerCase().trim()}">
        `;
        quizBox.appendChild(qCard);
    });

    const submitBtn = document.createElement('button');
    submitBtn.className = "px-6 py-2.5 bg-purple-600 text-white font-bold rounded-lg mt-4";
    submitBtn.innerText = "লিখিত উত্তর জমা দিন";
    submitBtn.onclick = () => evaluateWritten(questions.length);
    quizBox.appendChild(submitBtn);
}

function evaluateWritten(total) {
    let score = 0;
    for (let i = 0; i < total; i++) {
        const userAns = document.getElementById(`written_ans_${i}`).value.toLowerCase().trim();
        const correctAns = document.getElementById(`written_correct_${i}`).value;
        if (userAns === correctAns) {
            score++;
        }
    }

    const res = document.getElementById('quiz-results');
    res.innerText = `পরীক্ষার ফলাফল: আপনি ${total} টির মধ্যে ${score} টি সঠিক ইংরেজি লিখতে পেরেছেন!`;
    res.classList.remove('hidden');
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
