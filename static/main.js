let calendar;
let selectedDate = null;
let selectedDiaryId = null; 
let diaries = []; 
const deleteDiaryButton = document.getElementById('deleteDiary');


const init = () => {
    const kakaoButton = document.querySelector("#kakao");
    const logoutButton = document.querySelector("#logout");

    if (kakaoButton) kakaoButton.addEventListener('click', onKakao);
    if (logoutButton) logoutButton.addEventListener('click', onLogout);
    
    setupModal();
    initCalendar();
    autoLogin();
    redirectPage();
    fetchTodayMusic();
};

const redirectPage = () => {
    if (window.location.pathname.startsWith('/oauth')) {
        window.close();
    }
};
const modal = document.getElementById("diaryModal");
const closeModal = document.querySelector(".close");
const saveDiaryButton = document.getElementById("saveDiary");
const updateDiaryButton = document.getElementById("updateDiary");

const setupModal = () => {
    if (closeModal) {
        closeModal.onclick = () => {
            if (modal) modal.style.display = "none";
        };
    } else {
        console.error('Close modal button not found');
    }

    window.onclick = (event) => {
        if (modal && event.target === modal) {
            modal.style.display = "none";
        }
    };

    if (saveDiaryButton) {
        saveDiaryButton.onclick = async () => {
            const diaryTitle = document.getElementById('diaryTitle').value;
            const diaryText = document.getElementById('writeDiaryText').value;
            const diaryEmotion = document.getElementById('diaryEmotion').value; 
        
            if (selectedDate && diaryTitle && diaryText) {
                try {
                    await saveNewDiary(selectedDate, diaryTitle, diaryText, diaryEmotion);
                    calendar.refetchEvents();
                    modal.style.display = "none";
                } catch (error) {
                    console.error('Failed to save diary:', error);
                }
            }
        };
    }

    if (updateDiaryButton) {
        updateDiaryButton.onclick = async () => {
            const diaryTitle = document.getElementById('diaryTitle').value;
            const diaryText = document.getElementById('writeDiaryText').value;
            const diaryEmotion = document.getElementById('diaryEmotion').value;
            if (selectedDiaryId && diaryTitle && diaryText) {
                try {
                    console.log("Updating diary with ID:", selectedDiaryId);
                    await updateDiary(selectedDiaryId, diaryTitle, diaryText, diaryEmotion);
                    calendar.refetchEvents();
                    modal.style.display = "none";
                } catch (error) {
                    console.error('Failed to update diary:', error);
                }
            } else {
                console.error('Diary ID, title, or content missing');
            }
        };
    }

    if (deleteDiaryButton) {
        deleteDiaryButton.onclick = async () => {
            if (selectedDiaryId) {
                try {
                    await deleteDiary(selectedDiaryId);
                    calendar.refetchEvents();
                    modal.style.display = "none";
                } catch (error) {
                    console.error('Failed to delete diary:', error);
                }
            } else {
                console.error('No diary selected for deletion');
            }
        };
    }
};

const initCalendar = () => {
    const calendarEl = document.getElementById('calendar');
    
    if (calendarEl) {
        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            events: fetchEvents,
            dateClick: handleDateClick,
            editable: true,
            droppable: true
        });
        calendar.render();
    } else {
        console.error('Calendar element not found');
    }
};

const fetchEvents = async (info, successCallback, failureCallback) => {
    try {
        const events = await makeAuthorizedRequest('/diary/events');
        successCallback(events);
    } catch (error) {
        failureCallback(error);
    }
};

const handleDateClick = async (info) => {
    selectedDate = info.dateStr;

    try {
        const response = await fetch(`/diary/event?date=${selectedDate}`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
            const data = await response.json();
            diaries = data.diaries || [];
            populateDiaryList(diaries);

            if (diaries.length > 0) {
                const firstDiary = diaries[0];
                console.log('First Diary:', firstDiary);  
                console.log('Emotion:', firstDiary.emotion); 

                selectedDiaryId = firstDiary.diary_id;
                
                document.getElementById('viewDiaryText').value = firstDiary.content || '';
                document.getElementById('writeDiaryText').value = firstDiary.content || '';
                document.getElementById('diaryTitle').value = firstDiary.title || '';
                document.getElementById('viewDiaryTitle').value = firstDiary.title || '';
                
                if (firstDiary.emotion) {
                    document.getElementById('viewDiaryEmotion').value = firstDiary.emotion || ''; 
                    document.getElementById('diaryEmotion').value = firstDiary.emotion || '';
                } else {
                    document.getElementById('viewDiaryEmotion').value = ''; 
                    document.getElementById('diaryEmotion').value = '';
                }

                document.getElementById('modalTitle').textContent = `View Diary: ${firstDiary.title}`;
                await requestMusicRecommendation();
            } else {
                selectedDiaryId = null;
                document.getElementById('viewDiaryText').value = '';
                document.getElementById('writeDiaryText').value = '';
                document.getElementById('diaryTitle').value = '';
                document.getElementById('viewDiaryTitle').value = '';
                document.getElementById('viewDiaryEmotion').value = ''; 
                document.getElementById('modalTitle').textContent = 'View Diary';
            }
        } else {
            selectedDiaryId = null;
            console.error('Failed to fetch diary entries');
        }
    } catch (error) {
        selectedDiaryId = null;
        console.error('Error fetching diary entries:', error);
    }

    if (modal) modal.style.display = "block";
};

