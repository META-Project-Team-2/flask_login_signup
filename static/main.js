// Calendar 관련
let calendar;
let selectedDate = null;
let selectedDiaryId = null; // 선택한 일기의 ID를 저장할 변수
let diaries = []; // 해당 날짜에 저장된 일기 목록을 저장할 변수

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
                selectedDiaryId = firstDiary.diary_id;
                
                document.getElementById('viewDiaryText').value = firstDiary.content || '';
                document.getElementById('writeDiaryText').value = firstDiary.content || '';
                document.getElementById('diaryTitle').value = firstDiary.title || '';
                document.getElementById('viewDiaryTitle').value = firstDiary.title || '';
                document.getElementById('modalTitle').textContent = `View Diary: ${firstDiary.title}`;
            } else {
                selectedDiaryId = null;
                document.getElementById('viewDiaryText').value = '';
                document.getElementById('writeDiaryText').value = '';
                document.getElementById('diaryTitle').value = '';
                document.getElementById('viewDiaryTitle').value = '';
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

    diaries.forEach((diary, index) => {
        const option = document.createElement('option');
        option.value = diary.diary_id;
        option.textContent = `Diary ${index + 1}: ${diary.title} - ${diary.date}`;
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
        }
    };
};

// Modal 관련
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
            if (selectedDate && diaryTitle && diaryText) {
                try {
                    await saveNewDiary(selectedDate, diaryTitle, diaryText);
                    calendar.refetchEvents();
                    modal.style.display = "none";
                } catch (error) {
                    console.error('Failed to save diary:', error);
                }
            }
        };
    } else {
        console.error('Save diary button not found');
    }

    if (updateDiaryButton) {
        updateDiaryButton.onclick = async () => {
            const diaryTitle = document.getElementById('diaryTitle').value;
            const diaryText = document.getElementById('writeDiaryText').value;
            if (selectedDiaryId && diaryTitle && diaryText) {
                try {
                    console.log("Updating diary with ID:", selectedDiaryId);
                    await updateDiary(selectedDiaryId, diaryTitle, diaryText);
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
};

// Diary 관련
const saveNewDiary = async (date, title, content) => {
    await makeAuthorizedRequest('/diary/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, title, content })
    });
};

const updateDiary = async (diaryId, title, content) => {
    await makeAuthorizedRequest(`/diary/update/${diaryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content })
    });
};

// 인증 관련 함수 등은 기존과 동일
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

        return response.json();
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

const refreshToken = async () => {
    try {
        const data = await fetch("/token/refresh").then(res => res.json());
        if (data.result) {
            console.log("Access Token 갱신");
            document.cookie = `access_token_cookie=${data.access_token}; path=/; SameSite=Lax`;
            console.log("새로 저장된 토큰:", getCookie('access_token_cookie'));
            return true;
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

const openWindowPopup = (url, name) => {
    const options = 'top=10, left=10, width=500, height=600, status=no, menubar=no, toolbar=no, resizable=no';
    return window.open(url, name, options);
};

// 초기화
const init = () => {
    const kakaoButton = document.querySelector("#kakao");
    const logoutButton = document.querySelector("#logout");

    if (kakaoButton) kakaoButton.addEventListener('click', onKakao);
    if (logoutButton) logoutButton.addEventListener('click', onLogout);
    
    setupModal();
    initCalendar();
    autoLogin();
    redirectPage();
};

const redirectPage = () => {
    if (window.location.pathname.startsWith('/oauth')) {
        window.close();
    }
};

init();
