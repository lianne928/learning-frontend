import axios from "axios";

let loginForm = document.getElementById("loginForm");

if (!loginForm) {
  console.warn("loginForm not found");
} else {
  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();

    let emailInput = document.getElementById("emailInput").value;
    let passwdInput = document.getElementById("passwdInput").value;

    emailInput = emailInput.trim();
    passwdInput = passwdInput.trim();

    if (!emailInput || !passwdInput) {
      alert("請輸入帳號與密碼");
      return;
    }

    let inputPost = {
      email: emailInput,
      password: passwdInput,
    };

    axios
      .post(`${API_BASE_URL}/auth/login`, inputPost)
      .then(function (resp) {
        console.log(resp.data);
        alert("OK");
        if (resp && resp.data && resp.data.success === false) {
          alert("帳號或密碼錯誤");
          return;
        }
        window.location.href = "/index.html";
      })
      .catch(function (err) {
        const status = err?.response?.status;
        if (status === 401) {
          alert("帳號或密碼錯誤");
        } else if (status === 400) {
          alert("輸入格式有誤");
        } else {
          alert("登入失敗");
        }
        console.log(err);
      });
  });
}
