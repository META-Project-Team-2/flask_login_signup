document.addEventListener('DOMContentLoaded', () => {
    const calendarEl = document.getElementById('calendar');
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        events: async function(info, successCallback, failureCallback) {
            try {
                const response = await fetch('/diary/events');
                const events = await response.json();
                successCallback(events); 
            } catch (error) {
                failureCallback(error);
            }
        },
        dateClick: handleDateClick, 
        editable: true,
        droppable: true 
    });
    calendar.render();


    const modal = document.getElementById("diaryModal");
    const closeModal = document.querySelector(".close");
    const saveDiaryButton = document.getElementById("saveDiary");
    let selectedDate = null;


    function handleDateClick(info) {
        selectedDate = info.dateStr;
        document.getElementById('diaryText').value = ''; 
        modal.style.display = "block";
    }

    
    closeModal.onclick = function() {
        modal.style.display = "none";
    }

    window.onclick = function(event) {
        if (event.target === modal) {
            modal.style.display = "none";
        }
    }


    saveDiaryButton.onclick = async function() {
        const diaryText = document.getElementById('diaryText').value;
        if (selectedDate && diaryText) {
            try {
                await fetch('/diary/save', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ date: selectedDate, content: diaryText })
                });
                modal.style.display = "none";
                calendar.refetchEvents(); 
            } catch (error) {
                console.error('Error saving diary:', error);
            }
        }
    }
});

const init = () => {
    const kakaoButton = document.querySelector("#kakao");
    const logoutButton = document.querySelector("#logout");

    if (kakaoButton) {
        kakaoButton.addEventListener('click', onKakao);
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', onLogout);
    } else {
        console.error("Logout button not found.");
    }

    autoLogin();
    redirectPage();
}

// 팝업창 열기
const openWindowPopup = (url, name) => {
    var options = 'top=10, left=10, width=500, height=600, status=no, menubar=no, toolbar=no, resizable=no';
    return window.open(url, name, options);
}

// 카카오 OAuth
const onKakao = async () => {
    document.querySelector("#loading").classList.remove('display_none');
    try {
        let url = await fetch("/oauth/url")
            .then(res => res.json())
            .then(res => res['kakao_oauth_url']);

        const newWindow = openWindowPopup(url, "카카오톡 로그인");

        const checkConnect = setInterval(function() {
            if (!newWindow || !newWindow.closed) return;
            clearInterval(checkConnect);
            
            if (getCookie('logined') === 'true') {
                window.location.href = "/static/home.html";
            } else {
                document.querySelector("#loading").classList.add('display_none');
            }
        }, 1000);
    } catch (error) {
        console.error("Error during Kakao login:", error);
    }
}

// OAuth 로그인 후, 리다이렉트 페이지
const redirectPage = () => {
    const pathname = window.location.pathname;
    if (pathname.startsWith('/oauth')) {
        window.close();
    }
}

const autoLogin = async () => {
    try {
        let data = await fetch("/userinfo")
            .then(res => res.json());

        if (data['msg']) {
            if (data['msg'] === `Missing cookie "access_token_cookie"`) {
                console.log("자동로그인 실패");
                return;
            } else if (data['msg'] === `Token has expired`) {
                console.log("Access Token 만료");
                await refreshToken();
                return;
            }
        } else {
            console.log("자동로그인 성공");
            const nickname = document.querySelector("#nickname");
            const thumbnail = document.querySelector("#thumbnail");

            nickname.textContent = `${data.nickname}`;
            thumbnail.src = data.profile;

            document.querySelector('#kakao').classList.add('display_none');
            document.querySelector('#logout').classList.remove('display_none');
            nickname.classList.remove('display_none');
            thumbnail.classList.remove('display_none');

            window.location.href = "/static/home.html";
        }
    } catch (error) {
        console.error(`Error during auto login: ${error}`);
    }
}

const refreshToken = async () => {
    try {
        let data = await fetch("/token/refresh")
            .then(res => res.json());

        if (data.result) {
            console.log("Access Token 갱신");
            await autoLogin();
        } else {
            if (data.msg === `Token has expired`) {
                console.log("Refresh Token 만료");
                document.querySelector('#kakao').classList.remove('display_none');
                document.querySelector('#logout').classList.add('display_none');
                document.querySelector("#nickname").classList.add('display_none');
                document.querySelector("#thumbnail").classList.add('display_none');
        
                await onKakao();
                return;
            }

            await fetch("/token/remove");
            alert("로그인을 다시 해주세요!");

            document.querySelector('#kakao').classList.remove('display_none');
            document.querySelector('#logout').classList.add('display_none');
            document.querySelector("#nickname").classList.add('display_none');
            document.querySelector("#thumbnail").classList.add('display_none');
        }
    } catch (error) {
        console.error(`Error during token refresh: ${error}`);
    }
}

const onLogout = async () => {
    try {
        let response = await fetch("/token/remove");
        let data = await response.json();

        if (data.result) {
            console.log("로그아웃 성공");
            alert("정상적으로 로그아웃이 되었습니다.");
            window.location.href = "/";
        } else {
            console.log("로그아웃 실패");
        }
    } catch (error) {
        console.error("로그아웃 요청 중 오류 발생:", error);
    }
}

const getCookie = (cookieName) => {
    let cookieValue = null;
    if (document.cookie) {
        let array = document.cookie.split((escape(cookieName) + '='));
        if (array.length >= 2) {
            let arraySub = array[1].split(';');
            cookieValue = unescape(arraySub[0]);
        }
    }
    return cookieValue;
}

init();