const populateDiaryList = (diaries) => {
    const diaryList = document.getElementById('diaryList');
    diaryList.innerHTML = '';

    if (!diaries || diaries.length === 0) {
        console.error('No diaries available to display');
        return;  
    }

    diaries.forEach((diary, index) => {
        const option = document.createElement('option');
        option.value = diary.diary_id;
        option.textContent = `Diary ${index + 1}: ${diary.title} - ${diary.date} (${diary.emotion || ''})`;
        diaryList.appendChild(option);
    });

    diaryList.onchange = () => {
        const selectedId = diaryList.value;
        const selectedDiary = diaries.find(diary => diary.diary_id == selectedId);
        if (selectedDiary) {
            selectedDiaryId = selectedDiary.diary_id;
            document.getElementById('diaryTitle').value = selectedDiary.title || '';
            document.getElementById('viewDiaryText').value = selectedDiary.content || '';
            document.getElementById('writeDiaryText').value = selectedDiary.content || '';
            document.getElementById('viewDiaryTitle').value = selectedDiary.title || '';
            document.getElementById('viewDiaryEmotion').value = selectedDiary.emotion || ''; 
        }
    };
};

const requestMusicRecommendation = async () => {
    console.log('Requesting music recommendation...');

    if (!selectedDiaryId) {
        console.error('No diary selected for music recommendation');
        return;
    }

    try {
        const selectedDiary = diaries.find(diary => diary.diary_id === selectedDiaryId);

        if (!selectedDiary) {
            console.error('Diary not found for the selected ID');
            return;
        }

        const emotion = document.getElementById('diaryEmotion').value;
        console.log('Emotion from diaryEmotion element:', emotion);

        if (!emotion) {
            console.error('No emotion selected');
            return;
        }

        const payload = {
            user_id: selectedDiary.user_id,
            diary: selectedDiary.content,
            emotion: [emotion], 
            filter: {} 
        };

        console.log('Payload being sent:', payload);

        const response = await makeAuthorizedRequest('/api/rcmd/openai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        console.log('Full API response:', response);

        if (Array.isArray(response)) {
            displayRecommendedMusic(response);
            for (const music of response) {
                await saveMusicToDatabase(selectedDiaryId, music);
            }
        } else {
            console.error('Failed to get music recommendation', response);
        }
    } catch (error) {
        console.error('Error requesting music recommendation:', error);
    }
};

const displayRecommendedMusic = (recommendations) => {
    const recommendationContainer = document.getElementById('musicRecommendations');
    recommendationContainer.innerHTML = '';

    recommendations.forEach(music => {
        console.log('Music URL:', music.url);
        const musicItem = document.createElement('div');
        musicItem.classList.add('music-item');
        musicItem.innerHTML = `
            <p>Title: ${music.title}</p>
            <p>Artist: ${music.artist}</p>
            <a href="${music.url}" target="_blank">Listen</a>
        `;
        recommendationContainer.appendChild(musicItem);
    });
};

const saveMusicToDatabase = async (diaryId, music) => {
    try {
        const response = await makeAuthorizedRequest('/diary/save_music', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                diary_id: diaryId,
                artist: music.artist,
                url: music.url,
                music_title: music.title
            })
        });

        if (response.result) {
            console.log('Music saved successfully:', music);
        } else {
            console.error('Failed to save music:', response);
        }
    } catch (error) {
        console.error('Error saving music to database:', error);
    }
};

const saveNewDiary = async (date, title, content, emotion) => {
    try {
        const response = await makeAuthorizedRequest('/diary/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date, title, content, emotion })
        });

        console.log('Response:', response);

        if (typeof response === 'object' && response.result) {
            console.log('Diary saved successfully');
            return response; 
        } else {
            const errorText = response ? response.error || response : 'Unknown error';
            console.error('Server Error:', errorText);
            throw new Error('Failed to save diary: ' + errorText);
        }

    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
};

