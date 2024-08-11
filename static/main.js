let calendar;

const getCookie = (cookieName) => {
    const cookies = document.cookie ? document.cookie.split('; ') : [];
    const cookie = cookies.find(row => row.startsWith(`${encodeURIComponent(cookieName)}=`));
    return cookie ? decodeURIComponent(cookie.split('=')[1]) : null;
};

document.addEventListener('DOMContentLoaded', () => {
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
});

const fetchEvents = async (info, successCallback, failureCallback) => {
    try {
        const events = await makeAuthorizedRequest('/diary/events');
        successCallback(events);
    } catch (error) {
        failureCallback(error);
    }
};

const handleDateClick = (info) => {
    selectedDate = info.dateStr;
    document.getElementById('diaryText').value = '';
    if (modal) modal.style.display = "block";
};

const modal = document.getElementById("diaryModal");
const closeModal = document.querySelector(".close");
const saveDiaryButton = document.getElementById("saveDiary");
let selectedDate = null;

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
        const diaryText = document.getElementById('diaryText').value;
        if (selectedDate && diaryText) {
            try {
                await saveDiary(selectedDate, diaryText);
                calendar.refetchEvents();
            } catch (error) {
                console.error('Failed to save diary:', error);
            }
        }
    };
} else {
    console.error('Save diary button not found');
}

const saveDiary = async (date, content) => {
    await makeAuthorizedRequest('/diary/save', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ date, content })
    });

    if (modal) modal.style.display = "none";
};

const makeAuthorizedRequest = async (url, options = {}, retryCount = 0) => {
    try {
        const token = getCookie('access_token_cookie');
        console.log("요청에 사용된 토큰:", token); // 요청에 사용된 토큰 로그 추가
        const response = await fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.status === 401 && retryCount < 1) {
            const refreshed = await handleTokenExpiration();
            if (refreshed) {
                return makeAuthorizedRequest(url, options, retryCount + 1); // 갱신 후 한 번만 재시도
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

const refreshToken = async () => {
    try {
        const data = await fetch("/token/refresh").then(res => res.json());
        if (data.result) {
            console.log("Access Token 갱신");
            // 새로 갱신된 토큰을 쿠키에 저장
            document.cookie = `access_token_cookie=${data.access_token}; path=/; SameSite=Lax`;
            console.log("새로 저장된 토큰:", getCookie('access_token_cookie')); // 새로 저장된 토큰 로그 추가
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

const init = () => {
    const kakaoButton = document.querySelector("#kakao");
    const logoutButton = document.querySelector("#logout");

    if (kakaoButton) kakaoButton.addEventListener('click', onKakao);
    if (logoutButton) logoutButton.addEventListener('click', onLogout);
    
    autoLogin();
    redirectPage();
};

const openWindowPopup = (url, name) => {
    const options = 'top=10, left=10, width=500, height=600, status=no, menubar=no, toolbar=no, resizable=no';
    return window.open(url, name, options);
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

const redirectPage = () => {
    if (window.location.pathname.startsWith('/oauth')) {
        window.close();
    }
};

const autoLogin = async () => {
    try {
        const token = getCookie('access_token_cookie');
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
            await handleTokenExpiration();
        } else {
            console.error("Error fetching user info:", response.statusText);
        }
    } catch (error) {
        console.error(`Error during auto login: ${error}`);
    }
};

const handleTokenExpiration = async () => {
    const refreshed = await refreshToken();
    if (refreshed) {
        await autoLogin();
    } else {
        alert('로그인이 만료되었습니다. 다시 로그인 해주세요.');
    }
    return refreshed;
};

const onLogout = async () => {
    try {
        const response = await fetch("/token/remove");
        const data = await response.json();

        if (data.result) {
            alert("정상적으로 로그아웃이 되었습니다.");
            window.location.href = "/";
        } else {
            console.log("로그아웃 실패");
        }
    } catch (error) {
        console.error("로그아웃 요청 중 오류 발생:", error);
    }
};

init();
