// const { default: axios } = require("axios");

// 自動帶入 JWT Token
const _bookingToken = localStorage.getItem("jwt_token");
if (_bookingToken) {
  axios.defaults.headers.common["Authorization"] = `Bearer ${_bookingToken}`;
}

// /api/tutor/${tutorId} id="tutorName"
// /api/view/courses id="coursePrice" id="courseName"
// href = `booking.html?tutorId=${tutorId}&courseId=${selectedCourseId}`
// /api/view/teacher_schedule/{teacherId}

// id="totalMins" id="totalLessons" id="totalPoints" id="bookingBtn"
let tutorName = document.getElementById("tutorName");
let courseName = document.getElementById("courseName");
let coursePrice = document.getElementById("coursePrice");
let canSelect = document.getElementById("canSelect");

let selectedList = document.getElementById("selectedList");
let totalMinutes = document.getElementById("totalMinutes");
let totalLessons = document.getElementById("totalLessons");
let totalPoints = document.getElementById("totalPoints");
let bookingBtn = document.getElementById("bookingBtn");
let prevWeekBtn = document.getElementById("prevWeekBtn");
let nextWeekBtn = document.getElementById("nextWeekBtn");
let currentWeekIndex = 0;
bookingBtn.disabled = true;

let weekBar = document.getElementById("weekBar");

let selectedTime = [];
let currentScheduleData = {};
let allDates = [];
let activeDate = null;