const updateDiary = async (diaryId, title, content, emotion) => {
    await makeAuthorizedRequest(`/diary/update/${diaryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, emotion })  
    });
};

const deleteDiary = async (diaryId) => {
    try {
        const response = await makeAuthorizedRequest(`/diary/delete/${diaryId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.result) {
            console.log('Diary deleted successfully');
        } else {
            const errorText = response ? response.error || response : 'Unknown error';
            console.error('Server Error:', errorText);
            throw new Error('Failed to delete diary: ' + errorText);
        }

    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
};

const getCookie = (cookieName) => {
    const cookies = document.cookie ? document.cookie.split('; ') : [];
    const cookie = cookies.find(row => row.startsWith(`${encodeURIComponent(cookieName)}=`));
    return cookie ? decodeURIComponent(cookie.split('=')[1]) : null;
};

const makeAuthorizedRequest = async (url, options = {}, retryCount = 0) => {
    try {
        const csrfToken = getCookie('csrf_access_token');
        const response = await fetch(url, {
            ...options,
            credentials: 'include',
            headers: {
                ...options.headers,
                'X-CSRF-TOKEN': csrfToken,
            }
        });

        if (response.status === 401 && retryCount < 1) {
            const refreshed = await handleTokenExpiration();
            if (refreshed) {
                return makeAuthorizedRequest(url, options, retryCount + 1);
            } else {
                throw new Error('Authorization failed after token refresh');
            }
        }

        if (!response.ok) throw new Error(`Request failed: ${response.statusText}`);

        const contentType = response.headers.get('Content-Type');
        if (contentType && contentType.includes('application/json')) {
            return response.json(); 
        }
    } catch (error) {
        console.error('Request error:', error);
        throw error;
    }
};

const handleTokenExpiration = async () => {
    try {
        const response = await fetch("/token/refresh", {
            method: 'POST',
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            return data.result;
        } else {
            await handleLogoutAndReauth();
            return false;
        }
    } catch (error) {
        console.error(`Error during token refresh: ${error}`);
        return false;
    }
};

const autoLogin = async () => {
    try {
        const token = getCookie('access_token_cookie');
        if (!token) return;

        const response = await fetch("/userinfo", {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.username) {
                document.querySelector("#username").textContent = data.username;
                document.querySelector("#kakao").classList.add('display_none');
                document.querySelector("#logout").classList.remove('display_none');
                document.querySelector("#username").classList.remove('display_none');
                window.location.href = "/static/home.html";
            }
        } else if (response.status === 401) {
            const refreshed = await handleTokenExpiration();
            if (!refreshed) {
                window.location.href = "/static/index.html";
            }
        } else {
            console.error("Error fetching user info:", response.statusText);
            window.location.href = "/static/index.html";
        }
    } catch (error) {
        console.error(`Error during auto login: ${error}`);
        window.location.href = "/static/index.html";
    }
};

const handleLogoutAndReauth = async () => {
    await onLogout();
    window.location.href = "/";
};

const onKakao = async () => {
    document.querySelector("#loading").classList.remove('display_none');
    
    try {
        const url = await fetch("/oauth/url")
            .then(res => res.json())
            .then(res => res['kakao_oauth_url']);

        const newWindow = openWindowPopup(url, "카카오톡 로그인");

        if (!newWindow) throw new Error('Failed to open the popup window.');

        const checkConnect = setInterval(() => {
            if (!newWindow || newWindow.closed) {
                clearInterval(checkConnect);
                if (getCookie('logined') === 'true') {
                    window.location.href = "/static/home.html";
                } else {
                    document.querySelector("#loading").classList.add('display_none');
                }
            }
        }, 1000);
    } catch (error) {
        console.error("Error during Kakao login:", error);
        document.querySelector("#loading").classList.add('display_none');
    }
};

const fetchTodayMusic = async () => {
    try {
        const response = await fetch('/today_music', {
            method: 'GET',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
            const data = await response.json();
            console.log('오늘의 음악 목록:', data.music);

            const todayMusicContainer = document.getElementById('todayMusicContainer');
            todayMusicContainer.innerHTML = ''; 

            data.music.forEach(music => {
                const musicItem = document.createElement('div');
                musicItem.innerHTML = `
                    <p>${music.music_title} - ${music.artist}</p>
                    <a href="${music.url}" target="_blank">Listen</a>
                `;
                todayMusicContainer.appendChild(musicItem);
            });

            document.getElementById('todayMusic').style.display = 'block';

        } else {
            console.error('오늘의 음악을 가져오지 못했습니다.');
        }
    } catch (error) {
        console.error('Error fetching today\'s music:', error);
    }
};

const openWindowPopup = (url, name) => {
    const options = 'top=10, left=10, width=500, height=600, status=no, menubar=no, toolbar=no, resizable=no';
    return window.open(url, name, options);
};

const onLogout = async () => {
    try {
        const response = await fetch("/token/remove");
        const data = await response.json();

        if (data.result) {
            if (!window.skipLogoutAlert) {
                alert("정상적으로 로그아웃이 되었습니다.");
                window.location.href = "/";
            }
        } else {
            console.log("로그아웃 실패");
        }
    } catch (error) {
        console.error("로그아웃 요청 중 오류 발생:", error);
    }
};


init();