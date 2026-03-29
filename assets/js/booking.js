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
bookingBtn.disabled = true;

let selectedTime = [];
let currentScheduleData = [];

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
    !bookingBtn
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

    let dayMap = {
      1: "週一",
      2: "週二",
      3: "週三",
      4: "週四",
      5: "週五",
      6: "週六",
      7: "週日",
    };

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
            <div class="border-bottom bg-light px-3 d-flex align-items-center">
              <p class="mb-0 ps-2 py-2 sansTeg d-inline-block">${day}</p>
            </div>
            <div class="d-flex align-items-center">
              <div>
                <p class="display-5 sansTeg ps-3 pt-3 mb-0 pb-3  border-end pe-4">
                  ${String(h).padStart(2, "0")}:00
                </p>
              </div>
              <div class="mx-auto">
                <small class="border px-3 rounded-3 bg-light text-center">60mins</small>
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
            card.classList.add("btn-dark");
          } else {
            card.classList.remove("btn-dark");
          }

          orderTime(day, h, isSelected);
        };

        dayColumn.appendChild(timeBox);
      });

      canSelect.appendChild(dayColumn);
    }
  } catch {
    console.log("booking render error:", err);
  }

  function orderTime(day, h, isSelected) {
    let takeTime = `${day}${String(h).padStart(2, "0")}:00`;
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
}

booking();