async function booking() {
  let url = new URLSearchParams(window.location.search);

  let tutorId = url.get("tutorId");
  let courseId = url.get("courseId");

  if (
    !tutorId ||
    !courseId ||
    !tutorName ||
    !courseName ||
    !coursePrice ||
    !canSelect ||
    !selectedList ||
    !totalMinutes ||
    !totalLessons ||
    !totalPoints ||
    !bookingBtn ||
    !weekBar ||
    !prevWeekBtn ||
    !nextWeekBtn
  ) {
    return;
  }

  try {
    // courseinfo
    let coursesResp = await axios.get(`/api/view/courses`);
    console.log(coursesResp);

    let courseList = coursesResp.data.content;
    console.log(courseList);

    for (let i = 0; i < courseList.length; i++) {
      if (courseList[i].id === Number(courseId)) {
        console.log(courseList[i].id);
        coursePrice.innerText = courseList[i].price;
        courseName.innerText = courseList[i].courseName;
        tutorName.innerText = courseList[i].teacherName;

        break;
      }
    }

    // tutor can booking time
    let scheduleResp = await axios.get(`/api/view/teacher_schedule/${tutorId}`);
    console.log(scheduleResp);

    let scheduleData = scheduleResp.data;
    console.log(scheduleData);

    canSelect.innerHTML = "";
    weekBar.innerHTML = "";

    let dayMap = {
      1: "週一",
      2: "週二",
      3: "週三",
      4: "週四",
      5: "週五",
      6: "週六",
      7: "週日",
    };

    allDates = buildFourWeeksDates();
    renderWeekBar(weekBar);

    for (let item in scheduleData) {
      let day = dayMap[item];
      let hours = scheduleData[item];

      let dayColumn = document.createElement("div");
      dayColumn.className = "col-md-4 mb-4";
      dayColumn.innerHTML = `<h5 class="fw-bold mb-3">${day}</h5>`;

      hours.forEach(function (h) {
        let timeBox = document.createElement("div");
        timeBox.className = "mb-2";

        timeBox.innerHTML = `
          <div type="btn" class="btn rounded-0 card-content border p-0 w-100">
            <div class="border-bottom px-3 d-flex align-items-center">
              <p class="mb-0 ps-2 py-2 sansTeg d-inline-block">${day}</p>
            </div>
            <div class="d-flex align-items-center">
              <div>
                <p class="display-5 sansTeg ps-3 pt-3 mb-0 pb-3  border-end pe-4">
                  ${String(h).padStart(2, "0")}:00
                </p>
              </div>
              <div class="mx-auto">
                <small class="border px-3 rounded-3 text-center">60mins</small>
              </div>
            </div>
          </div>
        `;

        timeBox.onclick = function () {
          let card = this.querySelector(".card-content");

          if (!card) {
            return;
          }

          card.classList.toggle("selected");

          let isSelected = card.classList.contains("selected");

          if (isSelected) {
            card.classList.add("btn-dark", "text-dark");
          } else {
            card.classList.remove("btn-dark", "text-dark");
          }

          orderTime(day, h, isSelected);
        };

        dayColumn.appendChild(timeBox);
      });

      canSelect.appendChild(dayColumn);
      prevWeekBtn.onclick = function () {
        if (currentWeekIndex > 0) {
          currentWeekIndex--;
          renderWeekBar(weekBar);
        }
      };

      nextWeekBtn.onclick = function () {
        if (currentWeekIndex < 3) {
          currentWeekIndex++;
          renderWeekBar(weekBar);
        }
      };
    }
  } catch {
    console.log("booking render error:", err);
  }

  function orderTime(day, h, isSelected) {
    let takeTime = `${day} ${String(h).padStart(2, "0")}:00`;
    if (isSelected) {
      selectedTime.push(takeTime);
    } else {
      let cancel = selectedTime.indexOf(takeTime);
      if (cancel != -1) {
        selectedTime.splice(cancel, 1);
      }
    }

    selectedList.innerText = selectedTime.join(" 、 ");

    let lessonCount = selectedTime.length;
    totalLessons.innerText = lessonCount;

    totalMinutes.innerText = lessonCount * 60;

    let price = Number(coursePrice.innerText);
    totalPoints.innerText = lessonCount * price;

    if (lessonCount === 0) {
      bookingBtn.disabled = true;
    } else {
      bookingBtn.disabled = false;
    }
  }

  function buildFourWeeksDates() {
    let today = new Date();
    today.setHours(0, 0, 0, 0);

    let todayWeekday = today.getDay() === 0 ? 7 : today.getDay();

    // 找到本週週一
    let monday = new Date(today);
    monday.setDate(today.getDate() - (todayWeekday - 1));

    let list = [];

    for (let i = 0; i < 28; i++) {
      let currentDate = new Date(monday);
      currentDate.setDate(monday.getDate() + i);
      currentDate.setHours(0, 0, 0, 0);

      let weekdayNumber = currentDate.getDay() === 0 ? 7 : currentDate.getDay();

      list.push({
        fullDate: `${currentDate.getFullYear()}-${String(
          currentDate.getMonth() + 1,
        ).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`,
        month: currentDate.getMonth() + 1,
        day: currentDate.getDate(),
        weekdayNumber: weekdayNumber,
        isToday: currentDate.getTime() === today.getTime(),
      });
    }

    return list;
  }

  function renderWeekBar(weekBar) {
    weekBar.innerHTML = "";

    let dayMap = {
      1: "一",
      2: "二",
      3: "三",
      4: "四",
      5: "五",
      6: "六",
      7: "日",
    };

    // 例如第 0 週 -> 0~6
    // 第 1 週 -> 7~13
    let start = currentWeekIndex * 7;
    let end = start + 7;

    let currentWeekDates = allDates.slice(start, end);

    currentWeekDates.forEach(function (item) {
      let box = document.createElement("div");
      box.className = "flex-shrink-0";

      box.innerHTML = `
      <button
        type="button"
        class="btn rounded-3 border py-2 ${
          item.isToday ? "btn-outline-secondary" : "btn-outline-dark"
        }"
        style="width: 110px;"
        data-date="${item.fullDate}"
        data-weekday="${item.weekdayNumber}"
        ${item.isToday ? "disabled" : "enabled"}
      >
        <p class="mb-1 fw-bold">${item.month}/${item.day}</p>
        <small>週${dayMap[item.weekdayNumber]}</small>
        ${item.isToday}
      </button>
    `;

      weekBar.appendChild(box);
    });

    // 第一週就不能再往左
    prevWeekBtn.disabled = currentWeekIndex === 0;

    // 第四週就不能再往右
    nextWeekBtn.disabled = currentWeekIndex === 3;
  }
}

booking();
